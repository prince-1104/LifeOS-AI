"use client";

import { useState } from "react";
import { useSession } from "@clerk/nextjs";
import { getUserDetailedUsage, type AdminUser, type UserDetailedUsageResponse } from "@/lib/admin-api";

type Props = {
  users: AdminUser[];
  loading: boolean;
};

export default function UsersTable({ users, loading }: Props) {
  const { session } = useSession();
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [userDetails, setUserDetails] = useState<UserDetailedUsageResponse | null>(null);

  const handleRowClick = async (user: AdminUser) => {
    if (!session) return;
    setSelectedUser(user);
    setDetailsLoading(true);
    setUserDetails(null);
    try {
      const getToken = async () => await session.getToken();
      const data = await getUserDetailedUsage(getToken, user.user_id, 30);
      setUserDetails(data);
    } catch (e) {
      console.error("Failed to load user details", e);
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeDetails = () => {
    setSelectedUser(null);
    setUserDetails(null);
  };

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
                    onClick={() => handleRowClick(user)}
                    className="border-b border-white/4 hover:bg-white/10 transition-colors cursor-pointer"
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

      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">
                User Details: {selectedUser.first_name || selectedUser.email || selectedUser.user_id.slice(0, 12)}
              </h3>
              <button 
                onClick={closeDetails}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 text-white transition-colors"
              >
                ×
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto">
              {detailsLoading ? (
                <div className="space-y-4">
                  <div className="h-4 w-32 bg-white/10 rounded animate-pulse" />
                  <div className="h-24 bg-white/5 rounded-xl animate-pulse" />
                  <div className="h-24 bg-white/5 rounded-xl animate-pulse" />
                </div>
              ) : userDetails ? (
                <div className="space-y-8">
                  {/* Category Usage Section */}
                  <div>
                    <h4 className="text-sm font-medium text-slate-400 mb-3 uppercase tracking-wider">Usage by Category (All time)</h4>
                    {userDetails.category_usage.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {userDetails.category_usage.map((cat, idx) => (
                          <div key={idx} className="bg-white/5 border border-white/10 rounded-xl p-4">
                            <div className="text-sm font-semibold text-white truncate mb-2" title={cat.category}>
                              {cat.category}
                            </div>
                            <div className="flex justify-between items-end">
                              <div>
                                <div className="text-xs text-slate-400">Tokens</div>
                                <div className="text-lg font-mono text-teal-400">{cat.total_tokens.toLocaleString()}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-xs text-slate-400">Requests</div>
                                <div className="text-sm font-mono text-slate-300">{cat.total_requests}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-slate-500 italic">No category usage data available.</div>
                    )}
                  </div>

                  {/* Daily Usage Section */}
                  <div>
                    <h4 className="text-sm font-medium text-slate-400 mb-3 uppercase tracking-wider">Daily Token Usage (Last 30 Days)</h4>
                    {userDetails.daily_usage.length > 0 ? (
                      <div className="border border-white/10 rounded-xl overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-white/5 border-b border-white/10">
                              <th className="text-left py-2 px-3 text-xs font-medium text-slate-400">Date</th>
                              <th className="text-right py-2 px-3 text-xs font-medium text-slate-400">Tokens</th>
                              <th className="text-right py-2 px-3 text-xs font-medium text-slate-400">Requests</th>
                              <th className="text-right py-2 px-3 text-xs font-medium text-slate-400">Cost</th>
                            </tr>
                          </thead>
                          <tbody>
                            {userDetails.daily_usage.map((day, idx) => (
                              <tr key={idx} className="border-b border-white/4 last:border-0 hover:bg-white/5">
                                <td className="py-2 px-3 text-slate-300">{day.date}</td>
                                <td className="py-2 px-3 text-right font-mono text-slate-300">{day.total_tokens.toLocaleString()}</td>
                                <td className="py-2 px-3 text-right font-mono text-slate-400">{day.total_requests}</td>
                                <td className="py-2 px-3 text-right font-mono text-emerald-400">${day.cost.toFixed(4)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-sm text-slate-500 italic">No recent daily usage data available.</div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-red-400">Failed to load user details.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
