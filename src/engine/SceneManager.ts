import * as THREE from "three";
import Stats from "stats.js";

export interface SceneManagerOptions {
  container?: HTMLElement;
  antialias?: boolean;
  showStats?: boolean;
}

export class SceneManager {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;

  private stats: Stats | null = null;
  private animationFrameId: number | null = null;
  private readonly container: HTMLElement;

  constructor(options: SceneManagerOptions = {}) {
    const {
      container = document.body,
      antialias = true,
      showStats = import.meta.env.DEV,
    } = options;

    this.container = container;

    this.scene = new THREE.Scene();

    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    this.camera.position.z = 5;

    this.renderer = new THREE.WebGLRenderer({ antialias });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.container.appendChild(this.renderer.domElement);

    if (showStats) {
      this.stats = new Stats();
      this.stats.showPanel(0);
      this.container.appendChild(this.stats.dom);
    }

    window.addEventListener("resize", this.handleResize);
  }

  start(): void {
    const loop = (): void => {
      this.stats?.begin();
      this.animationFrameId = requestAnimationFrame(loop);
      this.renderer.render(this.scene, this.camera);
      this.stats?.end();
    };
    loop();
  }

  dispose(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    window.removeEventListener("resize", this.handleResize);
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);

    if (this.stats) {
      this.container.removeChild(this.stats.dom);
      this.stats = null;
    }
  }

  private handleResize = (): void => {
    const { innerWidth, innerHeight } = window;
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
  };
}
