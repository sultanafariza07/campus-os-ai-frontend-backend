import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { HiSparkles, HiOutlineArrowLeft, HiOutlinePaperAirplane } from "react-icons/hi";

// AI Assistant — chat UI shell.
//
// There is still no AI/LLM backend anywhere in this project (no route, no
// model client). Rather than fake a working assistant, this builds the real
// chat UI (message list, typing indicator, auto-scroll, input validation,
// error state) against a clearly-labeled placeholder reply, so the moment a
// real backend exists this is a drop-in wiring job — swap `simulateReply`
// for a real `api.ai.chat(...)` call.

type Message = {
  id: number;
  role: "user" | "assistant";
  text: string;
};

const INTRO: Message = {
  id: 0,
  role: "assistant",
  text: "👋 Hi! I'm not connected to a real AI yet — this is a preview of the chat experience. Soon I'll help you summarize notes, answer questions, and plan your study time.",
};

export default function AiAssistantPage() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([INTRO]);
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the latest message whenever the conversation changes.
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, typing]);

  const send = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setError(null);

    const userMessage: Message = { id: Date.now(), role: "user", text: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setDraft("");
    setTyping(true);

    // Simulated reply — this is exactly where a real `api.ai.chat(...)`
    // call would go once a backend exists. On a real integration, a
    // network failure here should set `error` the same way every other
    // page in this app does (ApiRequestError-aware catch block).
    window.setTimeout(() => {
      setTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "assistant",
          text: "I'm just a preview for now, so I can't actually answer that yet — but I'll be able to soon!",
        },
      ]);
    }, 1100);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-[#0A0A0F] pb-[calc(6rem+env(safe-area-inset-bottom))] overflow-x-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-[-110px] left-1/2 -translate-x-1/2 w-[480px] h-[340px] rounded-full"
        style={{
          background: "radial-gradient(ellipse at 50% 0%, rgba(167,139,250,0.16) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />

      {/* Header */}
      <div className="relative mx-auto w-full max-w-sm px-4 pt-10 pb-3 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold text-white" style={{ letterSpacing: "-0.03em" }}>
            AI Assistant
          </h1>
          <p className="mt-1 text-xs text-[#64748B]">Preview — not connected yet</p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-[#E2E8F0] hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C63FF]"
        >
          <HiOutlineArrowLeft className="w-4 h-4" /> Back
        </button>
      </div>

      {/* Message list */}
      <div className="relative mx-auto w-full max-w-sm flex-1 space-y-3 overflow-y-auto px-4 py-2">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "assistant" && (
              <span className="mr-2 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#A78BFA]/12 ring-1 ring-[#A78BFA]/20">
                <HiSparkles className="h-3.5 w-3.5 text-[#A78BFA]" />
              </span>
            )}
            <div
              className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-lg ${
                m.role === "user"
                  ? "bg-[#6C63FF] text-white rounded-br-sm shadow-[#6C63FF]/15"
                  : "bg-[#111118] text-[#E2E8F0] border border-white/[0.07] rounded-bl-sm"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}

        {typing && (
          <div className="flex justify-start">
            <span className="mr-2 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#A78BFA]/12 ring-1 ring-[#A78BFA]/20">
              <HiSparkles className="h-3.5 w-3.5 text-[#A78BFA]" />
            </span>
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm border border-white/[0.07] bg-[#111118] px-4 py-3 shadow-lg">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#64748B] [animation-delay:-0.2s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#64748B] [animation-delay:-0.1s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#64748B]" />
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3">
            <p className="text-xs font-semibold text-red-200">{error}</p>
          </div>
        )}

        <div ref={scrollRef} />
      </div>

      {/* Composer */}
      <div className="relative mx-auto w-full max-w-sm px-4 pt-2 shrink-0">
        <div className="flex items-end gap-2 rounded-2xl border border-white/[0.08] bg-[#111118] p-2 shadow-xl">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask anything…"
            rows={1}
            aria-label="Message"
            className="max-h-28 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-[#E2E8F0] placeholder-[#4B5563] outline-none"
          />
          <button
            type="button"
            onClick={send}
            disabled={!draft.trim()}
            aria-label="Send message"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#6C63FF] text-white transition-colors hover:bg-[#7C6FFF] disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C63FF]"
          >
            <HiOutlinePaperAirplane className="h-4 w-4 rotate-90" />
          </button>
        </div>
      </div>
    </div>
  );
}
