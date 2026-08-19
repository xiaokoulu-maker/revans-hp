"use client";

import { useEffect } from "react";

export default function SiteMotion() {
  useEffect(() => {
    const root = document.documentElement;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(pointer: fine)");

    const onPointerMove = (event: PointerEvent) => {
      if (!finePointer.matches || reduceMotion.matches) return;
      const x = event.clientX;
      const y = event.clientY;
      const px = ((x / window.innerWidth) - 0.5) * 12;
      const py = ((y / window.innerHeight) - 0.5) * 12;
      root.style.setProperty("--cursor-x", `${x}px`);
      root.style.setProperty("--cursor-y", `${y}px`);
      root.style.setProperty("--parallax-x", `${px}px`);
      root.style.setProperty("--parallax-y", `${py}px`);
      root.style.setProperty("--parallax-x-reverse", `${-px}px`);
      root.style.setProperty("--parallax-y-reverse", `${-py}px`);
      const target = event.target;
      document.body.classList.toggle(
        "cursor-hovering",
        target instanceof Element && Boolean(target.closest("a, summary, .service-card, .map-node")),
      );
    };

    const onPointerDown = () => document.body.classList.add("cursor-pressed");
    const onPointerUp = () => document.body.classList.remove("cursor-pressed");

    const onScroll = () => {
      document.body.classList.toggle("is-scrolled", window.scrollY > 24);
    };

    const closeMobileMenu = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".mobile-nav a")) return;
      target.closest("details")?.removeAttribute("open");
    };

    let observer: IntersectionObserver | undefined;
    if (!reduceMotion.matches) {
      root.classList.add("motion-ready");
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              observer?.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.12, rootMargin: "0px 0px -7%" },
      );
      document.querySelectorAll("[data-reveal]").forEach((element) => observer?.observe(element));
    }

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("click", closeMobileMenu);
    onScroll();

    return () => {
      observer?.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("click", closeMobileMenu);
      root.classList.remove("motion-ready");
    };
  }, []);

  return null;
}
