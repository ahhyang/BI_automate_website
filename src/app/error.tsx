"use client";

import { ButtonLink } from "@/components/ui/Button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const db = error.message.includes("DATABASE_URL") || error.message.toLowerCase().includes("connect");
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5">
      <h1 className="font-display text-4xl">{db ? "The database isn’t connected yet" : "Something went sideways"}</h1>
      <p className="mt-3 text-ink-soft">
        {db
          ? "Copy .env.example to .env.local, start Postgres with docker compose up -d, then run npm run db:push."
          : "That’s on us — try again, or go back to the dashboard. Your content was not deleted."}
      </p>
      <div className="mt-6 flex gap-3">
        <button className="rounded-full bg-ink px-5 py-2.5 text-sm text-paper" onClick={reset}>
          Try again
        </button>
        <ButtonLink href="/" variant="ghost">
          Home
        </ButtonLink>
      </div>
    </div>
  );
}
