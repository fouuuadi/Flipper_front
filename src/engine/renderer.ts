import * as THREE from "three";

export interface Interpolable {
  interpolate(alpha: number): void;
}

export interface RendererOptions {
  container?: HTMLElement;
  antialias?: boolean;
  clearColor?: number;
}

export class Renderer {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;

  private readonly container: HTMLElement;
  private readonly interpolables = new Set<Interpolable>();

  constructor(options: RendererOptions = {}) {
    const {
      container = document.body,
      antialias = true,
      clearColor = 0x0f1012,
    } = options;

    this.container = container;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(clearColor);

    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.position.set(0, 8, 10);

    this.renderer = new THREE.WebGLRenderer({ antialias, alpha: false });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.appendChild(this.renderer.domElement);

    window.addEventListener("resize", this.handleResize);
  }

  registerInterpolable(interpolable: Interpolable): () => void {
    this.interpolables.add(interpolable);
    return () => this.interpolables.delete(interpolable);
  }

  render(alpha: number): void {
    this.interpolables.forEach((target) => target.interpolate(alpha));
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    window.removeEventListener("resize", this.handleResize);

    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }

  private handleResize = (): void => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  };
}
