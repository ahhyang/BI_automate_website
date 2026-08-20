import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/portal/AuthForm";
import { getSession } from "@/lib/auth";
import type { Search } from "@/lib/page-props";
import { firstParam } from "@/lib/page-props";

export default async function SignupPage({ searchParams }: Search) {
  const session = await getSession();
  const next = firstParam((await searchParams).next) || "/dashboard";
  if (session && !session.isGuest) redirect(next);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5">
      <Link href="/" className="mb-8 font-display text-2xl">
        Siteform
      </Link>
      <AuthForm mode="signup" nextPath={next} />
      <p className="mt-4 text-sm text-ink-soft">
        Already have an account? <Link href={`/login?next=${encodeURIComponent(next)}`}>Log in</Link>
      </p>
    </div>
  );
}
