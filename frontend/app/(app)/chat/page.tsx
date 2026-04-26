import { ChatBox } from "@/components/ChatBox";
import { VantaBackground } from "@/components/VantaBackground";

export default function ChatPage() {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <VantaBackground />
      <div className="border-b border-white/[0.06] px-6 py-5 md:px-10 shrink-0 relative z-10">
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
