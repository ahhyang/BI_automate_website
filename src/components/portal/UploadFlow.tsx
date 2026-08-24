"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { LinksInput, MediaItem, TemplateId } from "@/types/content";
import { Button } from "@/components/ui/Button";
import { ErrorNote, Field, inputClass } from "@/components/ui/Field";
import { UpgradePrompt } from "./UpgradePrompt";

type Progress = "idle" | "reading" | "extracting" | "generating" | "done";

const GEN_STEPS = [
  { key: "copy", label: "Writing homepage copy" },
  { key: "structure", label: "Building page structure" },
  { key: "colors", label: "Applying brand colors" },
  { key: "provision", label: "Provisioning your site" },
  { key: "ready", label: "Preview ready" },
];

const EMPTY_LINKS: LinksInput = {
  email: "",
  phone: "",
  whatsapp: "",
  website: "",
  linkedin: "",
  twitter: "",
  facebook: "",
  instagram: "",
  youtube: "",
  tiktok: "",
  telegram: "",
};

/** Vercel hobby body limit ~4.5MB — warn before upload stalls. */
const WARN_BYTES = 4 * 1024 * 1024;
const HARD_BYTES = 4.5 * 1024 * 1024;

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function progressPercent(
  progress: Progress,
  genSteps: { status: string }[],
): number {
  if (progress === "idle") return 0;
  if (progress === "reading") return 12;
  if (progress === "extracting") return 35;
  if (progress === "done") return 100;
  const done = genSteps.filter((s) => s.status === "done").length;
  const running = genSteps.some((s) => s.status === "running") ? 0.5 : 0;
  return Math.min(95, 45 + ((done + running) / genSteps.length) * 50);
}

function statusHeadline(progress: Progress, genSteps: { key: string; label: string; status: string }[]) {
  if (progress === "reading") return "Uploading your files and links…";
  if (progress === "extracting") return "Reading the document and extracting company details…";
  if (progress === "generating") {
    const running = genSteps.find((s) => s.status === "running");
    return running ? `${running.label}…` : "Generating your website…";
  }
  if (progress === "done") return "Preview ready — opening editor…";
  return "";
}

