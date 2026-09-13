"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

const demoAccounts = [
  "rep@dealflow.demo",
  "manager@dealflow.demo",
  "admin@dealflow.demo",
];

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState(demoAccounts[0]);
  const [password, setPassword] = useState("Demo1234!");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (!result || result.error) {
      setError("The email or password is incorrect.");
      setIsSubmitting(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <Card className="border-slate-200/80 bg-white/95 shadow-xl shadow-slate-900/5">
      <CardHeader>
        <CardTitle className="text-2xl text-slate-950">Welcome back</CardTitle>
        <CardDescription>Sign in to your Dealflow workspace.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          {error && (
            <p
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              role="alert"
            >
              {error}
            </p>
          )}
          <Button className="w-full" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function DemoAccounts() {
  return (
    <div className="rounded-lg border border-slate-300 bg-slate-50/80 p-4 text-sm text-slate-700">
      <p className="font-semibold text-slate-950">Demo accounts (DEMO DATA)</p>
      <div className="mt-3 space-y-1 font-mono text-xs">
        {demoAccounts.map((account) => (
          <p key={account}>{account}</p>
        ))}
      </div>
      <p className="mt-3">
        Shared password: <span className="font-mono">Demo1234!</span>
      </p>
    </div>
  );
}
