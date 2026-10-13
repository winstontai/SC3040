import express from 'express';
import OpenAI from 'openai';
import { z } from 'zod';
import { getData, normaliseAddress } from './data.js';
import { buildSystemPrompt } from './prompt.js';
import { toolDefinitions, runTool, describeToolCall } from './tools.js';

/**
 * POST /chatbot/message  (use case CHATBOT_001)
 *
 * Body: { messages: [{ role: "user" | "assistant", text, context? }] }
 * The conversation lives in the browser (sessionStorage); the server keeps no
 * chat state. The reply is streamed back as server-sent events:
 *   { type: "status", text }   - what the assistant is looking up
 *   { type: "text", text }     - a chunk of the answer (markdown)
 *   { type: "flats", flats }   - blocks mentioned in the answer, for the map
 *   { type: "error", message } - user-facing error message
 *   { type: "done" }
 *
 * Uses the OpenAI Responses API. Without OPENAI_API_KEY it runs in scaffold
 * mode and streams a placeholder reply instead.
 */

const DEFAULT_MODEL = 'gpt-6-luna';
const MAX_TOOL_ROUNDS = 6;
const MAX_HISTORY_MESSAGES = 20;
const RATE_LIMIT_PER_MINUTE = 15;

const UNAVAILABLE_MESSAGE =
    'The chatbot is temporarily unavailable. Please try again later, or keep exploring with the filters and map.';

const RequestBody = z.object({
    messages: z.array(z.object({
        role: z.enum(['user', 'assistant']),
        text: z.string().min(1).max(12000),
        context: z.record(z.string(), z.unknown()).optional(),
    })).min(1).max(100),
});

let client = null;
// Reads OPENAI_API_KEY from the environment (see backend/.env.example).
const getClient = () => (client ??= new OpenAI({ timeout: 60_000, maxRetries: 2 }));

let systemPrompt = null;
const getSystemPrompt = () => (systemPrompt ??= buildSystemPrompt());

/** Very small in-memory per-IP limiter so one client can't run up the API bill. */
const recentRequests = new Map();
const isRateLimited = (ip) => {
    const now = Date.now();
    const timestamps = (recentRequests.get(ip) ?? []).filter((t) => now - t < 60_000);
    timestamps.push(now);
    recentRequests.set(ip, timestamps);
    return timestamps.length > RATE_LIMIT_PER_MINUTE;
};

/**
 * Converts the browser's chat history into Responses API input. A user
 * turn's app context is serialised the same way every time, so earlier turns
 * are identical across requests (helps prompt caching).
 */
const toInput = (history) => {
    let recent = history.slice(-MAX_HISTORY_MESSAGES);
    while (recent.length && recent[0].role !== 'user') recent = recent.slice(1);

    return recent.map((message) => {
        if (message.role === 'assistant') return { role: 'assistant', content: message.text };
        const context = message.context
            ? `<app_context>\n${JSON.stringify(message.context).slice(0, 6000)}\n</app_context>\n\n`
            : '';
        return { role: 'user', content: context + message.text };
    });
};

/**
 * Turns a response output item into an input item for the next round. With
 * store: false the model's reasoning is carried over as encrypted content.
 */
const toInputItem = (item) => {
    if (item.type === 'function_call') {
        return { type: 'function_call', call_id: item.call_id, name: item.name, arguments: item.arguments };
    }
    if (item.type === 'reasoning') {
        return { type: 'reasoning', id: item.id, summary: item.summary ?? [], encrypted_content: item.encrypted_content };
    }
    if (item.type === 'message') {
        const text = item.content.filter((c) => c.type === 'output_text').map((c) => c.text).join('');
        return text ? { role: 'assistant', content: text } : null;
    }
    return null;
};

const userFacingError = (error) => {
    if (error instanceof OpenAI.RateLimitError) {
        console.error('[chatbot] OpenAI rate limit or quota exceeded:', error.message);
        return 'The chatbot is busy right now. Please wait a moment and try again.';
    }
    if (error instanceof OpenAI.AuthenticationError || error instanceof OpenAI.PermissionDeniedError) {
        console.error('[chatbot] OpenAI rejected the credentials - check OPENAI_API_KEY');
        return UNAVAILABLE_MESSAGE;
    }
    if (error instanceof OpenAI.NotFoundError) {
        console.error('[chatbot] OpenAI model not found - check OPENAI_MODEL:', error.message);
        return UNAVAILABLE_MESSAGE;
    }
    if (error instanceof OpenAI.APIError) {
        console.error(`[chatbot] OpenAI API error ${error.status ?? ''}:`, error.message);
        return UNAVAILABLE_MESSAGE;
    }
    console.error('[chatbot] unexpected error:', error);
    return UNAVAILABLE_MESSAGE;
};

