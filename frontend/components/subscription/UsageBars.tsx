"use client";

type Bar = {
  label: string;
  used: number;
  total: number;
  icon: string;
};

export function UsageBars({ bars }: { bars: Bar[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {bars.map((bar) => {
        const pct = bar.total > 0 ? Math.min((bar.used / bar.total) * 100, 100) : 0;
        const color =
          pct > 80
            ? "from-rose-500 to-red-500"
            : pct > 60
              ? "from-amber-400 to-orange-500"
              : "from-cyan-400 to-teal-500";
        const bgColor =
          pct > 80
            ? "bg-rose-500/10 border-rose-500/20"
            : pct > 60
              ? "bg-amber-500/10 border-amber-500/20"
              : "bg-cyan-500/10 border-cyan-500/20";

        return (
          <div
            key={bar.label}
            className={`rounded-xl border p-4 transition-all ${bgColor}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">{bar.icon}</span>
                <span className="text-sm font-medium text-zinc-300">{bar.label}</span>
              </div>
              <span className="text-sm font-bold text-white">
                {bar.used}
                <span className="text-zinc-500"> / {bar.total}</span>
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-700 ease-out`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
