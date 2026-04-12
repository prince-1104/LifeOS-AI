import type { ProcessData } from "@/lib/api";
import type { AssistantPayload } from "@/components/Message";

const STORAGE_PREFIX = "lifeos_chat_v1_";
const MAX_MESSAGES = 500;

export type ChatRow =
  | { id: string; role: "user"; text: string }
  | {
      id: string;
      role: "assistant";
      assistant: AssistantPayload;
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
  if (r.role === "user" && typeof r.text === "string") {
    return { id: r.id, role: "user", text: r.text };
  }
  if (r.role === "assistant") {
    const assistant = normalizeAssistantPayload(r.assistant);
    if (!assistant) return null;
    return { id: r.id, role: "assistant", assistant };
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
  } catch {
    /* quota or private mode */
  }
}
