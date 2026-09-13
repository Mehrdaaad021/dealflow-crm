import { redirect } from "next/navigation";

import { AppShell } from "~/app/_components/app-shell";
import { auth } from "~/server/auth";
import { api } from "~/trpc/server";

import { CompanyWorkspace } from "./company-workspace";

export default async function CompanyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  try {
    await api.companies.byId({ id: Number(id) });
  } catch {
    redirect("/companies");
  }

  return (
    <AppShell user={session.user}>
      <CompanyWorkspace companyId={Number(id)} />
    </AppShell>
  );
}
