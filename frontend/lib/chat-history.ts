import type { ProcessData } from "@/lib/api";
import type { AssistantPayload } from "@/components/Message";

const STORAGE_PREFIX = "lifeos_chat_v1_";
const MAX_MESSAGES = 500;

export type ChatRow =
  | { id: string; role: "user"; text: string; timestamp?: number }
  | {
      id: string;
      role: "assistant";
      assistant: AssistantPayload;
      timestamp?: number;
    };

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`;
}

function normalizeAssistantPayload(raw: unknown): AssistantPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const ap = raw as Record<string, unknown>;
  if (typeof ap.response !== "string") return null;
  if (typeof ap.type !== "string") return null;
  return {
    success: typeof ap.success === "boolean" ? ap.success : true,
    type: ap.type,
    response: ap.response,
    data: (ap.data ?? null) as ProcessData,
  };
}

function parseRow(value: unknown): ChatRow | null {
  if (!value || typeof value !== "object") return null;
  const r = value as Record<string, unknown>;
  if (typeof r.id !== "string") return null;
  const timestamp = typeof r.timestamp === "number" ? r.timestamp : undefined;
  if (r.role === "user" && typeof r.text === "string") {
    return { id: r.id, role: "user", text: r.text, timestamp };
  }
  if (r.role === "assistant") {
    const assistant = normalizeAssistantPayload(r.assistant);
    if (!assistant) return null;
    return { id: r.id, role: "assistant", assistant, timestamp };
  }
  return null;
}

export function loadChatHistory(userId: string): ChatRow[] {
  if (!userId || typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const rows: ChatRow[] = [];
    for (const item of parsed) {
      const row = parseRow(item);
      if (row) rows.push(row);
    }
    return rows.slice(-MAX_MESSAGES);
  } catch {
    return [];
  }
}

export function saveChatHistory(userId: string, rows: ChatRow[]): void {
  if (!userId || typeof window === "undefined") return;
  try {
    const trimmed = rows.slice(-MAX_MESSAGES);
    localStorage.setItem(storageKey(userId), JSON.stringify(trimmed));
    window.dispatchEvent(new Event("chat-history-updated"));
  } catch {
    /* quota or private mode */
  }
}

export function isSameDay(t1?: number, t2?: number) {
  if (!t1 && !t2) return true; // both missing timestamp -> same "Previous" bucket
  if (!t1 || !t2) return false;
  const d1 = new Date(t1);
  const d2 = new Date(t2);
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

export function formatDateHeader(t?: number) {
  if (!t) return "Mon-13-03-06";
  const d = new Date(t);
  
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayName = days[d.getDay()];
  
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  
  return `${dayName}-${dd}-${mm}-${yy}`;
}

export function generateDateId(t?: number) {
  return "date-" + formatDateHeader(t).replace(/\s+/g, '-').toLowerCase();
}
