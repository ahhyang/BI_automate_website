"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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

export function UploadFlow() {
  const router = useRouter();
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

  function addDocs(files: FileList | File[] | null) {
    if (!files) return;
    const next = Array.from(files);
    setDocs((prev) => [...prev, ...next].slice(0, 12));
  }

  function addMedia(files: FileList | File[] | null) {
    if (!files) return;
    const next = Array.from(files);
    setMedia((prev) => [...prev, ...next].slice(0, 24));
  }

  async function runPipeline(opts?: { extraDocs?: File[] }) {
    const nextDocs = opts?.extraDocs ? [...docs, ...opts.extraDocs] : docs;
    if (
      !nextDocs.length &&
      !media.length &&
      !pasted.trim() &&
      !hasLinks &&
      !(questions && q.companyName)
    ) {
      setError("Drop a PDF, photos, videos, or add your WhatsApp / social links to continue.");
      return;
    }

    setError("");
    setProgress("reading");
    setGenSteps(GEN_STEPS.map((s) => ({ ...s, status: "pending" })));

    const form = new FormData();
    if (logo) form.set("logo", logo);
    for (const doc of nextDocs) form.append("doc", doc);
    for (const file of media) form.append("media", file);
    if (pasted) form.set("pasted", pasted);
    form.set("links", JSON.stringify(links));

    const uploadRes = await fetch("/api/upload", { method: "POST", body: form });
    const uploadJson = (await uploadRes.json()) as {
      siteId?: string;
      parsedText?: string;
      brandColor?: string;
      media?: MediaItem[];
      links?: LinksInput;
      error?: string;
      reason?: string;
    };
    if (!uploadRes.ok || !uploadJson.siteId) {
      setProgress("idle");
      if (uploadJson.reason === "site_limit") {
        setUpgrade("site_limit");
        return;
      }
      setError(uploadJson.error || "Upload didn't work. Try smaller files or paste the text.");
      return;
    }

    setProgress("extracting");
    const extractRes = await fetch("/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
              text: uploadJson.parsedText || pasted,
              brandColor: uploadJson.brandColor,
              links: uploadJson.links || links,
              media: uploadJson.media || [],
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

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <p className="text-xs uppercase tracking-[0.2em] text-accent">Create a site</p>
      <h1 className="mt-3 font-display text-5xl">Drop everything you have.</h1>
      <p className="mt-3 max-w-2xl text-ink-soft">
        PDFs, photos, videos, WhatsApp, Gmail, Instagram — add what you already use. We build the
        site, then you drag and edit.
      </p>

      <DropZone
        className="mt-8"
        accept=".pdf,.docx,.txt,application/pdf,text/plain"
        label={docs.length ? `${docs.length} document${docs.length > 1 ? "s" : ""} ready` : "Drop PDFs / Word docs"}
        hint="Company profile, brochure, menu — multiple files OK"
        multiple
        large
        disabled={progress !== "idle"}
        onFiles={(files) => {
          addDocs(files);
          if (files?.length) void runPipeline({ extraDocs: Array.from(files) });
        }}
      />
      {docs.length ? (
        <ul className="mt-2 space-y-1 text-sm text-ink-soft">
          {docs.map((f) => (
            <li key={`${f.name}-${f.size}`}>• {f.name}</li>
          ))}
        </ul>
      ) : null}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <DropZone
          accept="image/*,video/*,.mp4,.webm,.mov,.png,.jpg,.jpeg,.webp,.gif"
          label={media.length ? `${media.length} media file${media.length > 1 ? "s" : ""}` : "Photos & videos"}
          hint="Drag many at once · max 40MB each"
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
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt=""
              className="mt-3 h-12 w-12 rounded-full border border-line bg-white object-contain p-1"
            />
          ) : null}
        </DropZone>
      </div>
      {media.length ? (
        <ul className="mt-2 max-h-28 space-y-1 overflow-auto text-sm text-ink-soft">
          {media.map((f) => (
            <li key={`${f.name}-${f.size}`}>
              • {f.name}{" "}
              <button
                type="button"
                className="underline"
                onClick={() => setMedia((prev) => prev.filter((x) => x !== f))}
              >
                remove
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
        <button
          type="button"
          className="text-sm underline"
          onClick={() => setAdvanced((v) => !v)}
        >
          {advanced ? "Hide other options" : "Paste text or pick a template"}
        </button>
      </div>

      {progress !== "idle" ? (
        <ol className="mt-8 space-y-2 rounded-3xl border border-line bg-white p-5 text-sm">
          <li className="flex gap-2">
            <span>{progress === "reading" ? "●" : "✓"}</span>
            Uploading files & links…
          </li>
          <li className="flex gap-2">
            <span>{progress === "extracting" ? "●" : progress === "reading" ? "○" : "✓"}</span>
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
          <ErrorNote message={error} action="You can add links only, paste text, or try smaller files." />
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
        onChange={(e) => onFiles(e.target.files)}
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
