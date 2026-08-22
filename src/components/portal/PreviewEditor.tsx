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
import type { SectionKey, SiteContentMap, SiteRenderModel, TemplateId } from "@/types/content";
import { TEMPLATE_IDS } from "@/types/content";
import { SiteRenderer } from "@/components/site/SiteRenderer";
import { Button, ButtonLink } from "@/components/ui/Button";
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

export function PreviewEditor({
  siteId,
  initial,
  isGuest,
}: {
  siteId: string;
  initial: SiteRenderModel;
  isGuest: boolean;
}) {
  const router = useRouter();
  const [model, setModel] = useState(initial);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [selected, setSelected] = useState<SectionKey>(initial.sectionOrder[0] || "hero");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [upgrade, setUpgrade] = useState<"regenerations" | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

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

  async function swapTemplate(templateId: TemplateId) {
    setModel((prev) => ({ ...prev, templateId }));
    await fetch("/api/sites", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteId, templateId }),
    });
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[340px_1fr]">
      <aside className="flex max-h-screen flex-col border-r border-line bg-white">
        <div className="border-b border-line p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-accent">Customize</p>
          <h1 className="mt-2 font-display text-3xl">Drag · edit · publish</h1>
          <p className="mt-1 text-xs text-ink-soft">
            {saving ? "Saving…" : "Changes autosave. Drag sections to reorder."}
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
                  {id}
                </option>
              ))}
            </select>
          </label>
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

        <div className="border-t border-line p-4">
          <Button
            onClick={() =>
              isGuest
                ? router.push(`/signup?next=/sites/${siteId}/publish`)
                : router.push(`/sites/${siteId}/publish`)
            }
          >
            Publish
          </Button>
          {isGuest ? (
            <p className="mt-2 text-xs text-ink-soft">Create a free account to publish and keep this site.</p>
          ) : (
            <div className="mt-3">
              <ButtonLink href={`/sites/${siteId}/publish`} variant="ghost">
                Continue to publish
              </ButtonLink>
            </div>
          )}
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
