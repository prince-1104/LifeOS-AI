"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 3D Waves Background — A smooth, premium 3D liquid wave effect 
 * that slowly flows in the background, rendering behind the chat.
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
      const WAVES = (await import("vanta/dist/vanta.waves.min")).default;

      if (cancelled || !vantaRef.current) return;

      const effect = WAVES({
        el: vantaRef.current,
        THREE,
        mouseControls: true,
        touchControls: true,
        gyroControls: false,
        minHeight: 200.0,
        minWidth: 200.0,
        scale: 1.0,
        scaleMobile: 1.0,
        color: 0x140a23,       // Deep purple/indigo for the liquid waves
        shininess: 40,         // Slightly shiny to catch the light
        waveHeight: 15.0,      // Subtle, rolling waves
        waveSpeed: 0.6,        // Very slow, calming motion
        zoom: 0.8,             // Pulled back slightly so waves look grand
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
      className="pointer-events-none absolute inset-0 -z-10 opacity-70"
      aria-hidden="true"
    />
  );
}
