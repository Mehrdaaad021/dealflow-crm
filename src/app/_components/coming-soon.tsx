import { Construction } from "lucide-react";
import { redirect } from "next/navigation";

import { AppShell } from "~/app/_components/app-shell";
import { Card, CardContent } from "~/components/ui/card";
import { auth } from "~/server/auth";

export async function ComingSoon({ title }: { title: string }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <AppShell user={session.user}>
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-[1500px] items-center justify-center px-5 py-8 sm:px-8">
        <Card className="w-full max-w-lg border-0 bg-white/80 text-center shadow-[0_12px_32px_rgba(42,55,45,0.06)]">
          <CardContent className="flex flex-col items-center px-6 py-16">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-[#edf2eb] text-[#26705b]">
              <Construction />
            </span>
            <p className="mt-5 text-xs font-semibold tracking-[0.18em] text-[#9a7a31] uppercase">
              Dealflow workspace
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-[#17342c]">
              {title}
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#718078]">
              This workspace is next in line. Your overview remains available
              from the sidebar.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
