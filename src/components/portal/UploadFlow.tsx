"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { TemplateId } from "@/types/content";
import { Button } from "@/components/ui/Button";
import { ErrorNote } from "@/components/ui/Field";
import { UpgradePrompt } from "./UpgradePrompt";

type Progress =
  | "idle"
  | "reading"
  | "extracting"
  | "generating"
  | "done";

const GEN_STEPS = [
  { key: "copy", label: "Writing homepage copy" },
  { key: "structure", label: "Building page structure" },
  { key: "colors", label: "Applying brand colors" },
  { key: "provision", label: "Provisioning your site" },
  { key: "ready", label: "Preview ready" },
];

export function UploadFlow() {
  const router = useRouter();
  const [logo, setLogo] = useState<File | null>(null);
  const [doc, setDoc] = useState<File | null>(null);
  const [pasted, setPasted] = useState("");
  const [questions, setQuestions] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [templateId, setTemplateId] = useState<TemplateId>("classic");
  const [q, setQ] = useState({
    companyName: "",
    oneLiner: "",
    audience: "",
    offerings: "",
    contact: "",
  });
  const [progress, setProgress] = useState<Progress>("idle");
  const [genSteps, setGenSteps] = useState(
    GEN_STEPS.map((s) => ({ ...s, status: "pending" as "pending" | "running" | "done" | "failed" })),
  );
  const [error, setError] = useState("");
  const [upgrade, setUpgrade] = useState<"site_limit" | null>(null);

  const logoUrl = useMemo(() => (logo ? URL.createObjectURL(logo) : null), [logo]);
  useEffect(() => {
    return () => {
      if (logoUrl) URL.revokeObjectURL(logoUrl);
    };
  }, [logoUrl]);

  const canStart =
    progress === "idle" &&
    (Boolean(doc) || Boolean(pasted.trim()) || (questions && q.companyName && q.oneLiner));

  async function runPipeline(opts?: { docFile?: File | null; logoFile?: File | null }) {
    const nextDoc = opts?.docFile !== undefined ? opts.docFile : doc;
    const nextLogo = opts?.logoFile !== undefined ? opts.logoFile : logo;
    if (!nextDoc && !pasted.trim() && !questions) {
      setError("Drop a PDF (or paste text / answer the questions) to generate your site.");
      return;
    }

    setError("");
    setProgress("reading");
    setGenSteps(GEN_STEPS.map((s) => ({ ...s, status: "pending" })));

    const form = new FormData();
    if (nextLogo) form.set("logo", nextLogo);
    if (nextDoc) form.set("doc", nextDoc);
    if (pasted) form.set("pasted", pasted);

    const uploadRes = await fetch("/api/upload", { method: "POST", body: form });
    const uploadJson = (await uploadRes.json()) as {
      siteId?: string;
      parsedText?: string;
      brandColor?: string;
      error?: string;
      reason?: string;
    };
    if (!uploadRes.ok || !uploadJson.siteId) {
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
          : {
              siteId: uploadJson.siteId,
              text: uploadJson.parsedText || pasted,
              brandColor: uploadJson.brandColor,
            },
      ),
    });
    const extractJson = (await extractRes.json()) as { error?: string };
    if (!extractRes.ok) {
      setProgress("idle");
      setError(extractJson.error || "We couldn't extract details. Try the five questions instead.");
      return;
    }

    setProgress("generating");
    setGenSteps((prev) => prev.map((s, i) => ({ ...s, status: i === 0 ? "running" : "pending" })));
    const genRes = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siteId: uploadJson.siteId,
        mode: "template",
        templateId,
      }),
    });
    if (!genRes.ok || !genRes.body) {
      setProgress("idle");
      const err = (await genRes.json().catch(() => ({}))) as { error?: string };
      setError(err.error || "Generation didn't start. Try again.");
      return;
    }

    const reader = genRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finished = false;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() || "";
      for (const chunk of chunks) {
        const event = chunk.match(/^event: (.+)$/m)?.[1];
        const dataLine = chunk.match(/^data: (.+)$/m)?.[1];
        if (!event || !dataLine) continue;
        if (event === "steps") {
          try {
            setGenSteps(JSON.parse(dataLine));
          } catch {
            /* ignore */
          }
        }
        if (event === "error") {
          const data = JSON.parse(dataLine) as { message?: string };
          setError(data.message || "Generation didn't finish. Try again.");
          setProgress("idle");
          return;
        }
        if (event === "done") {
          finished = true;
          setProgress("done");
          router.push(`/sites/${uploadJson.siteId}/preview`);
        }
      }
    }
    if (!finished) {
      setProgress("idle");
      setError("Generation stopped early. Try again.");
    }
  }

  function onDocDropped(file: File) {
    setDoc(file);
    setQuestions(false);
    void runPipeline({ docFile: file });
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <p className="text-xs uppercase tracking-[0.2em] text-accent">Create a site</p>
      <h1 className="mt-3 font-display text-5xl">Drop a PDF. Get a website.</h1>
      <p className="mt-3 max-w-2xl text-ink-soft">
        We read the document, write the pages, and open a drag-and-drop editor so you can rearrange
        and rewrite anything.
      </p>

      <DropZone
        className="mt-8"
        accept=".pdf,.docx,.txt,application/pdf,text/plain"
        label={doc ? doc.name : "Drop your company PDF here"}
        hint="PDF, Word, or TXT · generation starts automatically"
        file={doc}
        large
        disabled={progress !== "idle"}
        onFile={(file) => {
          if (!file) {
            setDoc(null);
            return;
          }
          onDocDropped(file);
        }}
      />

      <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <DropZone
          accept="image/png,image/jpeg,image/svg+xml"
          label={logo ? logo.name : "Optional logo"}
          hint="PNG, JPG, or SVG"
          file={logo}
          disabled={progress !== "idle"}
          onFile={setLogo}
        >
          {logoUrl ? (
            <div className="mt-3 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt="" className="h-12 w-12 rounded-full border border-line bg-white object-contain p-1" />
              <p className="text-xs text-ink-soft">Used in the navbar and favicon</p>
            </div>
          ) : null}
        </DropZone>
        <Button
          className="sm:mb-1"
          onClick={() => void runPipeline()}
          disabled={!canStart}
        >
          {progress === "idle" ? "Generate site" : "Working…"}
        </Button>
      </div>

      {progress !== "idle" ? (
        <ol className="mt-8 space-y-2 rounded-3xl border border-line bg-white p-5 text-sm">
          <li className="flex gap-2">
            <span>{progress === "reading" ? "●" : "✓"}</span>
            Reading your document…
          </li>
          <li className="flex gap-2">
            <span>
              {progress === "extracting" ? "●" : progress === "reading" ? "○" : "✓"}
            </span>
            Extracting company details…
          </li>
          {genSteps.map((step) => (
            <li key={step.key} className="flex gap-2">
              <span>
                {progress !== "generating" && progress !== "done"
                  ? "○"
                  : step.status === "done"
                    ? "✓"
                    : step.status === "running"
                      ? "●"
                      : "○"}
              </span>
              {step.label}
            </li>
          ))}
        </ol>
      ) : null}

      <button
        type="button"
        className="mt-6 text-sm underline"
        onClick={() => setAdvanced((v) => !v)}
      >
        {advanced ? "Hide other options" : "Paste text, questions, or pick a template"}
      </button>

      {advanced ? (
        <div className="mt-4 space-y-4 rounded-3xl border border-line bg-white p-5">
          <label className="block text-sm">
            Or paste the text
            <textarea
              className="mt-1.5 min-h-28 w-full rounded-2xl border border-line bg-paper p-3 text-sm"
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              placeholder="About us, services, contact…"
              disabled={progress !== "idle"}
            />
          </label>

          <label className="block text-sm">
            Starting template
            <select
              className="mt-1.5 w-full rounded-xl border border-line px-3 py-2"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value as TemplateId)}
              disabled={progress !== "idle"}
            >
              <option value="classic">Classic</option>
              <option value="modern">Modern</option>
              <option value="bold">Bold</option>
              <option value="editorial">Editorial</option>
            </select>
          </label>

          <button
            type="button"
            className="text-sm underline"
            onClick={() => setQuestions((v) => !v)}
          >
            {questions ? "Hide questions" : "Or answer 5 quick questions instead"}
          </button>

          {questions ? (
            <div className="grid gap-3">
              {(
                [
                  ["companyName", "Company name"],
                  ["oneLiner", "What do you do, in one sentence?"],
                  ["audience", "Who do you serve?"],
                  ["offerings", "List 3 services or products"],
                  ["contact", "How should people reach you?"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="text-sm">
                  {label}
                  <input
                    className="mt-1 w-full rounded-xl border border-line px-3 py-2"
                    value={q[key]}
                    onChange={(e) => setQ({ ...q, [key]: e.target.value })}
                    disabled={progress !== "idle"}
                  />
                </label>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div className="mt-4">
          <ErrorNote
            message={error}
            action="You can paste the text, switch to the five questions, or try again."
          />
        </div>
      ) : null}

      {upgrade ? <UpgradePrompt reason={upgrade} onClose={() => setUpgrade(null)} /> : null}
    </div>
  );
}

function DropZone({
  label,
  hint,
  accept,
  file,
  onFile,
  children,
  large,
  className = "",
  disabled,
}: {
  label: string;
  hint: string;
  accept: string;
  file: File | null;
  onFile: (file: File | null) => void;
  children?: React.ReactNode;
  large?: boolean;
  className?: string;
  disabled?: boolean;
}) {
  const [over, setOver] = useState(false);

  function takeFiles(list: FileList | null) {
    const next = list?.[0] || null;
    onFile(next);
  }

  return (
    <label
      className={`block cursor-pointer rounded-3xl border border-dashed transition ${
        over ? "border-accent bg-accent/5" : "border-line bg-white"
      } ${large ? "px-6 py-14 text-center" : "p-5"} ${disabled ? "pointer-events-none opacity-60" : ""} ${className}`}
      onDragEnter={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        takeFiles(e.dataTransfer.files);
      }}
    >
      <span className={`block font-medium ${large ? "font-display text-2xl" : "text-sm"}`}>
        {label}
      </span>
      <span className={`mt-1 block text-ink-soft ${large ? "text-sm" : "text-xs"}`}>{hint}</span>
      <input
        type="file"
        accept={accept}
        className="sr-only"
        disabled={disabled}
        onChange={(e) => takeFiles(e.target.files)}
      />
      {!file && !large ? (
        <p className="mt-2 text-sm text-ink-soft">Drop a file or click to browse</p>
      ) : null}
      {large && !file ? (
        <p className="mt-4 text-xs uppercase tracking-[0.18em] text-ink-soft">or click to browse</p>
      ) : null}
      {children}
    </label>
  );
}
