"use client";

import { useEffect, useRef } from "react";

/**
 * Floating Brain Background — tiny 🧠 icons drift across the chat,
 * gently pushed away when the mouse hovers near them.
 */

interface Brain {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  size: number;
  opacity: number;
  speed: number;
  angle: number;
  rotationSpeed: number;
  rotation: number;
}

export function VantaBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const parent = canvas.parentElement!;
    let w = parent.clientWidth;
    let h = parent.clientHeight;
    const dpr = Math.min(window.devicePixelRatio, 2);

    const setSize = () => {
      w = parent.clientWidth;
      h = parent.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    setSize();

    // ── Create brains ────────────────────────────────────────────────
    const BRAIN_COUNT = 35;
    const MOUSE_RADIUS = 120;
    const brains: Brain[] = [];

    for (let i = 0; i < BRAIN_COUNT; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      brains.push({
        x,
        y,
        baseX: x,
        baseY: y,
        size: 12 + Math.random() * 14,
        opacity: 0.06 + Math.random() * 0.12,
        speed: 0.15 + Math.random() * 0.3,
        angle: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.01,
        rotation: Math.random() * Math.PI * 2,
      });
    }

    // ── Mouse tracking ───────────────────────────────────────────────
    const mouse = { x: -9999, y: -9999 };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };
    const handleMouseLeave = () => {
      mouse.x = -9999;
      mouse.y = -9999;
    };

    parent.addEventListener("mousemove", handleMouseMove);
    parent.addEventListener("mouseleave", handleMouseLeave);

    // ── Animation loop ───────────────────────────────────────────────
    let animId: number;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      ctx.clearRect(0, 0, w, h);

      for (const b of brains) {
        // Gentle floating drift
        b.angle += b.speed * 0.008;
        b.baseX += Math.sin(b.angle) * 0.3;
        b.baseY += Math.cos(b.angle * 0.7) * 0.2;

        // Wrap around edges
        if (b.baseX < -30) b.baseX = w + 30;
        if (b.baseX > w + 30) b.baseX = -30;
        if (b.baseY < -30) b.baseY = h + 30;
        if (b.baseY > h + 30) b.baseY = -30;

        // Mouse repulsion — push brains away on hover
        const dx = b.baseX - mouse.x;
        const dy = b.baseY - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        let targetX = b.baseX;
        let targetY = b.baseY;

        if (dist < MOUSE_RADIUS && dist > 0) {
          const force = (1 - dist / MOUSE_RADIUS) * 50;
          targetX = b.baseX + (dx / dist) * force;
          targetY = b.baseY + (dy / dist) * force;
        }

        // Smooth easing towards target
        b.x += (targetX - b.x) * 0.08;
        b.y += (targetY - b.y) * 0.08;

        // Gentle rotation
        b.rotation += b.rotationSpeed;

        // Draw brain emoji
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.rotation);
        ctx.globalAlpha = b.opacity;
        ctx.font = `${b.size}px serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("🧠", 0, 0);
        ctx.restore();
      }
    };

    animate();

    // ── Resize ───────────────────────────────────────────────────────
    const handleResize = () => {
      setSize();
      // Redistribute brains that are out of bounds
      for (const b of brains) {
        if (b.baseX > w) b.baseX = Math.random() * w;
        if (b.baseY > h) b.baseY = Math.random() * h;
      }
    };
    window.addEventListener("resize", handleResize);

    // ── Cleanup ──────────────────────────────────────────────────────
    cleanupRef.current = () => {
      cancelAnimationFrame(animId);
      parent.removeEventListener("mousemove", handleMouseMove);
      parent.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("resize", handleResize);
    };

    return () => {
      cleanupRef.current?.();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 -z-10"
      aria-hidden="true"
    />
  );
}
