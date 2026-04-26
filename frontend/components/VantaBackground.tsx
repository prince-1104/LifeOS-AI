"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * 3D Atom Background — A premium, custom Three.js animation featuring
 * a glowing nucleus, orbiting electrons, and intersecting rings.
 * Inspired by the Pixabay atom animation reference.
 */
export function VantaBackground() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // ── Scene Setup ──────────────────────────────────────────────────
    const scene = new THREE.Scene();
    // Slightly wider FOV for a grander look
    const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.z = 12;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // ── Colors & Materials ───────────────────────────────────────────
    const ORBIT_COLOR = 0x4B5563;    // Subtle gray/blue for the rings
    const ELECTRON_COLOR = 0x1DE6DB; // Vibrant Cyan
    const CORE_COLOR = 0x8b5cf6;     // Violet

    // Helper to create a soft glowing sprite texture
    const createGlowTexture = (colorStop1: string, colorStop2: string) => {
      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext("2d")!;
      const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
      gradient.addColorStop(0.15, colorStop1);
      gradient.addColorStop(0.4, colorStop2);
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 128, 128);
      return new THREE.CanvasTexture(canvas);
    };

    const cyanGlow = createGlowTexture("rgba(29, 230, 219, 0.9)", "rgba(29, 230, 219, 0.2)");
    const violetGlow = createGlowTexture("rgba(139, 92, 246, 0.9)", "rgba(139, 92, 246, 0.2)");

    // ── Atom Construction ────────────────────────────────────────────
    const atomGroup = new THREE.Group();
    scene.add(atomGroup);

    // 1. Central Nucleus
    const coreGeometry = new THREE.IcosahedronGeometry(0.8, 2);
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: CORE_COLOR,
      wireframe: true,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    
    const coreGlowMaterial = new THREE.SpriteMaterial({
      map: violetGlow,
      color: 0xffffff,
      transparent: true,
      blending: THREE.AdditiveBlending,
      opacity: 0.8
    });
    const coreSprite = new THREE.Sprite(coreGlowMaterial);
    coreSprite.scale.set(5, 5, 1);
    core.add(coreSprite);
    atomGroup.add(core);

    // 2. Orbits and Electrons
    const NUM_ORBITS = 4;
    const ORBIT_RADIUS = 6;
    const electrons: { sprite: THREE.Sprite; angle: number; speed: number; orbitRadius: number }[] = [];

    // Create 3D rings with different rotations
    for (let i = 0; i < NUM_ORBITS; i++) {
      const orbitGroup = new THREE.Group();
      
      // Evenly distribute rotations
      orbitGroup.rotation.x = Math.random() * Math.PI;
      orbitGroup.rotation.y = (i / NUM_ORBITS) * Math.PI;
      orbitGroup.rotation.z = Math.random() * Math.PI;
      atomGroup.add(orbitGroup);

      // Thin ring
      const ringGeometry = new THREE.TorusGeometry(ORBIT_RADIUS, 0.015, 16, 100);
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: ORBIT_COLOR,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
      });
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      orbitGroup.add(ring);

      // Add 1 or 2 electrons per orbit
      const numElectrons = 1 + Math.floor(Math.random() * 2);
      for (let j = 0; j < numElectrons; j++) {
        const electronMaterial = new THREE.SpriteMaterial({
          map: cyanGlow,
          color: 0xffffff,
          transparent: true,
          blending: THREE.AdditiveBlending,
        });
        const electron = new THREE.Sprite(electronMaterial);
        // Vary the size slightly
        const scale = 1.2 + Math.random() * 0.8;
        electron.scale.set(scale, scale, 1);
        
        orbitGroup.add(electron);

        electrons.push({
          sprite: electron,
          angle: (j / numElectrons) * Math.PI * 2 + Math.random(),
          speed: 0.015 + Math.random() * 0.02,
          orbitRadius: ORBIT_RADIUS,
        });
      }
    }

    // ── Mouse Interaction ────────────────────────────────────────────
    const mouse = new THREE.Vector2(0, 0);
    let targetRotationX = 0;
    let targetRotationY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      // Normalized mouse coordinates (-1 to +1)
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      
      // Target rotation based on mouse position
      targetRotationY = mouse.x * 0.5;
      targetRotationX = -mouse.y * 0.5;
    };
    window.addEventListener("mousemove", handleMouseMove);

    // ── Animation Loop ───────────────────────────────────────────────
    let animId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // 1. Rotate entire atom group smoothly towards target mouse rotation
      atomGroup.rotation.y += (targetRotationY + elapsed * 0.1 - atomGroup.rotation.y) * 0.05;
      atomGroup.rotation.x += (targetRotationX + Math.sin(elapsed * 0.1) * 0.1 - atomGroup.rotation.x) * 0.05;

      // 2. Pulse the core
      const pulse = 1 + Math.sin(elapsed * 2) * 0.05;
      core.scale.set(pulse, pulse, pulse);
      core.rotation.y = elapsed * 0.5;
      core.rotation.x = elapsed * 0.3;

      // 3. Move electrons along their orbits
      electrons.forEach((e) => {
        e.angle += e.speed;
        e.sprite.position.x = Math.cos(e.angle) * e.orbitRadius;
        e.sprite.position.y = Math.sin(e.angle) * e.orbitRadius;
      });

      renderer.render(scene, camera);
    };

    animate();

    // ── Resize Handler ───────────────────────────────────────────────
    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener("resize", handleResize);

    // ── Cleanup ──────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      
      // Dispose Geometries & Materials
      coreGeometry.dispose();
      coreMaterial.dispose();
      cyanGlow.dispose();
      violetGlow.dispose();
      renderer.dispose();
      
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 -z-10 opacity-70"
      aria-hidden="true"
    />
  );
}
