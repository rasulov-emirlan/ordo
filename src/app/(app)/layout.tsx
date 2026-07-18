import { requireUser } from "@/lib/auth";
import { Sidebar } from "@/components/Sidebar";
import { getDb } from "@/lib/db";
import { ensureSeeded } from "@/lib/bootstrap";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  ensureSeeded();
  const user = await requireUser();
  const pending = getDb()
    .prepare("SELECT COUNT(*) AS c FROM incidents WHERE status = 'pending'")
    .get() as { c: number };

  return (
    <div className="shell">
      <Sidebar userName={user.name} pendingIncidents={pending.c} />
      <main className="main">{children}</main>
    </div>
  );
}
