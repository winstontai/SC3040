import { useState, useRef, useEffect } from "react";
import PropTypes from "prop-types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { IoChatbubbleEllipses, IoClose, IoSend } from "react-icons/io5";
import { MdDeleteOutline } from "react-icons/md";
import { FaMapMarkerAlt } from "react-icons/fa";
import "./Chatbot.css";

const STORAGE_KEY = "hdbuddy-chat";
const UNAVAILABLE_MESSAGE =
  "The chatbot is temporarily unavailable. Please try again later, or keep exploring with the filters and map.";

const SUGGESTIONS = [
  "What's the median price of a 4-room flat in Tampines?",
  "Which towns have the cheapest 5-room flats?",
  "Find 4-room flats near Bishan MRT under $700k",
  "Compare 406 Ang Mo Kio Ave 10 and 108 Ang Mo Kio Ave 4",
];

/**
 * Reads the conversation saved for this browser session.
 * @return {Array} saved messages, or [] if storage is unavailable
 */
const loadMessages = () => {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) ?? [];
  } catch {
    return [];
  }
};

/** "406 ANG MO KIO AVE 10" -> "406 Ang Mo Kio Ave 10" */
const toTitleCase = (text) =>
  text.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());

/**
 * Floating AI chatbot (use case CHATBOT_001). Users ask questions in natural
 * language about HDB flats; the backend answers from the app's data using
 * an LLM and streams the reply back.
 *
 * @param {Object} pageContext - what the user currently sees in the app
 * (page, filters, open flat ...); sent with each question so the assistant
 * can answer "this flat" or "my filters" questions
 * @param {function} onLocateFlat - optional; when given (map page), blocks
 * mentioned in an answer get a "show on map" button that calls it
 * @param {number} offsetRight - distance of the chat button from the right
 * edge, to avoid overlapping page controls
 */
function Chatbot({ pageContext, onLocateFlat, offsetRight = 24 }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState(loadMessages);
  const [input, setInput] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [status, setStatus] = useState("");

  const listRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  /** Keep the conversation for the rest of the browser session. */
  useEffect(() => {
    if (isPending) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // storage full or blocked; the chat still works for this page
    }
  }, [messages, isPending]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, status, isOpen]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => () => abortRef.current?.abort(), []);

  /** Applies a change to the assistant message currently being streamed. */
  const updateLastMessage = (update) => {
    setMessages((prev) => [...prev.slice(0, -1), update(prev[prev.length - 1])]);
  };

  const handleEvent = (event) => {
    if (event.type === "status") {
      setStatus(event.text);
    } else if (event.type === "text") {
      setStatus("");
      updateLastMessage((m) => ({ ...m, text: m.text + event.text }));
    } else if (event.type === "flats") {
      updateLastMessage((m) => ({ ...m, flats: event.flats }));
    } else if (event.type === "error") {
      updateLastMessage((m) => ({ ...m, text: event.message, error: true }));
    }
  };

  /**
   * Sends a question with the conversation so far and streams the reply.
   * @param {string} question - text typed by the user
   */
  const sendMessage = async (question) => {
    const text = question.trim();
    if (!text || isPending) return;

    const userMessage = { role: "user", text };
    if (pageContext) userMessage.context = pageContext;
    // Failed or empty replies are shown to the user but not sent back.
    const history = [...messages, userMessage].filter(
      (m) => !m.error && m.text.trim()
    );

    setMessages((prev) => [...prev, userMessage, { role: "assistant", text: "" }]);
    setInput("");
    setIsPending(true);
    setStatus("Thinking…");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/chatbot/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map(({ role, text, context }) => ({ role, text, context })),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? UNAVAILABLE_MESSAGE);
      }

      // Server-sent events: "data: {json}\n\n"
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop();
        for (const chunk of chunks) {
          if (chunk.startsWith("data: ")) handleEvent(JSON.parse(chunk.slice(6)));
        }
      }
      updateLastMessage((m) =>
        m.text ? m : { ...m, text: UNAVAILABLE_MESSAGE, error: true }
      );
    } catch (error) {
      if (error.name === "AbortError") return;
      const message = error instanceof TypeError ? UNAVAILABLE_MESSAGE : error.message;
      updateLastMessage((m) => ({ ...m, text: message, error: true }));
    } finally {
      setIsPending(false);
      setStatus("");
    }
  };

  const clearChat = () => {
    abortRef.current?.abort();
    setMessages([]);
    setIsPending(false);
    setStatus("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div className="chatbot" style={{ "--chatbot-right": `${offsetRight}px` }}>
      {isOpen && (
        <section className="chatbot-panel" role="dialog" aria-label="HDBuddy chat assistant">
          <header className="chatbot-header">
            <div>
              <h2>HDBuddy Assistant</h2>
              <p>Ask about prices, leases, amenities and locations</p>
            </div>
            <div className="chatbot-header-actions">
              {messages.length > 0 && (
                <button onClick={clearChat} aria-label="Clear conversation" title="Clear conversation">
                  <MdDeleteOutline size={20} />
                </button>
              )}
              <button onClick={() => setIsOpen(false)} aria-label="Close chat" title="Close">
                <IoClose size={22} />
              </button>
            </div>
          </header>

          <div className="chatbot-messages" ref={listRef} aria-live="polite">
            {messages.length === 0 && (
              <div className="chatbot-welcome">
                <p>
                  Hi! I can answer questions about HDB resale flats using the
                  same data as the map. Try one of these:
                </p>
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    className="chatbot-suggestion"
                    onClick={() => sendMessage(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}

            {messages.map((message, index) => {
              const isStreaming = isPending && index === messages.length - 1;
              if (message.role === "user") {
                return (
                  <div key={index} className="chatbot-message user">
                    {message.text}
                  </div>
                );
              }
              return (
                <div
                  key={index}
                  className={`chatbot-message assistant ${message.error ? "error" : ""}`}
                >
                  {message.text ? (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        a: (props) => <a {...props} target="_blank" rel="noopener noreferrer" />,
                        table: (props) => (
                          <div className="chatbot-table">
                            <table {...props} />
                          </div>
                        ),
                      }}
                    >
                      {message.text}
                    </ReactMarkdown>
                  ) : (
                    isStreaming && <span className="chatbot-typing" aria-label="Assistant is typing" />
                  )}
                  {isStreaming && status && <p className="chatbot-status">{status}</p>}
                  {onLocateFlat && message.flats?.length > 0 && (
                    <div className="chatbot-flats">
                      {message.flats.map((flat) => (
                        <button key={flat.address} onClick={() => onLocateFlat(flat)}>
                          <FaMapMarkerAlt /> {toTitleCase(flat.address)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <form
            className="chatbot-input"
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(input);
            }}
          >
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              maxLength={2000}
              placeholder="Ask about HDB flats…"
              aria-label="Your question"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button type="submit" disabled={!input.trim() || isPending} aria-label="Send">
              <IoSend size={18} />
            </button>
          </form>
          <p className="chatbot-disclaimer">
            AI answers from past HDB resale data. They may be inaccurate or out
            of date and are not financial advice.
          </p>
        </section>
      )}

      <button
        className="chatbot-toggle"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={isOpen ? "Close chat assistant" : "Open chat assistant"}
        aria-expanded={isOpen}
      >
        {isOpen ? <IoClose size={28} /> : <IoChatbubbleEllipses size={28} />}
      </button>
    </div>
  );
}

Chatbot.propTypes = {
  pageContext: PropTypes.object,
  onLocateFlat: PropTypes.func,
  offsetRight: PropTypes.number,
};

export default Chatbot;
