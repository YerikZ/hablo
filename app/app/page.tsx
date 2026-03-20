import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NewSessionForm } from "@/components/NewSessionForm";
import { LogoutButton } from "@/components/LogoutButton";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";

export default async function DashboardPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const [sessions, weaknesses] = await Promise.all([
    prisma.session.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { _count: { select: { messages: true } } }
    }),
    prisma.weaknessStat.findMany({
      where: { userId: user.id },
      orderBy: [{ count: "desc" }, { lastSeenAt: "desc" }],
      take: 5
    })
  ]);

  return (
    <main className="space-y-4">
      <div className="card flex items-center justify-between p-4">
        <div>
          <h1 className="text-2xl font-semibold">Welcome, {user.username}</h1>
          <p className="text-sm text-slate-600">Daily speaking practice dashboard</p>
        </div>
        <LogoutButton />
      </div>

      <NewSessionForm />
      <ResetPasswordForm />

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h2 className="mb-3 font-semibold">Recent sessions</h2>
          <div className="space-y-2">
            {sessions.length === 0 ? <p className="text-sm text-slate-600">No sessions yet.</p> : null}
            {sessions.map((session) => (
              <Link key={session.id} href={`/app/session/${session.id}`} className="block rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
                <p className="text-sm font-medium">{session.title}</p>
                <p className="text-xs text-slate-500">
                  {session.level} · {session.durationMinutes}m · {session._count.messages} messages
                </p>
              </Link>
            ))}
          </div>
        </div>

        <div className="card p-4">
          <h2 className="mb-3 font-semibold">Top weaknesses</h2>
          <div className="space-y-2">
            {weaknesses.length === 0 ? <p className="text-sm text-slate-600">No weaknesses tracked yet.</p> : null}
            {weaknesses.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-2">
                <span className="text-sm">{item.category}</span>
                <span className="text-sm font-medium">{item.count}</span>
              </div>
            ))}
          </div>
          <Link href="/app/flashcards" className="btn btn-outline mt-4 inline-block">
            Review flashcards
          </Link>
        </div>
      </section>
    </main>
  );
}
