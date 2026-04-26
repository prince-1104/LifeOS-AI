"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animated 3D NET background powered by Vanta.js + Three.js.
 * Renders behind chat content as an absolute-positioned layer.
 */
export function VantaBackground() {
  const vantaRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [vantaEffect, setVantaEffect] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      // Dynamic imports to avoid SSR issues with Three.js
      const THREE = await import("three");
      const NET = (await import("vanta/dist/vanta.net.min")).default;

      if (cancelled || !vantaRef.current) return;

      const effect = NET({
        el: vantaRef.current,
        THREE,
        mouseControls: true,
        touchControls: true,
        gyroControls: false,
        minHeight: 200.0,
        minWidth: 200.0,
        scale: 1.0,
        scaleMobile: 1.0,
        color: 0x8b5cf6,          // Violet
        backgroundColor: 0x0a0a0a, // Near-black matching the app bg
        points: 10.0,
        maxDistance: 18.0,
        spacing: 17.0,
        showDots: true,
      });
      if (!cancelled) setVantaEffect(effect);
    }

    init();

    return () => {
      cancelled = true;
      if (vantaEffect) vantaEffect.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (vantaEffect) vantaEffect.destroy();
    };
  }, [vantaEffect]);

  return (
    <div
      ref={vantaRef}
      className="pointer-events-none absolute inset-0 -z-10 opacity-50"
      aria-hidden="true"
    />
  );
}
