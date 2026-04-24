"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@clerk/nextjs";
import {
  getAllUsers,
  type AdminUser,
} from "@/lib/admin-api";
import UsersTable from "@/components/admin/UsersTable";

export default function AdminUsersPage() {
  const router = useRouter();
  const { session } = useSession();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      if (!session) return;
      try {
        const getToken = async () => await session.getToken();
        const data = await getAllUsers(getToken);
        const sortedData = [...data].sort((a, b) => b.total_tokens - a.total_tokens);
        setUsers(sortedData);
      } catch (err: any) {
        if (err.message?.includes("401") || err.message?.includes("admin")) {
          router.replace("/");
          return;
        }
        setError(err.message || "Failed to load user data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router, session]);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-white">User Analytics</h1>
        <p className="text-sm text-slate-400 mt-1">
          Per-user token usage, request counts, and costs
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      <UsersTable users={users} loading={loading} />
    </div>
  );
}
