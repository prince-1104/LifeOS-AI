import type { ProcessData, ProcessType } from "@/lib/api";

export type AssistantPayload = {
  success: boolean;
  type: ProcessType | string;
  response: string;
  data: ProcessData;
};

function formatInr(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function HighlightedText({ text }: { text: string }) {
  const parts = text.split(/(₹[\d,]+(?:\.\d+)?)/g);
  return (
    <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-slate-200">
      {parts.map((part, i) =>
        part.startsWith("₹") ? (
          <mark
            key={i}
            className="rounded bg-indigo-500/25 px-1 py-0.5 text-indigo-100"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </p>
  );
}

function formatMessageTime(t?: number) {
  if (!t) return null;
  const d = new Date(t);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).replace(/\s/g, '').toLowerCase();
}


export function Message({
  role,
  text,
  assistant,
  timestamp,
}: {
  role: "user" | "assistant";
  text?: string;
  assistant?: AssistantPayload;
  timestamp?: number;
}) {
  if (role === "user" && text) {
    return (
      <div className="animate-message-in flex justify-end">
        <div className="flex flex-col items-end">
          <div className="max-w-[min(100%,42rem)] rounded-2xl bg-gradient-to-br from-indigo-600/90 to-violet-700/85 px-4 py-3 text-[15px] leading-relaxed text-white shadow-lg shadow-indigo-950/40">
            {text}
          </div>
          {timestamp ? (
            <span className="mt-1 pr-2 text-[11px] font-medium text-zinc-500/80">
              {formatMessageTime(timestamp)}
            </span>
          ) : null}
        </div>
      </div>
    );
  }

  if (role === "assistant" && assistant) {
    const { type, response, data, success } = assistant;

    if (!success || type === "error") {
      return (
        <div className="animate-message-in flex justify-start">
          <div className="flex flex-col items-start">
            <div className="glass-panel max-w-[min(100%,42rem)] rounded-2xl border border-rose-500/20 bg-rose-500/5 px-4 py-3">
              <p className="text-sm text-rose-100/90">{response}</p>
            </div>
            {timestamp ? (
              <span className="mt-1 pl-2 text-[11px] font-medium text-zinc-500/80">
                {formatMessageTime(timestamp)}
              </span>
            ) : null}
          </div>
        </div>
      );
    }

    if (type === "finance" && data?.amount != null) {
      const tag =
        data.transaction_type === "income"
          ? "Income"
          : data.transaction_type === "expense"
            ? "Expense"
            : "Finance";
      return (
        <div className="animate-message-in flex justify-start">
          <div className="flex flex-col items-start">
            <div className="glass-panel max-w-[min(100%,42rem)] rounded-2xl px-4 py-4">
              <div className="mb-3 flex items-center gap-2 text-sm text-slate-400">
                <span aria-hidden>💸</span>
                <span>Finance</span>
              </div>
              <p className="text-2xl font-semibold tracking-tight text-white">
                {formatInr(Number(data.amount))}
              </p>
              {data.category ? (
                <p className="mt-1 text-sm capitalize text-slate-400">
                  {data.category}
                </p>
              ) : null}
              <span className="mt-3 inline-flex rounded-full bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-slate-300">
                {tag}
              </span>
              {response ? (
                <div className="mt-4 border-t border-white/[0.06] pt-3">
                  <HighlightedText text={response} />
                </div>
              ) : null}
            </div>
            {timestamp ? (
              <span className="mt-1 pl-2 text-[11px] font-medium text-zinc-500/80">
                {formatMessageTime(timestamp)}
              </span>
            ) : null}
          </div>
        </div>
      );
    }

    if (type === "reminder" && (data?.task || data?.time)) {
      return (
        <div className="animate-message-in flex justify-start">
          <div className="flex flex-col items-start">
            <div className="glass-panel max-w-[min(100%,42rem)] rounded-2xl px-4 py-4">
              <div className="mb-2 flex items-center gap-2 text-sm text-slate-400">
                <span aria-hidden>⏰</span>
                <span>Reminder</span>
              </div>
              {data.task ? (
                <p className="text-[15px] font-medium text-white">{data.task}</p>
              ) : null}
              {data.time ? (
                <p className="mt-1 text-sm text-slate-400">{data.time}</p>
              ) : null}
              {response ? (
                <div className="mt-3 border-t border-white/[0.06] pt-3">
                  <HighlightedText text={response} />
                </div>
              ) : null}
            </div>
            {timestamp ? (
              <span className="mt-1 pl-2 text-[11px] font-medium text-zinc-500/80">
                {formatMessageTime(timestamp)}
              </span>
            ) : null}
          </div>
        </div>
      );
    }

    if (type === "memory" && (data?.content || (data?.tags && data.tags.length))) {
      return (
        <div className="animate-message-in flex justify-start">
          <div className="flex flex-col items-start">
            <div className="glass-panel max-w-[min(100%,42rem)] rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-4">
              <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
                <span aria-hidden>🧠</span>
                <span>Memory</span>
              </div>
              {data?.content ? (
                <p className="text-[15px] leading-relaxed text-slate-200">
                  {data.content}
                </p>
              ) : null}
              {data?.tags && data.tags.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {data.tags.map((t: string) => (
                    <span
                      key={t}
                      className="rounded-md bg-white/[0.05] px-2 py-0.5 text-xs text-slate-400"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              ) : null}
              {response ? (
                <div className="mt-3 border-t border-white/[0.06] pt-3">
                  <HighlightedText text={response} />
                </div>
              ) : null}
            </div>
            {timestamp ? (
              <span className="mt-1 pl-2 text-[11px] font-medium text-zinc-500/80">
                {formatMessageTime(timestamp)}
              </span>
            ) : null}
          </div>
        </div>
      );
    }

    /* query, unknown, or structured fallbacks */
    return (
      <div className="animate-message-in flex justify-start">
        <div className="flex flex-col items-start">
          <div className="glass-panel max-w-[min(100%,42rem)] rounded-2xl px-4 py-3">
            <HighlightedText text={response} />
          </div>
          {timestamp ? (
            <span className="mt-1 pl-2 text-[11px] font-medium text-zinc-500/80">
              {formatMessageTime(timestamp)}
            </span>
          ) : null}
        </div>
      </div>
    );
  }

  return null;
}
