import { redirect } from "next/navigation";

import { Card, CardContent } from "~/components/ui/card";
import { auth } from "~/server/auth";

import { DemoAccounts, LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await auth();

  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6 py-12">
      <div className="grid w-full max-w-4xl gap-8 lg:grid-cols-[1fr_420px] lg:items-center">
        <section className="space-y-5">
          <p className="text-sm font-semibold tracking-[0.2em] text-slate-500 uppercase">
            Dealflow CRM
          </p>
          <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
            A calmer way to move B2B opportunities forward.
          </h1>
          <p className="max-w-lg text-lg leading-8 text-slate-600">
            Manage the people, companies, conversations, and quotations behind
            every deal.
          </p>
          <Card className="max-w-sm border-slate-200 bg-white/70 shadow-none">
            <CardContent className="p-5">
              <DemoAccounts />
            </CardContent>
          </Card>
        </section>
        <LoginForm />
      </div>
    </main>
  );
}
