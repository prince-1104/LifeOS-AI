"use client";

import type { AdminUser } from "@/lib/admin-api";

type Props = {
  users: AdminUser[];
  loading: boolean;
};

export default function UsersTable({ users, loading }: Props) {
  if (loading) {
    return (
      <div className="glass-panel rounded-2xl p-5">
        <h2 className="text-lg font-semibold text-white mb-4">Users</h2>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Users</h2>
        <span className="text-xs text-slate-500">{users.length} total</span>
      </div>

      {users.length === 0 ? (
        <div className="py-12 text-center text-slate-500 text-sm">
          No user data yet
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/6">
                <th className="text-left py-3 px-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                  User
                </th>
                <th className="text-left py-3 px-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Plan
                </th>
                <th className="text-right py-3 px-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Requests
                </th>
                <th className="text-right py-3 px-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Tokens
                </th>
                <th className="text-right py-3 px-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Cost
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, i) => {
                const displayName =
                  user.first_name || user.last_name
                    ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
                    : null;

                return (
                  <tr
                    key={user.user_id}
                    className="border-b border-white/4 hover:bg-white/3 transition-colors"
                  >
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white">
                          {(displayName || user.email || user.user_id)
                            .charAt(0)
                            .toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-white">
                            {displayName || user.user_id.slice(0, 12) + "…"}
                          </div>
                          {user.email && (
                            <div className="text-xs text-slate-500">
                              {user.email}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-left">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${
                        user.plan === 'free' || !user.plan
                          ? 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' 
                          : 'bg-teal-500/10 text-teal-400 border-teal-500/20'
                      }`}>
                        {(user.plan || "Free").toUpperCase().replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right text-slate-300 font-mono">
                      {user.total_requests.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-300 font-mono">
                      {user.total_tokens >= 1_000
                        ? `${(user.total_tokens / 1_000).toFixed(1)}K`
                        : user.total_tokens.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right font-mono">
                      <span className="text-emerald-400">
                        ${user.cost.toFixed(4)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
