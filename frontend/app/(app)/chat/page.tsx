import { ChatBox } from "@/components/ChatBox";

export default function ChatPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-white/[0.06] px-6 py-5 md:px-10 shrink-0">
        <h1 className="text-xl font-semibold tracking-tight text-white">
          Chat
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Your personal assistant for life data.
        </p>
      </div>
      <ChatBox />
    </div>
  );
}
