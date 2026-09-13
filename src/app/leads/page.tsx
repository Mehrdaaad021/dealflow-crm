import { redirect } from "next/navigation";

import { AppShell } from "~/app/_components/app-shell";
import { auth } from "~/server/auth";

import { LeadsView } from "./leads-view";

export default async function LeadsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <AppShell user={session.user}>
      <LeadsView />
    </AppShell>
  );
}
