"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ErrorNote } from "@/components/ui/Field";
import { UpgradePrompt } from "./UpgradePrompt";

type Progress = "idle" | "reading" | "extracting";

export function UploadFlow() {
  const router = useRouter();
  const [logo, setLogo] = useState<File | null>(null);
  const [doc, setDoc] = useState<File | null>(null);
  const [pasted, setPasted] = useState("");
  const [questions, setQuestions] = useState(false);
  const [q, setQ] = useState({
    companyName: "",
    oneLiner: "",
    audience: "",
    offerings: "",
    contact: "",
  });
  const [progress, setProgress] = useState<Progress>("idle");
  const [error, setError] = useState("");
  const [upgrade, setUpgrade] = useState<"site_limit" | null>(null);

  const logoUrl = useMemo(() => (logo ? URL.createObjectURL(logo) : null), [logo]);

  async function submit() {
    setError("");
    setProgress("reading");
    const form = new FormData();
    if (logo) form.set("logo", logo);
    if (doc) form.set("doc", doc);
    if (pasted) form.set("pasted", pasted);

    const uploadRes = await fetch("/api/upload", { method: "POST", body: form });
    const uploadJson = (await uploadRes.json()) as {
      siteId?: string;
      parsedText?: string;
      brandColor?: string;
      error?: string;
      reason?: string;
    };
    if (!uploadRes.ok) {
      setProgress("idle");
      if (uploadJson.reason === "site_limit") {
        setUpgrade("site_limit");
        return;
      }
      setError(uploadJson.error || "Upload didn't work. Try a smaller file or paste the text.");
      return;
    }

    setProgress("extracting");
    const extractRes = await fetch("/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        questions
          ? { siteId: uploadJson.siteId, brandColor: uploadJson.brandColor, questions: q }
          : { siteId: uploadJson.siteId, text: uploadJson.parsedText || pasted, brandColor: uploadJson.brandColor },
      ),
    });
    const extractJson = (await extractRes.json()) as { error?: string };
    setProgress("idle");
    if (!extractRes.ok) {
      setError(extractJson.error || "We couldn't extract details. Try the five questions instead.");
      return;
    }
    router.push(`/sites/${uploadJson.siteId}/extract`);
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-10">
      <p className="text-xs uppercase tracking-[0.2em] text-accent">Step 1 · Upload</p>
      <h1 className="mt-3 font-display text-5xl">Logo and company story.</h1>
      <p className="mt-3 max-w-2xl text-ink-soft">
        A document is ideal. If you do not have one, answer five questions — never a dead end.
      </p>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <Drop
          label="Logo"
          accept="image/png,image/jpeg,image/svg+xml"
          hint="PNG, SVG, or JPG"
          file={logo}
          onFile={setLogo}
        >
          {logoUrl ? (
            <div className="mt-4 flex items-center gap-6">
              <div className="h-20 w-20 overflow-hidden rounded-full border border-line bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoUrl} alt="" className="h-full w-full object-contain p-2" />
              </div>
              <div className="h-16 w-16 overflow-hidden rounded-lg border border-line bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoUrl} alt="" className="h-full w-full object-contain p-1" />
              </div>
              <p className="text-xs text-ink-soft">Navbar circle · favicon square</p>
            </div>
          ) : null}
        </Drop>
        <Drop
          label="Company document"
          accept=".pdf,.docx,.txt,application/pdf,text/plain"
          hint="PDF, DOCX, or TXT"
          file={doc}
          onFile={setDoc}
        />
      </div>

      <label className="mt-5 block">
        <span className="text-sm font-medium">Or paste the text</span>
        <textarea
          className="mt-1.5 min-h-28 w-full rounded-2xl border border-line bg-white p-3 text-sm"
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          placeholder="About us, services, contact…"
        />
      </label>

      <button
        type="button"
        className="mt-4 text-sm underline"
        onClick={() => setQuestions((v) => !v)}
      >
        {questions ? "Hide questions" : "Or just answer 5 quick questions instead"}
      </button>

      {questions ? (
        <div className="mt-4 grid gap-3 rounded-3xl border border-line bg-white p-5">
          {[
            ["companyName", "Company name"],
            ["oneLiner", "What do you do, in one sentence?"],
            ["audience", "Who do you serve?"],
            ["offerings", "List 3 services or products"],
            ["contact", "How should people reach you?"],
          ].map(([key, label]) => (
            <label key={key} className="text-sm">
              {label}
              <input
                className="mt-1 w-full rounded-xl border border-line px-3 py-2"
                value={q[key as keyof typeof q]}
                onChange={(e) => setQ({ ...q, [key]: e.target.value })}
              />
            </label>
          ))}
        </div>
      ) : null}

      {progress !== "idle" ? (
        <ol className="mt-6 space-y-2 text-sm">
          <li>{progress === "reading" ? "●" : "✓"} Reading your document…</li>
          <li>{progress === "extracting" ? "●" : "○"} Extracting company details…</li>
        </ol>
      ) : null}

      {error ? (
        <div className="mt-4">
          <ErrorNote message={error} action="You can paste the text or switch to the five questions." />
        </div>
      ) : null}

      <div className="mt-8">
        <Button
          onClick={submit}
          disabled={progress !== "idle" || (!logo && !doc && !pasted && !questions)}
        >
          {progress === "idle" ? "Continue" : "Working…"}
        </Button>
      </div>
      {upgrade ? <UpgradePrompt reason={upgrade} onClose={() => setUpgrade(null)} /> : null}
    </div>
  );
}

function Drop({
  label,
  hint,
  accept,
  file,
  onFile,
  children,
}: {
  label: string;
  hint: string;
  accept: string;
  file: File | null;
  onFile: (file: File | null) => void;
  children?: React.ReactNode;
}) {
  return (
    <label className="block cursor-pointer rounded-3xl border border-dashed border-line bg-white p-5">
      <span className="text-sm font-medium">{label}</span>
      <span className="mt-1 block text-xs text-ink-soft">{hint}</span>
      <input
        type="file"
        accept={accept}
        className="mt-3 block w-full text-sm"
        onChange={(e) => onFile(e.target.files?.[0] || null)}
      />
      {file ? <p className="mt-2 text-sm">{file.name}</p> : <p className="mt-2 text-sm text-ink-soft">Drop a file or browse</p>}
      {children}
    </label>
  );
}
