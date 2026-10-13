import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { toolDefinitions, runTool } from './tools.js';

/**
 * POST /chatbot/message  (use case CHATBOT_001)
 *
 * Body:     { messages: [{ role: "user" | "assistant", text }], context? }
 * Response: { reply } or { error }
 *
 * The conversation is kept in the browser; the server stores nothing.
 *
 * TODO:
 *   - stream the reply so users see it as it is written
 *   - rate limiting / input length limits
 */

const SYSTEM_PROMPT = `You are HDBuddy Assistant, the chatbot in HDBuddyPro, a web app for finding HDB resale flats in Singapore.
Answer questions about HDB flat prices, remaining lease, nearby amenities, differences between flats and locations.
Use the tools to look up figures; never invent prices or addresses. If the data isn't available, say so.
Only help with HDB-related questions. You give information, not financial or legal advice.`;
// TODO: describe the datasets (date range, towns/regions) and app features in more detail.

const MAX_TOOL_ROUNDS = 5;

let client = null;
// Reads ANTHROPIC_API_KEY from the environment (see backend/.env.example).
const getClient = () => (client ??= new Anthropic());

const router = express.Router();

router.post('/message', async (req, res) => {
    const { messages, context } = req.body ?? {};
    if (!Array.isArray(messages) || messages.at(-1)?.role !== 'user') {
        return res.status(400).json({ error: 'Invalid chat request.' });
    }

    // Scaffold mode: without an API key, reply with a placeholder so the chat
    // UI and request flow can be built and tested without calling the LLM.
    if (!process.env.ANTHROPIC_API_KEY) {
        return res.json({
            reply:
                '[Scaffold mode - no LLM connected]\n' +
                `You asked: "${messages.at(-1).text}"\n` +
                `Page: ${context?.page ?? 'unknown'}\n` +
                'Set ANTHROPIC_API_KEY in backend/.env to get real answers.',
        });
    }

    const apiMessages = messages.map(({ role, text }) => ({ role, content: String(text) }));
    // Tell the model what the user is looking at in the app (page, filters, open flat...).
    // TODO: send richer context from each page (see <Chatbot pageContext={...}>).
    if (context) {
        apiMessages.at(-1).content =
            `<app_context>${JSON.stringify(context)}</app_context>\n\n` + apiMessages.at(-1).content;
    }

    try {
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
            const response = await getClient().beta.messages.create({
                model: process.env.CHATBOT_MODEL || 'claude-opus-5-5',
                max_tokens: 4096,
                system: SYSTEM_PROMPT,
                tools: toolDefinitions,
                messages: apiMessages,
                // If a safety filter wrongly declines, retry on Anthropic's recommended fallback model.
                betas: ['server-side-fallback-2026-07-01'],
                fallbacks: 'default',
            });

            if (response.stop_reason === 'refusal') {
                return res.json({ reply: "Sorry, I can't help with that. I can answer questions about HDB flats." });
            }

            const toolUses = response.content.filter((block) => block.type === 'tool_use');
            if (toolUses.length === 0) {
                const reply = response.content
                    .filter((block) => block.type === 'text')
                    .map((block) => block.text)
                    .join('\n\n');
                return res.json({ reply });
            }

            // The model asked for data: run the tools and send the results back.
            apiMessages.push({ role: 'assistant', content: response.content });
            apiMessages.push({ role: 'user', content: toolUses.map(runTool) });
        }
        return res.json({ reply: 'Sorry, that question needed too many lookups. Could you narrow it down?' });
    } catch (error) {
        console.error('[chatbot]', error.message);
        return res.status(503).json({
            error: 'The chatbot is temporarily unavailable. Please try again later.',
        });
    }
});

export default router;