const router = express.Router();

router.post('/message', async (req, res) => {
    const body = RequestBody.safeParse(req.body);
    if (!body.success || body.data.messages.at(-1).role !== 'user') {
        return res.status(400).json({ error: 'Invalid chat request.' });
    }
    const question = body.data.messages.at(-1);
    if (question.text.length > 2000) {
        return res.status(400).json({ error: 'Please keep your question under 2,000 characters.' });
    }
    if (isRateLimited(req.ip)) {
        return res.status(429).json({ error: 'Too many questions in a short time. Please wait a minute.' });
    }

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
    });
    const send = (event) => res.write(`data: ${JSON.stringify(event)}\n\n`);

    // Scaffold mode: no API key, so reply with a placeholder instead of calling the LLM.
    if (!process.env.OPENAI_API_KEY) {
        send({
            type: 'text',
            text: '*[Scaffold mode - no LLM connected]*\n\n' +
                `You asked: "${question.text}"\n\n` +
                `Page: ${question.context?.page ?? 'unknown'}\n\n` +
                'Set `OPENAI_API_KEY` in `backend/.env` to get real answers.',
        });
        send({ type: 'done' });
        return res.end();
    }

    const abort = new AbortController();
    res.on('close', () => {
        if (!res.writableEnded) abort.abort();
    });

    const input = toInput(body.data.messages);
    const locations = [];
    let answer = '';

    try {
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
            const stream = getClient().responses.stream({
                model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
                instructions: getSystemPrompt(),
                input,
                tools: toolDefinitions,
                // On the last round, force a written answer instead of more lookups.
                tool_choice: round === MAX_TOOL_ROUNDS - 1 ? 'none' : 'auto',
                max_output_tokens: 16000,
                // Don't keep conversations on OpenAI's side; reasoning is passed back encrypted.
                store: false,
                include: ['reasoning.encrypted_content'],
                prompt_cache_key: 'hdbuddy-chatbot',
            }, { signal: abort.signal });

            for await (const event of stream) {
                if (event.type === 'response.output_item.added' && event.item.type === 'function_call') {
                    send({ type: 'status', text: describeToolCall(event.item.name) });
                } else if (event.type === 'response.output_item.added' && event.item.type === 'message' && answer) {
                    // Separate text written in different rounds.
                    answer += '\n\n';
                    send({ type: 'text', text: '\n\n' });
                } else if (event.type === 'response.output_text.delta') {
                    answer += event.delta;
                    send({ type: 'text', text: event.delta });
                }
            }
            const response = await stream.finalResponse();

            if (response.status === 'failed') {
                throw new Error(response.error?.message ?? 'Response failed');
            }
            const refused = response.output.some((item) =>
                item.type === 'message' && item.content.some((c) => c.type === 'refusal'));
            if (refused || response.incomplete_details?.reason === 'content_filter') {
                send({
                    type: 'text',
                    text: (answer ? '\n\n' : '') +
                        "Sorry, I can't help with that. I can answer questions about HDB flat prices, leases, amenities and locations.",
                });
                break;
            }

            const calls = response.output.filter((item) => item.type === 'function_call');
            if (calls.length === 0) break;
            if (response.status === 'incomplete') throw new Error('Tool call cut off at max_output_tokens');

            // The model asked for data: run the tools and send the results back.
            input.push(...response.output.map(toInputItem).filter(Boolean));
            for (const call of calls) {
                const { output, locations: found } = runTool(call.name, call.arguments);
                locations.push(...found);
                input.push({ type: 'function_call_output', call_id: call.call_id, output });
            }
        }

        // Offer "show on map" links for blocks the answer actually mentions.
        const mentioned = normaliseAddress(answer);
        const seen = new Set();
        const flats = locations.filter((loc) => {
            if (seen.has(loc.address) || !mentioned.includes(normaliseAddress(loc.address))) return false;
            seen.add(loc.address);
            return true;
        }).slice(0, 6);
        if (flats.length) send({ type: 'flats', flats });
        send({ type: 'done' });
    } catch (error) {
        if (!abort.signal.aborted) send({ type: 'error', message: userFacingError(error) });
    } finally {
        res.end();
    }
});

/** Loads the datasets ahead of the first question so it isn't slow. */
export const warmUpChatbot = () => {
    if (!process.env.OPENAI_API_KEY) {
        console.warn('[chatbot] OPENAI_API_KEY is not set - running in scaffold mode (placeholder replies). See backend/.env.example');
    }
    getData();
    getSystemPrompt();
};

export default router;
