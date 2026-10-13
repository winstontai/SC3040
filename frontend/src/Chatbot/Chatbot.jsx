import { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { IoChatbubbleEllipses, IoClose, IoSend } from "react-icons/io5";
import "./Chatbot.css";

const STORAGE_KEY = "hdbuddy-chat";

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

/**
 * Floating AI chatbot (use case CHATBOT_001). Sends the user's question and
 * the conversation so far to the backend (/chatbot/message), which answers
 * using the LLM API and the app's HDB data.
 *
 * TODO:
 *   - render markdown replies (tables for flat comparisons)
 *   - stream replies as they are generated
 *   - suggested starter questions
 *
 * @param {Object} pageContext - what the user currently sees (page, filters,
 * selected flat...), so the chatbot can answer "this flat" questions
 */
function Chatbot({ pageContext }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState(loadMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const listRef = useRef(null);

  // Keep the conversation for the rest of the browser session.
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // storage blocked; chat still works on this page
    }
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, isOpen]);

  const sendMessage = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;

    const history = [...messages, { role: "user", text }];
    setMessages(history);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/chatbot/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Error messages are shown but not sent back to the model.
          messages: history.filter((m) => !m.error).map(({ role, text }) => ({ role, text })),
          context: pageContext,
        }),
      });
      // Body is empty if the backend isn't running (the Vite proxy returns a bare error).
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.reply) throw new Error(data.error);
      setMessages([...history, { role: "assistant", text: data.reply }]);
    } catch (error) {
      setMessages([
        ...history,
        {
          role: "assistant",
          text: error.message || "The chatbot is temporarily unavailable. Please try again later.",
          error: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="chatbot">
      {isOpen && (
        <section className="chatbot-panel" role="dialog" aria-label="HDBuddy chat assistant">
          <header className="chatbot-header">
            <h2>HDBuddy Assistant</h2>
            <button onClick={() => setMessages([])}>Clear</button>
          </header>

          <div className="chatbot-messages" ref={listRef} aria-live="polite">
            {messages.length === 0 && (
              <p className="chatbot-hint">
                Ask me about HDB flat prices, leases, amenities or locations.
              </p>
            )}
            {messages.map((message, index) => (
              <div
                key={index}
                className={`chatbot-message ${message.role} ${message.error ? "error" : ""}`}
              >
                {message.text}
              </div>
            ))}
            {isLoading && <div className="chatbot-message assistant">Thinking…</div>}
          </div>

          <form className="chatbot-input" onSubmit={sendMessage}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about HDB flats…"
              aria-label="Your question"
              maxLength={2000}
            />
            <button type="submit" disabled={!input.trim() || isLoading} aria-label="Send">
              <IoSend />
            </button>
          </form>
          <p className="chatbot-disclaimer">
            AI answers may be inaccurate and are not financial advice.
          </p>
        </section>
      )}

      <button
        className="chatbot-toggle"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? "Close chat assistant" : "Open chat assistant"}
      >
        {isOpen ? <IoClose size={26} /> : <IoChatbubbleEllipses size={26} />}
      </button>
    </div>
  );
}

Chatbot.propTypes = {
  pageContext: PropTypes.object,
};

export default Chatbot;
