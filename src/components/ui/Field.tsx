export function ErrorNote({ message, action }: { message: string; action?: string }) {
  return (
    <div className="rounded-2xl border border-amber-800/20 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <p>{message}</p>
      {action ? <p className="mt-1 text-amber-900/80">{action}</p> : null}
    </div>
  );
}

export function Field({
  label,
  hint,
  uncertain,
  children,
}: {
  label: string;
  hint?: string;
  uncertain?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="flex items-center gap-2 text-sm font-medium">
        {label}
        {uncertain ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-800">
            Please check
          </span>
        ) : null}
      </span>
      {hint ? <span className="mt-0.5 block text-xs text-ink-soft">{hint}</span> : null}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none ring-accent/30 focus:ring-2";
