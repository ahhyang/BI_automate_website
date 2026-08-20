"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ErrorNote, Field, inputClass } from "@/components/ui/Field";

export function AuthForm({
  mode,
  nextPath = "/dashboard",
}: {
  mode: "login" | "signup";
  nextPath?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    const form = new FormData(event.currentTarget);
    const res = await fetch(mode === "login" ? "/api/auth/login" : "/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
        name: form.get("name"),
      }),
    });
    const json = (await res.json()) as { error?: string };
    setPending(false);
    if (!res.ok) {
      setError(json.error || "Something went wrong. Try again.");
      return;
    }
    router.push(nextPath);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto w-full max-w-md space-y-4 rounded-3xl border border-line bg-white p-6">
      <h1 className="font-display text-4xl">{mode === "login" ? "Welcome back" : "Create your free account"}</h1>
      <p className="text-sm text-ink-soft">
        {mode === "signup"
          ? "No credit card. Needed only to publish and keep your site."
          : "Log in to your sites and billing."}
      </p>
      {mode === "signup" ? (
        <Field label="Name">
          <input name="name" className={inputClass} placeholder="Alex Rivera" />
        </Field>
      ) : null}
      <Field label="Email">
        <input name="email" type="email" required className={inputClass} />
      </Field>
      <Field label="Password" hint={mode === "signup" ? "At least 8 characters." : undefined}>
        <input name="password" type="password" required minLength={8} className={inputClass} />
      </Field>
      {error ? <ErrorNote message={error} /> : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
      </Button>
    </form>
  );
}
