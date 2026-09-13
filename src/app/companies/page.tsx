import { redirect } from "next/navigation";

import { AppShell } from "~/app/_components/app-shell";
import { auth } from "~/server/auth";

import { CompaniesView } from "./companies-view";

export default async function CompaniesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <AppShell user={session.user}>
      <div className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8">
        <CompaniesView />
      </div>
    </AppShell>
  );
}
