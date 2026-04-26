"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  Fragment,
} from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { processInput, getSubscriptionStatus, type ProcessResponse } from "@/lib/api";
import {
  loadChatHistory,
  saveChatHistory,
  type ChatRow,
  isSameDay,
  formatDateHeader,
  generateDateId,
} from "@/lib/chat-history";
import { Message, type AssistantPayload } from "./Message";
import { TrashIcon } from "@heroicons/react/24/outline";

function toAssistantPayload(res: ProcessResponse): AssistantPayload {
  return {
    success: res.success,
    type: res.type,
    response: res.response,
    data: res.data,
  };
}

type ChatSession = { userId: string; rows: ChatRow[] };

export function ChatBox() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { getToken } = useAuth();
  const { user, isLoaded: userLoaded } = useUser();
  const [session, setSession] = useState<ChatSession>({
    userId: "",
    rows: [],
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [maxChars, setMaxChars] = useState(100); // default to free plan limit
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const canPersistRef = useRef(false);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    // Small delay to let DOM update before scrolling
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior, block: "end" });
    });
  }, []);

  useLayoutEffect(() => {
    if (!userLoaded || !user?.id) {
      canPersistRef.current = false;
      setSession({ userId: "", rows: [] });
      return;
    }
    const id = user.id;
    const loaded = loadChatHistory(id);
    setSession({ userId: id, rows: loaded });
    canPersistRef.current = true;
    // Scroll to bottom on initial load (instant, no animation)
    setTimeout(() => scrollToBottom("instant"), 50);
  }, [userLoaded, user?.id]);

  // Fetch plan-specific character limit
  useEffect(() => {
    if (!userLoaded || !user?.id) return;
    getSubscriptionStatus(getToken)
      .then((status) => {
        // Plan-based limits: free=100, basic=200, standard=300, pro=500, premium+=500
        const PLAN_CHAR_LIMITS: Record<string, number> = {
          free: 100,
          basic_29: 200,
          standard_49: 300,
          pro_99: 500,
          premium_499: 500,
          ultra_999: 500,
          elite_1299: 500,
          apex_1999: 1000,
        };
        const planName = status?.plan?.name || "free";
        setMaxChars(PLAN_CHAR_LIMITS[planName] ?? 100);
      })
      .catch(() => setMaxChars(100));
  }, [userLoaded, user?.id, getToken]);

  useEffect(() => {
    if (!canPersistRef.current || !session.userId) return;
    saveChatHistory(session.userId, session.rows);
  }, [session]);

  // Re-focus the input after loading completes so user can type immediately
  useEffect(() => {
    if (!loading) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [loading]);

  const handleDeleteRow = useCallback((id: string) => {
    setSession((s) => ({ ...s, rows: s.rows.filter((r) => r.id !== id) }));
  }, []);

  const send = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || !session.userId || loading || !userLoaded) return;
    if (trimmed.length > maxChars) return; // block oversized messages

    const userMsg: ChatRow = {
      id: crypto.randomUUID(),
      role: "user",
      text: trimmed,
      timestamp: Date.now(),
    };
    setSession((s) => ({ ...s, rows: [...s.rows, userMsg] }));
    setInput("");
    setLoading(true);
    scrollToBottom();

    const todayId = generateDateId(Date.now());
    if (searchParams?.get("date") !== todayId) {
      router.push(`/chat?date=${todayId}`);
    }

    try {
      const tz =
        typeof Intl !== "undefined"
          ? Intl.DateTimeFormat().resolvedOptions().timeZone
          : undefined;
      const res = await processInput(getToken, {
        input: trimmed,
        userTimezone: tz,
      });
      const assistantRow: ChatRow = {
        id: crypto.randomUUID(),
        role: "assistant",
        assistant: toAssistantPayload(res),
        timestamp: Date.now(),
      };
      setSession((s) => ({ ...s, rows: [...s.rows, assistantRow] }));
      scrollToBottom();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      const errRow: ChatRow = {
        id: crypto.randomUUID(),
        role: "assistant",
        assistant: {
          success: false,
          type: "error",
          response: msg,
          data: null,
        },
        timestamp: Date.now(),
      };
      setSession((s) => ({ ...s, rows: [...s.rows, errRow] }));
      scrollToBottom();
    } finally {
      setLoading(false);
    }
  }, [input, session.userId, loading, userLoaded, getToken, maxChars]);

  const { rows, userId } = session;
  const activeDateId = searchParams?.get("date") || generateDateId(Date.now());
  const visibleRows = rows.filter((r) => generateDateId(r.timestamp) === activeDateId);

  if (!userLoaded) {
    return (
      <div className="flex flex-1 items-center justify-center text-zinc-500">
        Loading…
      </div>
    );
  }

  if (!user?.id) {
    return (
      <div className="flex flex-1 items-center justify-center text-zinc-500">
        Sign in to use chat.
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollAreaRef}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-8"
        aria-live="polite"
        aria-relevant="additions"
      >
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          {visibleRows.length === 0 ? (
            <div className="glass-panel mt-8 rounded-2xl px-6 py-8 text-center">
              {activeDateId === generateDateId(Date.now()) ? (
                <>
                  <p className="text-lg font-medium tracking-tight text-white">
                    Welcome to Cortexa AI
                  </p>
                  <p className="mt-2 text-sm text-zinc-400">
                    Track spending, set reminders, and capture memories — then ask
                    anything about your day.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-lg font-medium tracking-tight text-white">
                    No chats found
                  </p>
                  <p className="mt-2 text-sm text-zinc-400">
                    You have no history for this date.
                  </p>
                </>
              )}
            </div>
          ) : null}
          {visibleRows.map((row, index) => {
            const prev = visibleRows[index - 1];
            const showDivider = !prev || !isSameDay(row.timestamp, prev.timestamp);

            return (
              <Fragment key={row.id}>
                {showDivider ? (
                  <div
                    id={generateDateId(row.timestamp)}
                    className="my-2 flex items-center justify-center scroll-mt-24"
                  >
                    <div className="rounded-full bg-white/5 px-4 py-1 text-xs font-medium text-zinc-400">
                      {formatDateHeader(row.timestamp)}
                    </div>
                  </div>
                ) : null}
                <ChatRowItem
                  row={row}
                  onDelete={() => handleDeleteRow(row.id)}
                />
              </Fragment>
            );
          })}
          {loading ? (
            <div className="flex justify-start">
              <div className="glass-panel flex items-center gap-1.5 rounded-2xl px-4 py-3">
                <span className="typing-dot h-2 w-2 rounded-full bg-slate-500" />
                <span className="typing-dot h-2 w-2 rounded-full bg-slate-500" />
                <span className="typing-dot h-2 w-2 rounded-full bg-slate-500" />
              </div>
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="border-t border-white/[0.06] bg-[#0a0a0a]/95 px-4 py-4 backdrop-blur-md md:px-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-1">
          <div className="flex items-end gap-2">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => {
                const val = e.target.value;
                if (val.length <= maxChars + 10) setInput(val);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="Ask anything about your day..."
              disabled={!userId || loading}
              className={`w-full rounded-full border bg-[#141414] px-5 py-3.5 pr-24 text-[15px] text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 disabled:opacity-50 ${
                input.length > maxChars
                  ? "border-rose-500/50 focus:border-rose-500/60 focus:ring-rose-500/20"
                  : "border-white/[0.08] focus:border-indigo-500/40 focus:ring-indigo-500/20"
              }`}
            />
            <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
              <button
                type="button"
                className="rounded-full p-2 text-slate-500 hover:bg-white/5 hover:text-slate-300"
                aria-label="Voice input (coming soon)"
                disabled
              >
                <MicIcon />
              </button>
              <button
                type="button"
                onClick={() => void send()}
                disabled={!input.trim() || input.trim().length > maxChars || !userId || loading}
                className="rounded-full bg-indigo-600 p-2.5 text-white shadow-lg shadow-indigo-900/30 transition hover:bg-indigo-500 disabled:opacity-40"
                aria-label="Send"
              >
                <SendIcon />
              </button>
            </div>
          </div>
          </div>
          {/* Character counter */}
          <div className="flex items-center justify-end gap-2 px-2">
            <span className={`text-xs font-medium tabular-nums ${
              input.length > maxChars
                ? "text-rose-400"
                : input.length > maxChars * 0.8
                  ? "text-amber-400/80"
                  : "text-zinc-600"
            }`}>
              {input.length}/{maxChars}
            </span>
            {input.length > maxChars && (
              <span className="text-xs text-rose-400/80">Upgrade plan for longer messages</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatRowItem({ row, onDelete }: { row: ChatRow; onDelete: () => void }) {
  const [showDelete, setShowDelete] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleStart = () => {
    timerRef.current = setTimeout(() => {
      setShowDelete(true);
    }, 500);
  };

  const handleEnd = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  return (
    <div
      className="relative"
      onDoubleClick={() => setShowDelete((p) => !p)}
      onTouchStart={handleStart}
      onTouchEnd={handleEnd}
      onTouchMove={handleEnd}
    >
      {showDelete ? (
        <div
          className={`absolute -top-3 z-10 flex items-center justify-center ${
            row.role === "user" ? "right-1" : "left-1"
          }`}
        >
          <button
            onClick={onDelete}
            className="rounded-full bg-rose-500 p-2 text-white shadow-lg shadow-rose-900/50 transition hover:bg-rose-400"
            title="Delete message"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      ) : null}

      {row.role === "user" ? (
        <Message role="user" text={row.text} timestamp={row.timestamp} />
      ) : (
        <Message role="assistant" assistant={row.assistant} timestamp={row.timestamp} />
      )}
    </div>
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 14a3 3 0 003-3V5a3 3 0 10-6 0v6a3 3 0 003 3z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M19 11a7 7 0 01-14 0M12 18v3M8 22h8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

