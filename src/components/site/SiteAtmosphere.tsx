"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { ThemeSettings } from "@/types/content";

/** Cursor glow + section reveal animations for published/preview sites. */
export function SiteAtmosphere({
  theme,
  children,
}: {
  theme: ThemeSettings;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const motion = theme.motion || "lively";
  const cursorGlow = theme.cursorGlow !== false && motion !== "off";

  useEffect(() => {
    const root = rootRef.current;
    if (!root || motion === "off") return;

    const sections = root.querySelectorAll(".sf-hero, .sf-section, .sf-cta, .sf-footer");
    sections.forEach((el) => el.classList.add("sf-reveal"));

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) entry.target.classList.add("sf-reveal-in");
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    sections.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [motion]);

  useEffect(() => {
    if (!cursorGlow) return;
    const glow = glowRef.current;
    if (!glow) return;

    let raf = 0;
    let x = 0;
    let y = 0;
    let tx = 0;
    let ty = 0;

    const onMove = (e: PointerEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      if (!raf) {
        raf = requestAnimationFrame(() => {
          x += (tx - x) * 0.18;
          y += (ty - y) * 0.18;
          glow.style.transform = `translate(${x - 180}px, ${y - 180}px)`;
          raf = 0;
        });
      }
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [cursorGlow]);

  const motionClass =
    motion === "off" ? "motion-off" : motion === "subtle" ? "motion-subtle" : "motion-lively";

  return (
    <div ref={rootRef} className={`sf-atmosphere ${motionClass}`}>
      {cursorGlow ? <div ref={glowRef} className="sf-cursor-glow" aria-hidden /> : null}
      {children}
    </div>
  );
}
