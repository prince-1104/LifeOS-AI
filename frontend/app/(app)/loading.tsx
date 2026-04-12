export default function AppLoading() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b border-white/[0.06] px-6 py-5 md:px-10">
        <div className="h-6 w-32 animate-pulse rounded-lg bg-white/[0.06]" />
        <div className="mt-2 h-4 w-56 animate-pulse rounded-lg bg-white/[0.04]" />
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-10">
        <div className="mx-auto flex max-w-4xl flex-col gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-36 animate-pulse rounded-2xl bg-white/[0.02] border border-white/[0.04]"
              style={{ animationDelay: `${i * 100}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