export function UploadFlow() {
  const router = useRouter();
  const abortRef = useRef<AbortController | null>(null);
  const [logo, setLogo] = useState<File | null>(null);
  const [docs, setDocs] = useState<File[]>([]);
  const [media, setMedia] = useState<File[]>([]);
  const [links, setLinks] = useState<LinksInput>(EMPTY_LINKS);
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
  const [statusDetail, setStatusDetail] = useState("");
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

  const hasLinks = Object.values(links).some((v) => v.trim());
  const canStart =
    progress === "idle" &&
    (docs.length > 0 ||
      media.length > 0 ||
      Boolean(pasted.trim()) ||
      hasLinks ||
      (questions && q.companyName && q.oneLiner));

  const percent = progressPercent(progress, genSteps);
  const headline = statusHeadline(progress, genSteps);

  function addDocs(files: FileList | File[] | null) {
    if (!files) return;
    const next = Array.from(files);
    const tooBig = next.find((f) => f.size > HARD_BYTES);
    if (tooBig) {
      setError(
        `${tooBig.name} is ${formatBytes(tooBig.size)}. Max upload is ~4.5 MB on this host. Use a smaller PDF or paste the text.`,
      );
      return;
    }
    setError("");
    setDocs((prev) => [...prev, ...next].slice(0, 12));
  }

  function addMedia(files: FileList | File[] | null) {
    if (!files) return;
    const next = Array.from(files);
    const tooBig = next.find((f) => f.size > HARD_BYTES);
    if (tooBig) {
      setError(`${tooBig.name} is too large (${formatBytes(tooBig.size)}). Max ~4.5 MB per file.`);
      return;
    }
    setError("");
    setMedia((prev) => [...prev, ...next].slice(0, 24));
  }

  function cancel() {
    abortRef.current?.abort();
    abortRef.current = null;
    setProgress("idle");
    setStatusDetail("");
    setError("Cancelled. You can change files and try again.");
  }

  async function runPipeline() {
    if (
      !docs.length &&
      !media.length &&
      !pasted.trim() &&
      !hasLinks &&
      !(questions && q.companyName)
    ) {
      setError("Add a PDF, photos, videos, links, or paste text first.");
      return;
    }

    const oversized = [...docs, ...media, ...(logo ? [logo] : [])].find((f) => f.size > HARD_BYTES);
    if (oversized) {
      setError(
        `${oversized.name} is ${formatBytes(oversized.size)}. Please use a file under 4.5 MB, or paste text instead.`,
      );
      return;
    }

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setError("");
    setProgress("reading");
    setStatusDetail(
      docs.length
        ? `Sending ${docs.map((d) => d.name).join(", ")}…`
        : "Sending your files and links…",
    );
    setGenSteps(GEN_STEPS.map((s) => ({ ...s, status: "pending" })));

    try {
      const form = new FormData();
      if (logo) form.set("logo", logo);
      for (const doc of docs) form.append("doc", doc);
      for (const file of media) form.append("media", file);
      if (pasted) form.set("pasted", pasted);
      form.set("links", JSON.stringify(links));

      const uploadTimer = window.setTimeout(() => ac.abort(), 90_000);
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: form,
        signal: ac.signal,
      });
      window.clearTimeout(uploadTimer);

      let uploadJson: {
        siteId?: string;
        parsedText?: string;
        brandColor?: string;
        media?: MediaItem[];
        links?: LinksInput;
        error?: string;
        reason?: string;
        warning?: string;
      } = {};
      const rawBody = await uploadRes.text();
      try {
        uploadJson = rawBody ? (JSON.parse(rawBody) as typeof uploadJson) : {};
      } catch {
        setProgress("idle");
        setError(
          uploadRes.status >= 500
            ? `Upload failed (server error ${uploadRes.status}). Try again, or paste the text instead.`
            : "Upload failed (invalid server response). Try a smaller PDF or paste text.",
        );
        return;
      }

      if (!uploadRes.ok || !uploadJson.siteId) {
        setProgress("idle");
        if (uploadJson.reason === "site_limit") {
          setUpgrade("site_limit");
          return;
        }
        setError(
          uploadJson.error ||
            `Upload didn't work (HTTP ${uploadRes.status}). Try a smaller file or paste the text.`,
        );
        return;
      }

      if (uploadJson.warning) setStatusDetail(uploadJson.warning);

      setProgress("extracting");
      setStatusDetail("AI is reading your company details from the document…");
      const extractRes = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ac.signal,
        body: JSON.stringify(
          questions
            ? {
                siteId: uploadJson.siteId,
                brandColor: uploadJson.brandColor,
                questions: q,
                links: uploadJson.links || links,
                media: uploadJson.media || [],
              }
            : {
                siteId: uploadJson.siteId,
                text: uploadJson.parsedText || pasted || `Document: ${docs[0]?.name || "upload"}`,
                brandColor: uploadJson.brandColor,
                links: uploadJson.links || links,
                media: uploadJson.media || [],
              },
        ),
      });
      const extractJson = (await extractRes.json().catch(() => ({}))) as { error?: string };
      if (!extractRes.ok) {
        setProgress("idle");
        setError(extractJson.error || "We couldn't extract details. Try pasting text or the five questions.");
        return;
      }

      setProgress("generating");
      setStatusDetail("Building your website sections…");
      setGenSteps((prev) => prev.map((s, i) => ({ ...s, status: i === 0 ? "running" : "pending" })));
      const genRes = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ac.signal,
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
              const steps = JSON.parse(dataLine) as typeof genSteps;
              setGenSteps(steps);
              const running = steps.find((s) => s.status === "running");
              if (running) setStatusDetail(running.label);
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
            setStatusDetail("Opening the editor…");
            router.push(`/sites/${uploadJson.siteId}/preview`);
          }
        }
      }
      if (!finished) {
        setProgress("idle");
        setError("Generation stopped early. Try again.");
      }
    } catch (err) {
      setProgress("idle");
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("Stopped. You can remove files or try again with a smaller PDF.");
        return;
      }
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong during upload. Try a smaller PDF or paste the text.",
      );
    } finally {
      abortRef.current = null;
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <p className="text-xs uppercase tracking-[0.2em] text-accent">Create a site</p>
      <h1 className="mt-3 font-display text-5xl">Drop everything you have.</h1>
      <p className="mt-3 max-w-2xl text-ink-soft">
        Add files, remove anything you don’t want, then click Generate. Keep PDFs under ~4.5 MB for
        reliable uploads.
      </p>

      <DropZone
        className="mt-8"
        accept=".pdf,.docx,.txt,application/pdf,text/plain"
        label={docs.length ? `${docs.length} document${docs.length > 1 ? "s" : ""} ready` : "Drop PDFs / Word docs"}
        hint="Company profile, brochure, menu — then click Generate (does not auto-start)"
        multiple
        large
        disabled={progress !== "idle"}
        onFiles={addDocs}
      />
      {docs.length ? (
        <ul className="mt-2 space-y-1 text-sm">
          {docs.map((f) => (
            <li key={`${f.name}-${f.size}-${f.lastModified}`} className="flex items-center gap-2 text-ink-soft">
              <span className="min-w-0 flex-1 truncate">
                • {f.name}{" "}
                <span className="text-xs">({formatBytes(f.size)})</span>
                {f.size > WARN_BYTES ? (
                  <span className="ml-1 text-amber-800">· large — may be slow</span>
                ) : null}
              </span>
              <button
                type="button"
                className="shrink-0 text-xs underline"
                disabled={progress !== "idle"}
                onClick={() => setDocs((prev) => prev.filter((x) => x !== f))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <DropZone
          accept="image/*,video/*,.mp4,.webm,.mov,.png,.jpg,.jpeg,.webp,.gif"
          label={media.length ? `${media.length} media file${media.length > 1 ? "s" : ""}` : "Photos & videos"}
          hint="Max ~4.5 MB each on this host"
          multiple
          disabled={progress !== "idle"}
          onFiles={addMedia}
        />
        <DropZone
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          label={logo ? logo.name : "Logo (optional)"}
          hint="PNG, JPG, or SVG"
          disabled={progress !== "idle"}
          onFiles={(files) => setLogo(files?.[0] || null)}
        >
          {logoUrl ? (
            <div className="mt-3 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl}
                alt=""
                className="h-12 w-12 rounded-full border border-line bg-white object-contain p-1"
              />
              <button
                type="button"
                className="text-xs underline"
                disabled={progress !== "idle"}
                onClick={(e) => {
                  e.preventDefault();
                  setLogo(null);
                }}
              >
                Remove logo
              </button>
            </div>
          ) : null}
        </DropZone>
      </div>
      {media.length ? (
        <ul className="mt-2 max-h-28 space-y-1 overflow-auto text-sm text-ink-soft">
          {media.map((f) => (
            <li key={`${f.name}-${f.size}-${f.lastModified}`} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate">
                • {f.name} ({formatBytes(f.size)})
              </span>
              <button
                type="button"
                className="shrink-0 text-xs underline"
                disabled={progress !== "idle"}
                onClick={() => setMedia((prev) => prev.filter((x) => x !== f))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-6 rounded-3xl border border-line bg-white p-5">
        <h2 className="font-display text-2xl">Your links</h2>
        <p className="mt-1 text-sm text-ink-soft">
          WhatsApp, Gmail, Instagram, Facebook — paste handles or full URLs.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {(
            [
              ["email", "Gmail / email"],
              ["whatsapp", "WhatsApp (number or wa.me)"],
              ["phone", "Phone"],
              ["website", "Website"],
              ["instagram", "Instagram"],
              ["facebook", "Facebook"],
              ["linkedin", "LinkedIn"],
              ["twitter", "X / Twitter"],
              ["youtube", "YouTube"],
              ["tiktok", "TikTok"],
              ["telegram", "Telegram"],
            ] as const
          ).map(([key, label]) => (
            <Field key={key} label={label}>
              <input
                className={inputClass}
                value={links[key]}
                disabled={progress !== "idle"}
                placeholder={key === "whatsapp" ? "+60123456789" : ""}
                onChange={(e) => setLinks({ ...links, [key]: e.target.value })}
              />
            </Field>
          ))}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button onClick={() => void runPipeline()} disabled={!canStart}>
          {progress === "idle" ? "Generate site" : "Working…"}
        </Button>
        {progress !== "idle" && progress !== "done" ? (
          <button type="button" className="text-sm underline" onClick={cancel}>
            Cancel
          </button>
        ) : null}
        <button
          type="button"
          className="text-sm underline"
          onClick={() => setAdvanced((v) => !v)}
        >
          {advanced ? "Hide other options" : "Paste text or pick a template"}
        </button>
      </div>

      {progress !== "idle" ? (
        <div className="mt-8 rounded-3xl border border-line bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-accent">Now</p>
              <p className="mt-1 font-display text-2xl">{headline}</p>
              {statusDetail ? <p className="mt-1 text-sm text-ink-soft">{statusDetail}</p> : null}
            </div>
            <p className="shrink-0 text-sm font-semibold tabular-nums">{Math.round(percent)}%</p>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-line/70">
            <div
              className="h-full rounded-full bg-ink transition-[width] duration-500 ease-out"
              style={{ width: `${percent}%` }}
            />
          </div>
          <ol className="mt-5 space-y-2 text-sm">
            <li className="flex gap-2">
              <span>{progress === "reading" ? "●" : "✓"}</span>
              Uploading files & links
            </li>
            <li className="flex gap-2">
              <span>
                {progress === "extracting" ? "●" : progress === "reading" ? "○" : "✓"}
              </span>
              Extracting company details
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
        </div>
      ) : null}

      {advanced ? (
        <div className="mt-4 space-y-4 rounded-3xl border border-line bg-white p-5">
          <label className="block text-sm">
            Or paste the text
            <textarea
              className="mt-1.5 min-h-28 w-full rounded-2xl border border-line bg-paper p-3 text-sm"
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
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
          <button type="button" className="text-sm underline" onClick={() => setQuestions((v) => !v)}>
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
          <ErrorNote message={error} action="Remove the file, use a smaller PDF, or paste the text below." />
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
  onFiles,
  children,
  large,
  className = "",
  disabled,
  multiple,
}: {
  label: string;
  hint: string;
  accept: string;
  onFiles: (files: FileList | null) => void;
  children?: React.ReactNode;
  large?: boolean;
  className?: string;
  disabled?: boolean;
  multiple?: boolean;
}) {
  const [over, setOver] = useState(false);

  return (
    <label
      className={`block cursor-pointer rounded-3xl border border-dashed transition ${
        over ? "border-accent bg-accent/5" : "border-line bg-white"
      } ${large ? "px-6 py-12 text-center" : "p-5"} ${disabled ? "pointer-events-none opacity-60" : ""} ${className}`}
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
        onFiles(e.dataTransfer.files);
      }}
    >
      <span className={`block font-medium ${large ? "font-display text-2xl" : "text-sm"}`}>{label}</span>
      <span className={`mt-1 block text-ink-soft ${large ? "text-sm" : "text-xs"}`}>{hint}</span>
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {large ? (
        <p className="mt-4 text-xs uppercase tracking-[0.18em] text-ink-soft">or click to browse</p>
      ) : (
        <p className="mt-2 text-sm text-ink-soft">Drop files or click</p>
      )}
      {children}
    </label>
  );
}
