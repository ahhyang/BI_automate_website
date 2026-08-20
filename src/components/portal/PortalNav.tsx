"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function PortalNav({
  email,
  isGuest,
}: {
  email: string | null;
  isGuest: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <header className="border-b border-line/80">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <Link href="/" className="font-display text-xl tracking-tight">
          Siteform
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/dashboard" className="hover:underline">
            Dashboard
          </Link>
          <Link href="/billing" className="hover:underline">
            Billing
          </Link>
          {isGuest ? (
            <Link href="/signup?next=/dashboard" className="rounded-full bg-ink px-3 py-1.5 text-paper">
              Save your site
            </Link>
          ) : (
            <span className="text-ink-soft">{email}</span>
          )}
          {!isGuest ? (
            <button
              className="text-ink-soft hover:text-ink"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await fetch("/api/auth/logout", { method: "POST" });
                  router.push("/");
                  router.refresh();
                })
              }
            >
              Log out
            </button>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
