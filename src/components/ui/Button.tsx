import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

const styles = {
  primary:
    "inline-flex items-center justify-center rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper transition hover:bg-black",
  accent:
    "inline-flex items-center justify-center rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-paper transition hover:bg-accent-dark",
  ghost:
    "inline-flex items-center justify-center rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-white/60",
  danger:
    "inline-flex items-center justify-center rounded-full bg-red-800 px-5 py-2.5 text-sm font-semibold text-white",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof styles }) {
  return <button className={`${styles[variant]} ${className}`} {...props} />;
}

export function ButtonLink({
  href,
  children,
  variant = "primary",
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: keyof typeof styles;
  className?: string;
}) {
  return (
    <Link href={href} className={`${styles[variant]} ${className}`}>
      {children}
    </Link>
  );
}
