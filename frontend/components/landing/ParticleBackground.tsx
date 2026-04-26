"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * 3D Particle Dream — A flowing particle field background inspired by
 * cosmic particle simulations. Uses raw Three.js for a premium,
 * fluid-motion effect with glowing blue/violet particles.
 */
export function ParticleBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // ── Scene setup ──────────────────────────────────────────────────
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 3;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // ── Particles ────────────────────────────────────────────────────
    const PARTICLE_COUNT = 2500;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const velocities = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const sizes = new Float32Array(PARTICLE_COUNT);

    // Colour palette: violet → blue → cyan
    const palette = [
      new THREE.Color(0x8b5cf6), // Violet
      new THREE.Color(0x6366f1), // Indigo
      new THREE.Color(0x3b82f6), // Blue
      new THREE.Color(0x06b6d4), // Cyan
      new THREE.Color(0xa78bfa), // Light violet
    ];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      // Spread in a sphere
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 2.5 + Math.random() * 2.5;

      positions[i3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = r * Math.cos(phi);

      // Slow orbiting velocities
      velocities[i3] = (Math.random() - 0.5) * 0.003;
      velocities[i3 + 1] = (Math.random() - 0.5) * 0.003;
      velocities[i3 + 2] = (Math.random() - 0.5) * 0.003;

      // Random colour from palette
      const color = palette[Math.floor(Math.random() * palette.length)];
      colors[i3] = color.r;
      colors[i3 + 1] = color.g;
      colors[i3 + 2] = color.b;

      sizes[i] = Math.random() * 4 + 1;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

    // Glow texture for particles
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
    gradient.addColorStop(0.2, "rgba(200, 180, 255, 0.8)");
    gradient.addColorStop(0.5, "rgba(139, 92, 246, 0.3)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    const glowTexture = new THREE.CanvasTexture(canvas);

    const material = new THREE.PointsMaterial({
      size: 0.04,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      map: glowTexture,
      sizeAttenuation: true,
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // ── Connecting lines (subtle, nearby particles) ──────────────────
    const LINE_MAX_DIST = 0.8;
    const MAX_LINES = 600;
    const lineGeometry = new THREE.BufferGeometry();
    const linePositions = new Float32Array(MAX_LINES * 6); // 2 vertices × 3 coords
    const lineColors = new Float32Array(MAX_LINES * 6);
    lineGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(linePositions, 3)
    );
    lineGeometry.setAttribute(
      "color",
      new THREE.BufferAttribute(lineColors, 3)
    );

    const lineMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.15,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
    scene.add(lines);

    // ── Mouse interaction ────────────────────────────────────────────
    const mouse = new THREE.Vector2(0, 0);
    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };
    container.addEventListener("mousemove", handleMouseMove);

    // ── Animation loop ───────────────────────────────────────────────
    let animId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();
      const posArr = geometry.attributes.position.array as Float32Array;

      // Move particles in gentle orbits
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        const x = posArr[i3];
        const y = posArr[i3 + 1];
        const z = posArr[i3 + 2];

        // Orbital motion + drift
        const angle = elapsed * 0.15 + i * 0.001;
        posArr[i3] += velocities[i3] + Math.sin(angle + y) * 0.0008;
        posArr[i3 + 1] += velocities[i3 + 1] + Math.cos(angle + x) * 0.0008;
        posArr[i3 + 2] += velocities[i3 + 2] + Math.sin(angle + z) * 0.0005;

        // Soft boundary — pull back towards center if too far
        const dist = Math.sqrt(x * x + y * y + z * z);
        if (dist > 5) {
          posArr[i3] *= 0.998;
          posArr[i3 + 1] *= 0.998;
          posArr[i3 + 2] *= 0.998;
        }
      }
      geometry.attributes.position.needsUpdate = true;

      // Update connecting lines (sample subset for performance)
      let lineCount = 0;
      const lPos = lineGeometry.attributes.position.array as Float32Array;
      const lCol = lineGeometry.attributes.color.array as Float32Array;
      const step = Math.max(1, Math.floor(PARTICLE_COUNT / 300));

      for (
        let i = 0;
        i < PARTICLE_COUNT && lineCount < MAX_LINES;
        i += step
      ) {
        for (
          let j = i + step;
          j < PARTICLE_COUNT && lineCount < MAX_LINES;
          j += step
        ) {
          const i3 = i * 3;
          const j3 = j * 3;
          const dx = posArr[i3] - posArr[j3];
          const dy = posArr[i3 + 1] - posArr[j3 + 1];
          const dz = posArr[i3 + 2] - posArr[j3 + 2];
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz);

          if (d < LINE_MAX_DIST) {
            const li = lineCount * 6;
            lPos[li] = posArr[i3];
            lPos[li + 1] = posArr[i3 + 1];
            lPos[li + 2] = posArr[i3 + 2];
            lPos[li + 3] = posArr[j3];
            lPos[li + 4] = posArr[j3 + 1];
            lPos[li + 5] = posArr[j3 + 2];

            const alpha = 1 - d / LINE_MAX_DIST;
            lCol[li] = 0.55 * alpha;
            lCol[li + 1] = 0.36 * alpha;
            lCol[li + 2] = 0.96 * alpha;
            lCol[li + 3] = 0.55 * alpha;
            lCol[li + 4] = 0.36 * alpha;
            lCol[li + 5] = 0.96 * alpha;
            lineCount++;
          }
        }
      }

      // Zero out unused line segments
      for (let i = lineCount * 6; i < MAX_LINES * 6; i++) {
        lPos[i] = 0;
        lCol[i] = 0;
      }
      lineGeometry.attributes.position.needsUpdate = true;
      lineGeometry.attributes.color.needsUpdate = true;
      lineGeometry.setDrawRange(0, lineCount * 2);

      // Gentle camera sway following mouse
      camera.position.x += (mouse.x * 0.5 - camera.position.x) * 0.02;
      camera.position.y += (mouse.y * 0.3 - camera.position.y) * 0.02;
      camera.lookAt(0, 0, 0);

      // Slow rotation of the whole field
      particles.rotation.y = elapsed * 0.05;
      particles.rotation.x = Math.sin(elapsed * 0.03) * 0.1;
      lines.rotation.y = elapsed * 0.05;
      lines.rotation.x = Math.sin(elapsed * 0.03) * 0.1;

      renderer.render(scene, camera);
    };

    animate();

    // ── Resize handler ───────────────────────────────────────────────
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    // ── Cleanup ──────────────────────────────────────────────────────
    cleanupRef.current = () => {
      cancelAnimationFrame(animId);
      container.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      geometry.dispose();
      material.dispose();
      glowTexture.dispose();
      lineGeometry.dispose();
      lineMaterial.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };

    return () => {
      cleanupRef.current?.();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 -z-10"
      aria-hidden="true"
    />
  );
}
