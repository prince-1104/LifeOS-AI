declare module "vanta/dist/vanta.net.min" {
  interface VantaNetOptions {
    el: HTMLElement;
    THREE: unknown;
    mouseControls?: boolean;
    touchControls?: boolean;
    gyroControls?: boolean;
    minHeight?: number;
    minWidth?: number;
    scale?: number;
    scaleMobile?: number;
    color?: number;
    backgroundColor?: number;
    points?: number;
    maxDistance?: number;
    spacing?: number;
    showDots?: boolean;
  }

  interface VantaEffect {
    destroy: () => void;
    resize: () => void;
  }

  export default function NET(opts: VantaNetOptions): VantaEffect;
}

declare module "vanta/dist/vanta.waves.min" {
  interface VantaWavesOptions {
    el: HTMLElement;
    THREE: unknown;
    mouseControls?: boolean;
    touchControls?: boolean;
    gyroControls?: boolean;
    minHeight?: number;
    minWidth?: number;
    scale?: number;
    scaleMobile?: number;
    color?: number;
    shininess?: number;
    waveHeight?: number;
    waveSpeed?: number;
    zoom?: number;
  }
  
  interface VantaEffect {
    destroy: () => void;
    resize: () => void;
  }

  export default function WAVES(opts: VantaWavesOptions): VantaEffect;
}
