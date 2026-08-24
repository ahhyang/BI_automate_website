"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type {
  FontPair,
  LayoutVariant,
  MotionLevel,
  SectionKey,
  SiteContentMap,
  SiteRenderModel,
  TemplateId,
  ThemeSettings,
} from "@/types/content";
import {
  DEFAULT_THEME,
  FONT_PAIRS,
  MOTION_LEVELS,
  TEMPLATE_IDS,
  TEMPLATE_META,
} from "@/types/content";
import { SiteRenderer } from "@/components/site/SiteRenderer";
import { Button } from "@/components/ui/Button";
import { ErrorNote } from "@/components/ui/Field";
import { SectionFields } from "./SectionFields";
import { UpgradePrompt } from "./UpgradePrompt";

const LABELS: Record<SectionKey, string> = {
  hero: "Hero",
  about: "About",
  services: "Services",
  products: "Products",
  gallery: "Gallery",
  testimonials: "Testimonials",
  cta: "Call to action",
  contact: "Contact",
  footer: "Footer",
};

type ChatMsg = { role: "user" | "assistant"; text: string };

export function PreviewEditor({
  siteId,
  initial,
  isGuest: _isGuest,
}: {
  siteId: string;
  initial: SiteRenderModel;
  isGuest: boolean;
}) {
  const router = useRouter();
  const [model, setModel] = useState({
    ...initial,
    theme: initial.theme || initial.company.siteTheme || DEFAULT_THEME,
  });
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [selected, setSelected] = useState<SectionKey>(initial.sectionOrder[0] || "hero");
  const [busy, setBusy] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const [regenBusy, setRegenBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [upgrade, setUpgrade] = useState<"regenerations" | "ai_custom" | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [chat, setChat] = useState<ChatMsg[]>([
    {
      role: "assistant",
      text: "Tell me what to change — e.g. “Make the hero shorter” or “Add a warmer tone to About”.",
    },
  ]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, chatBusy]);

  async function persistSection(key: SectionKey, content: SiteContentMap[SectionKey]) {
    setSaving(true);
    const res = await fetch("/api/sites", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteId, section: { key, content } }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Couldn't save that change. Try again.");
    }
  }

  function updateSection(key: SectionKey, content: SiteContentMap[SectionKey]) {
    setModel((prev) => ({
      ...prev,
      content: { ...prev.content, [key]: content },
    }));
    setError("");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void persistSection(key, content);
    }, 450);
  }

  async function persistOrder(order: SectionKey[]) {
    await fetch("/api/sites", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteId, sectionOrder: order }),
    });
  }

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = model.sectionOrder.indexOf(active.id as SectionKey);
    const newIndex = model.sectionOrder.indexOf(over.id as SectionKey);
    if (oldIndex < 0 || newIndex < 0) return;
    const order = arrayMove(model.sectionOrder, oldIndex, newIndex);
    setModel((prev) => ({ ...prev, sectionOrder: order }));
    await persistOrder(order);
  }

  async function regenerate() {
    setBusy(true);
    const current = model.content[selected];
    const res = await fetch("/api/regenerate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteId, sectionKey: selected, content: current }),
    });
    const jsonRes = (await res.json()) as {
      content?: SiteContentMap[SectionKey];
      reason?: string;
      error?: string;
    };
    setBusy(false);
    if (res.status === 402) {
      setUpgrade("regenerations");
      return;
    }
    if (!res.ok) {
      setError(jsonRes.error || "Couldn't regenerate that section. Edit the text instead.");
      return;
    }
    if (jsonRes.content) {
      setModel((prev) => ({
        ...prev,
        content: { ...prev.content, [selected]: jsonRes.content as never },
      }));
      await persistSection(selected, jsonRes.content);
    }
  }

  async function runIterate(instruction: string) {
    const trimmed = instruction.trim();
    if (!trimmed || chatBusy) return;
    setChatBusy(true);
    setError("");
    setChat((prev) => [...prev, { role: "user", text: trimmed }]);
    setChatInput("");

    const res = await fetch("/api/iterate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siteId,
        instruction: trimmed,
        focusSection: selected,
      }),
    });
    const json = (await res.json()) as {
      summary?: string;
      content?: SiteContentMap;
      sectionOrder?: SectionKey[];
      palette?: string[];
      layoutVariant?: LayoutVariant;
      error?: string;
      reason?: string;
    };
    setChatBusy(false);

    if (res.status === 402) {
      setUpgrade("regenerations");
      setChat((prev) => [
        ...prev,
        { role: "assistant", text: "You're out of regenerations this month. Upgrade to keep iterating." },
      ]);
      return;
    }
    if (!res.ok || !json.content) {
      setError(json.error || "Couldn't apply that change.");
      setChat((prev) => [
        ...prev,
        { role: "assistant", text: json.error || "That didn't work — try a clearer instruction." },
      ]);
      return;
    }

    setModel((prev) => ({
      ...prev,
      content: json.content!,
      sectionOrder: json.sectionOrder?.length ? json.sectionOrder : prev.sectionOrder,
      palette: json.palette?.length ? json.palette : prev.palette,
      layoutVariant: json.layoutVariant || prev.layoutVariant,
    }));
    setChat((prev) => [
      ...prev,
      { role: "assistant", text: json.summary || "Updated the site from your instruction." },
    ]);
  }

  async function regenerateWholeSite() {
    setRegenBusy(true);
    setError("");
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteId, mode: "ai_custom", templateId: model.templateId }),
    });
    if (!res.ok || !res.body) {
      setRegenBusy(false);
      const err = (await res.json().catch(() => ({}))) as { error?: string; reason?: string };
      if (res.status === 402 && err.reason === "ai_custom") {
        setUpgrade("ai_custom");
        return;
      }
      setError(err.error || "Whole-site regenerate didn't start.");
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let ok = false;
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
        if (event === "error") {
          const data = JSON.parse(dataLine) as { message?: string };
          setError(data.message || "Whole-site regenerate failed.");
        }
        if (event === "done") ok = true;
      }
    }
    setRegenBusy(false);
    if (ok) {
      router.refresh();
      window.location.reload();
    }
  }

  async function swapTemplate(templateId: TemplateId) {
    setModel((prev) => ({ ...prev, templateId }));
    await fetch("/api/sites", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteId, templateId }),
    });
  }

  async function patchTheme(partial: Partial<ThemeSettings> & { brandColor?: string }) {
    const nextTheme: ThemeSettings = {
      ...(model.theme || DEFAULT_THEME),
      fontPair: (partial.fontPair as FontPair) || model.theme?.fontPair || "auto",
      motion: (partial.motion as MotionLevel) || model.theme?.motion || "lively",
      cursorGlow:
        typeof partial.cursorGlow === "boolean"
          ? partial.cursorGlow
          : model.theme?.cursorGlow !== false,
    };
    const brandColor = partial.brandColor || model.brandColor;
    setModel((prev) => ({
      ...prev,
      brandColor,
      theme: nextTheme,
      company: { ...prev.company, brandColor, siteTheme: nextTheme },
    }));
    await fetch("/api/sites", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siteId,
        brandColor,
        theme: nextTheme,
      }),
    });
  }

  const theme = model.theme || DEFAULT_THEME;

  return (
    <div className="grid min-h-[70vh] lg:grid-cols-[360px_1fr]">
      <aside className="flex max-h-screen flex-col border-r border-line bg-white">
        <div className="border-b border-line p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-accent">Develop</p>
          <h1 className="mt-2 font-display text-3xl">Edit · chat · ship</h1>
          <p className="mt-1 text-xs text-ink-soft">
            {saving ? "Saving…" : "Autosave on. Use AI chat to iterate like v0."}
          </p>
          <div className="mt-4 flex gap-3 text-xs">
            <button
              type="button"
              className={device === "desktop" ? "underline" : ""}
              onClick={() => setDevice("desktop")}
            >
              Desktop
            </button>
            <button
              type="button"
              className={device === "mobile" ? "underline" : ""}
              onClick={() => setDevice("mobile")}
            >
              Mobile
            </button>
          </div>
          <label className="mt-3 block text-sm">
            Template
            <select
              className="mt-1 w-full rounded-xl border border-line px-2 py-2"
              value={model.templateId}
              onChange={(e) => void swapTemplate(e.target.value as TemplateId)}
            >
              {TEMPLATE_IDS.map((id) => (
                <option key={id} value={id}>
                  {TEMPLATE_META[id].label} — {TEMPLATE_META[id].blurb}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-3 space-y-2 rounded-2xl border border-line bg-paper/70 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">Customize look</p>
            <label className="block text-xs">
              Brand color
              <input
                type="color"
                className="mt-1 h-9 w-full cursor-pointer rounded-lg border border-line bg-white"
                value={model.brandColor?.startsWith("#") ? model.brandColor : "#1A1714"}
                onChange={(e) => void patchTheme({ brandColor: e.target.value })}
              />
            </label>
            <label className="block text-xs">
              Typography
              <select
                className="mt-1 w-full rounded-xl border border-line px-2 py-2 text-sm"
                value={theme.fontPair}
                onChange={(e) => void patchTheme({ fontPair: e.target.value as FontPair })}
              >
                {FONT_PAIRS.map((pair) => (
                  <option key={pair} value={pair}>
                    {pair === "auto" ? "Auto (match template)" : pair}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs">
              Motion
              <select
                className="mt-1 w-full rounded-xl border border-line px-2 py-2 text-sm"
                value={theme.motion}
                onChange={(e) => void patchTheme({ motion: e.target.value as MotionLevel })}
              >
                {MOTION_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={theme.cursorGlow !== false && theme.motion !== "off"}
                onChange={(e) => void patchTheme({ cursorGlow: e.target.checked })}
              />
              Cursor glow
            </label>
          </div>

          <div className="mt-3">
            <Button
              variant="ghost"
              className="w-full text-xs"
              disabled={regenBusy}
              onClick={() => void regenerateWholeSite()}
            >
              {regenBusy ? "Regenerating site…" : "Regenerate whole site (AI)"}
            </Button>
          </div>
        </div>

        <div className="border-b border-line p-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-soft">Sections</p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => void onDragEnd(e)}>
            <SortableContext items={model.sectionOrder} strategy={verticalListSortingStrategy}>
              <ul className="space-y-1">
                {model.sectionOrder.map((key) => (
                  <SortableSectionRow
                    key={key}
                    id={key}
                    label={LABELS[key]}
                    active={selected === key}
                    onSelect={() => setSelected(key)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <p className="mb-3 text-sm font-medium">{LABELS[selected]}</p>
          <SectionFields
            sectionKey={selected}
            value={model.content[selected]}
            onChange={(next) => updateSection(selected, next)}
          />
          {selected === "contact" ? (
            <div className="mt-5 space-y-3 border-t border-line pt-4">
              <p className="text-sm font-medium">Social & messaging links</p>
              {(
                [
                  ["instagram", "Instagram"],
                  ["facebook", "Facebook"],
                  ["linkedin", "LinkedIn"],
                  ["twitter", "X / Twitter"],
                  ["youtube", "YouTube"],
                  ["tiktok", "TikTok"],
                  ["telegram", "Telegram"],
                  ["whatsapp", "WhatsApp"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block text-sm">
                  {label}
                  <input
                    className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm"
                    value={model.company.social[key]}
                    onChange={(e) => {
                      const social = { ...model.company.social, [key]: e.target.value };
                      const company = {
                        ...model.company,
                        social,
                        contact: {
                          ...model.company.contact,
                          whatsapp: key === "whatsapp" ? e.target.value : model.company.contact.whatsapp,
                        },
                      };
                      setModel((prev) => ({ ...prev, company }));
                      if (saveTimer.current) clearTimeout(saveTimer.current);
                      saveTimer.current = setTimeout(() => {
                        void fetch("/api/sites", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ siteId, company }),
                        });
                      }, 450);
                    }}
                  />
                </label>
              ))}
            </div>
          ) : null}
          {selected === "gallery" && model.company.media.length ? (
            <div className="mt-5 space-y-3 border-t border-line pt-4">
              <p className="text-sm font-medium">Captions</p>
              {model.company.media.map((item, index) => (
                <label key={item.id} className="block text-sm">
                  {item.filename || item.kind}
                  <input
                    className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm"
                    value={item.caption}
                    onChange={(e) => {
                      const media = model.company.media.map((m, i) =>
                        i === index ? { ...m, caption: e.target.value } : m,
                      );
                      const company = { ...model.company, media };
                      setModel((prev) => ({ ...prev, company }));
                      if (saveTimer.current) clearTimeout(saveTimer.current);
                      saveTimer.current = setTimeout(() => {
                        void fetch("/api/sites", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ siteId, company }),
                        });
                      }, 450);
                    }}
                  />
                </label>
              ))}
            </div>
          ) : null}
          <div className="mt-4">
            <Button variant="ghost" onClick={() => void regenerate()} disabled={busy}>
              {busy ? "Rewriting…" : "Regenerate this section"}
            </Button>
          </div>
          {error ? (
            <div className="mt-3">
              <ErrorNote message={error} />
            </div>
          ) : null}
        </div>

        <div className="border-t border-line bg-paper/60 p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-soft">
            AI iterate · focused on {LABELS[selected]}
          </p>
          <div className="mb-2 max-h-28 space-y-2 overflow-auto text-xs">
            {chat.map((m, i) => (
              <p
                key={`${m.role}-${i}`}
                className={m.role === "user" ? "text-ink" : "rounded-lg bg-white px-2 py-1.5 text-ink-soft"}
              >
                {m.role === "user" ? `You: ${m.text}` : m.text}
              </p>
            ))}
            {chatBusy ? <p className="text-ink-soft">Thinking…</p> : null}
            <div ref={chatEndRef} />
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void runIterate(chatInput);
            }}
          >
            <input
              className="min-w-0 flex-1 rounded-xl border border-line bg-white px-3 py-2 text-sm"
              placeholder="e.g. Shorten the hero…"
              value={chatInput}
              disabled={chatBusy}
              onChange={(e) => setChatInput(e.target.value)}
            />
            <Button type="submit" disabled={chatBusy || !chatInput.trim()}>
              Apply
            </Button>
          </form>
        </div>

        <div className="space-y-2 border-t border-line p-4">
          <Button onClick={() => router.push(`/sites/${siteId}/project`)}>Project & publish</Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => router.push(`/sites/${siteId}/preview`)}
          >
            Back to Preview
          </Button>
          <p className="text-xs text-ink-soft">Free to test — no payment required.</p>
        </div>
      </aside>

      <div className="overflow-auto bg-[#ddd2bf] p-4">
        <div
          className={`mx-auto overflow-hidden rounded-2xl bg-white shadow ${
            device === "mobile" ? "max-w-[390px]" : "max-w-5xl"
          }`}
        >
          <SiteRenderer
            model={model}
            preview
            selectedSection={selected}
            onSelectSection={setSelected}
          />
        </div>
      </div>
      {upgrade ? <UpgradePrompt reason={upgrade} onClose={() => setUpgrade(null)} /> : null}
    </div>
  );
}

function SortableSectionRow({
  id,
  label,
  active,
  onSelect,
}: {
  id: SectionKey;
  label: string;
  active: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li ref={setNodeRef} style={style}>
      <div
        className={`flex items-center gap-2 rounded-xl border px-2 py-2 text-sm ${
          active ? "border-ink bg-paper" : "border-transparent hover:bg-paper/70"
        } ${isDragging ? "opacity-70 shadow" : ""}`}
      >
        <button
          type="button"
          className="cursor-grab touch-none px-1 text-ink-soft active:cursor-grabbing"
          aria-label={`Drag ${label}`}
          {...attributes}
          {...listeners}
        >
          ⋮⋮
        </button>
        <button type="button" className="flex-1 text-left" onClick={onSelect}>
          {label}
        </button>
      </div>
    </li>
  );
}
