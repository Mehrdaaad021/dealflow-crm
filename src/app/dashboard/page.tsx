import { redirect } from "next/navigation";

import { auth } from "~/server/auth";
import { AppShell } from "~/app/_components/app-shell";
import { DashboardView } from "./dashboard-view";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <AppShell user={session.user}>
      <div className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8">
        <DashboardView />
      </div>
    </AppShell>
  );
}
