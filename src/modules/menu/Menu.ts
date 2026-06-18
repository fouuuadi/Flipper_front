import { dispatchIntent } from "@core/keyboardDispatcher";
import { matchSync } from "@services/matchSync";
import { menuAudio } from "@services/menuAudio";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import "./menu.css";

type MenuAction = "play" | "leaderboard" | "cosmetics" | "settings" | "quit";

interface MenuButtonSpec {
  readonly label: string;
  readonly width: number;
  readonly x: number;
  readonly action: MenuAction;
}

type MenuButtonMesh = THREE.Mesh<RoundedBoxGeometry, THREE.Material | THREE.Material[]> & {
  userData: {
    label: string;
    action: MenuAction;
  };
};

const WORLD_BASE = "/models/menu/";
const WORLD_FILE = "super_mario_galaxy_mushroom_kingdom.glb";
const MARIO_FILE = "mario_idle.glb";
const CAMERA_START = new THREE.Vector3(-3.95, 0.82, -1.85);
const CAMERA_TARGET = new THREE.Vector3(-3.78, 0.62, -3.43);
const MARIO_START = new THREE.Vector3(-3.78, 0.46, -3.43);

const BUTTON_SPECS: readonly MenuButtonSpec[] = [
  { label: "JOUER", width: 0.82, x: -2.18, action: "play" },
  { label: "LEADERBOARD", width: 0.72, x: -1.04, action: "leaderboard" },
  { label: "BOUTIQUE COSMETIQUE", width: 1.02, x: 0.08, action: "cosmetics" },
  { label: "PARAMETRES", width: 0.76, x: 1.18, action: "settings" },
  { label: "QUITTER", width: 0.66, x: 2.22, action: "quit" },
];

/**
 * Menu principal après le splash.
 *
 * Le prototype `Mario_Menu/main.js` est porté ici en composant du projet :
 * les boutons 3D déclenchent la state machine au lieu de naviguer vers des
 * fichiers HTML séparés.
 */
export class Menu {
  private readonly root: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly cleanupFns: Array<() => void> = [];
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointerNdc = new THREE.Vector2();
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private controls: OrbitControls | null = null;
  private worldRoot: THREE.Group | null = null;
  private marioRoot: THREE.Group | null = null;
  private marioMixer: THREE.AnimationMixer | null = null;
  private clock = new THREE.Clock();
  private menuButtons: MenuButtonMesh[] = [];
  private hoveredMenuButton: MenuButtonMesh | null = null;
  private selectedMenuButton: MenuButtonMesh | null = null;
  private disposed = false;

  constructor() {
    this.root = document.createElement("section");
    this.root.className = "menu-scene menu-scene--running";

    this.canvas = document.createElement("canvas");
    this.canvas.className = "menu-world-canvas";
    this.canvas.setAttribute("aria-label", "Menu Mario Galaxy");
    this.root.appendChild(this.canvas);

    const hint = document.createElement("p");
    hint.className = "menu-hint";
    hint.textContent = "Clique un bouton dans le monde";
    this.root.appendChild(hint);
  }

  mount(host: HTMLElement = document.body): void {
    host.appendChild(this.root);
    menuAudio.playMenu();
    this.initThree();
    this.bindDomEvents();
    this.loadWorld();
    this.animate();
  }

  unmount(): void {
    this.disposed = true;
    this.cleanupFns.splice(0).forEach((cleanup) => cleanup());
    this.renderer?.setAnimationLoop(null);
    this.controls?.dispose();
    this.scene?.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });
    this.renderer?.dispose();
    this.root.remove();
  }

  private initThree(): void {
    this.scene = new THREE.Scene();
    this.scene.background = this.createGalaxyBackground();
    this.scene.fog = new THREE.FogExp2(0x060414, 0.001);

    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 500);
    this.camera.position.copy(CAMERA_START);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.85;

    this.scene.environment = this.createGalaxyEnvironment();
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.28));
    this.scene.add(new THREE.HemisphereLight(0xeaf5ff, 0x20102f, 0.45));

    const key = new THREE.DirectionalLight(0xffffff, 0.8);
    key.position.set(35, 70, 35);
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0x87c9ff, 0.35);
    fill.position.set(-35, 24, -28);
    this.scene.add(fill);

    const rim = new THREE.PointLight(0x73d0ff, 0.7, 0, 2);
    rim.position.set(-45, 40, 15);
    this.scene.add(rim);

    const topGlow = new THREE.PointLight(0xa78bfa, 0.35, 0, 2);
    topGlow.position.set(15, 90, 20);
    this.scene.add(topGlow);

    const centerGlow = new THREE.PointLight(0xffffff, 0.45, 0, 2);
    centerGlow.position.set(0, 40, 0);
    this.scene.add(centerGlow);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = true;
    this.controls.screenSpacePanning = true;
    this.controls.panSpeed = 0.6;
    this.controls.zoomSpeed = 1.1;
    this.controls.rotateSpeed = 0.5;
    this.controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE,
    };
    this.controls.target.copy(CAMERA_TARGET);
    this.controls.minPolarAngle = 0.15;
    this.controls.maxPolarAngle = Math.PI - 0.15;
    this.controls.minAzimuthAngle = -Math.PI;
    this.controls.maxAzimuthAngle = Math.PI;
    this.controls.update();
  }

  private bindDomEvents(): void {
    const onPointerMove = (event: PointerEvent) => this.handlePointerMove(event);
    const onPointerDown = (event: PointerEvent) => this.handlePointerDown(event);
    const onPointerLeave = () => this.handlePointerLeave();
    const onResize = () => this.handleResize();

    this.canvas.addEventListener("pointermove", onPointerMove);
    this.canvas.addEventListener("pointerdown", onPointerDown);
    this.canvas.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("resize", onResize);

    this.cleanupFns.push(
      () => this.canvas.removeEventListener("pointermove", onPointerMove),
      () => this.canvas.removeEventListener("pointerdown", onPointerDown),
      () => this.canvas.removeEventListener("pointerleave", onPointerLeave),
      () => window.removeEventListener("resize", onResize),
    );
  }

  private loadWorld(): void {
    if (!this.scene) return;

    const loader = new GLTFLoader();
    loader.setPath(WORLD_BASE);
    loader.setResourcePath(WORLD_BASE);
    loader.load(
      WORLD_FILE,
      (gltf) => {
        if (this.disposed || !this.scene) return;
        this.worldRoot = gltf.scene;
        this.worldRoot.scale.setScalar(1.35);
        this.prepareModelMaterials(this.worldRoot, true);
        this.scene.add(this.worldRoot);
        this.frameWorld(this.worldRoot);
        this.loadMario();
        this.createMenuButtons();
      },
      undefined,
      (error) => console.error("World load failed", error),
    );
  }

  private frameWorld(root: THREE.Object3D): void {
    if (!this.camera || !this.controls) return;
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    box.getSize(size);

    const maxDim = Math.max(size.x, size.y, size.z);
    const farPlane = Math.max(20_000, maxDim * 50);
    this.camera.near = 0.1;
    this.camera.far = farPlane;
    this.camera.updateProjectionMatrix();
    this.controls.minDistance = 1;
    this.controls.maxDistance = farPlane * 0.9;
    this.controls.update();
  }

  private loadMario(): void {
    if (!this.scene) return;

    const loader = new GLTFLoader();
    loader.setPath(WORLD_BASE);
    loader.load(
      MARIO_FILE,
      (gltf) => {
        if (this.disposed || !this.scene) return;
        this.marioRoot = gltf.scene;
        this.marioRoot.position.copy(MARIO_START);
        this.marioRoot.scale.setScalar(0.12);
        this.prepareModelMaterials(this.marioRoot, false);
        this.scene.add(this.marioRoot);

        if (this.controls) {
          this.controls.target.copy(this.marioRoot.position).add(new THREE.Vector3(0, 0.16, 0));
          this.controls.update();
        }

        if (gltf.animations.length > 0) {
          this.marioMixer = new THREE.AnimationMixer(this.marioRoot);
          this.marioMixer.clipAction(gltf.animations[0]).play();
        }
      },
      undefined,
      (error) => console.error("Mario load failed", error),
    );
  }

  private prepareModelMaterials(root: THREE.Object3D, tuneWorldMaterials: boolean): void {
    root.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.castShadow = false;
      child.receiveShadow = true;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        const standardMaterial = material as THREE.MeshStandardMaterial;
        if (standardMaterial.map) {
          standardMaterial.map.colorSpace = THREE.SRGBColorSpace;
          standardMaterial.needsUpdate = true;
        }
        if (!tuneWorldMaterials) return;
        standardMaterial.metalness = 0.05;
        standardMaterial.roughness = 0.92;
        standardMaterial.envMapIntensity = 0.9;
        standardMaterial.emissiveIntensity = 0.15;
      });
    });
  }

  private createMenuButtons(): void {
    if (!this.scene || this.menuButtons.length > 0) return;

    const menuButtonGroup = new THREE.Group();
    menuButtonGroup.position.set(-3.78, 1.14, -3.6);
    menuButtonGroup.scale.setScalar(0.42);

    this.menuButtons = BUTTON_SPECS.map((spec) => {
      const button = this.create3DButton(spec);
      button.position.set(spec.x, 0, 0);
      menuButtonGroup.add(button);
      return button;
    });

    this.scene.add(menuButtonGroup);
  }

  private create3DButton(spec: MenuButtonSpec): MenuButtonMesh {
    const texture = this.createButtonTexture(spec.label);
    const geometry = new RoundedBoxGeometry(spec.width, 0.42, 0.16, 6, 0.08);
    const frontMaterial = new THREE.MeshStandardMaterial({
      map: texture,
      color: 0xffffff,
      emissive: new THREE.Color(0x2d7cff),
      emissiveIntensity: 0.75,
      roughness: 0.25,
      metalness: 0.15,
    });
    const sideMaterial = new THREE.MeshStandardMaterial({
      color: 0x123d8a,
      roughness: 0.45,
      metalness: 0.1,
    });
    const topMaterial = new THREE.MeshStandardMaterial({
      color: 0x0f57b7,
      roughness: 0.3,
      metalness: 0.18,
    });

    const mesh = new THREE.Mesh(geometry, [
      sideMaterial,
      sideMaterial,
      topMaterial,
      sideMaterial,
      frontMaterial,
      sideMaterial,
    ]) as unknown as MenuButtonMesh;
    mesh.userData.label = spec.label;
    mesh.userData.action = spec.action;
    return mesh;
  }

  private activateMenuButton(button: MenuButtonMesh): void {
    this.selectedMenuButton = button;
    window.setTimeout(() => {
      switch (button.userData.action) {
        case "play":
          dispatchIntent({ type: "START_GAME" }, { sync: matchSync });
          return;
        case "leaderboard":
          dispatchIntent({ type: "OPEN_LEADERBOARD" }, { sync: matchSync });
          return;
        case "cosmetics":
          dispatchIntent({ type: "OPEN_COSMETICS" }, { sync: matchSync });
          return;
        case "settings":
          dispatchIntent({ type: "OPEN_SETTINGS" }, { sync: matchSync });
          return;
        case "quit":
          dispatchIntent({ type: "BACK_TO_SPLASH" }, { sync: matchSync });
          return;
      }
    }, 80);
  }

  private createButtonTexture(label: string): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) return new THREE.CanvasTexture(canvas);

    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, "#0b3cff");
    gradient.addColorStop(0.5, "#1249ff");
    gradient.addColorStop(1, "#041957");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const glow = ctx.createRadialGradient(
      canvas.width * 0.5,
      canvas.height * 0.35,
      10,
      canvas.width * 0.5,
      canvas.height * 0.35,
      360,
    );
    glow.addColorStop(0, "rgba(255,255,255,0.35)");
    glow.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "#38d0ff";
    ctx.lineWidth = 18;
    this.roundedRect(ctx, 18, 18, canvas.width - 36, canvas.height - 36, 42);
    ctx.stroke();

    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = 6;
    this.roundedRect(ctx, 42, 42, canvas.width - 84, canvas.height - 84, 30);
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 76px Bungee, Arial, sans-serif";
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 5;
    this.wrapButtonText(ctx, label, canvas.width / 2, canvas.height / 2, canvas.width * 0.82, 80);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }

  private roundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  private wrapButtonText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
  ): void {
    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine = words[0] ?? "";

    for (let i = 1; i < words.length; i += 1) {
      const testLine = `${currentLine} ${words[i]}`;
      if (ctx.measureText(testLine).width > maxWidth) {
        lines.push(currentLine);
        currentLine = words[i];
      } else {
        currentLine = testLine;
      }
    }
    lines.push(currentLine);

    const startY = y - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((line, index) => {
      ctx.fillText(line, x, startY + index * lineHeight);
    });
  }

  private handlePointerMove(event: PointerEvent): void {
    if (!this.renderer || !this.camera) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);

    this.updateMenuHover();
  }

  private handlePointerDown(event: PointerEvent): void {
    if (!this.renderer || !this.camera || this.menuButtons.length === 0) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const hits = this.raycaster.intersectObjects(this.menuButtons, false);
    if (hits.length > 0) this.activateMenuButton(hits[0].object as MenuButtonMesh);
  }

  private handlePointerLeave(): void {
    this.canvas.style.cursor = "grab";
  }

  private updateMenuHover(): void {
    if (!this.camera || this.menuButtons.length === 0) return;

    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const hits = this.raycaster.intersectObjects(this.menuButtons, false);
    this.hoveredMenuButton = hits.length > 0 ? (hits[0].object as MenuButtonMesh) : null;
    this.canvas.style.cursor = hits.length > 0 ? "pointer" : "grab";
  }

  private updateMenuButtons(): void {
    this.menuButtons.forEach((menuButton) => {
      const targetScale =
        menuButton === this.selectedMenuButton
          ? 1.18
          : menuButton === this.hoveredMenuButton
            ? 1.08
            : 1;
      menuButton.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.2);
      const frontMaterial = Array.isArray(menuButton.material) ? menuButton.material[4] : null;
      if (frontMaterial instanceof THREE.MeshStandardMaterial) {
        const targetGlow =
          menuButton === this.selectedMenuButton
            ? 1.35
            : menuButton === this.hoveredMenuButton
              ? 1
              : 0.75;
        frontMaterial.emissiveIntensity = THREE.MathUtils.lerp(
          frontMaterial.emissiveIntensity,
          targetGlow,
          0.2,
        );
      }
    });
  }

  private animate(): void {
    if (!this.renderer || !this.scene || !this.camera) return;

    this.renderer.setAnimationLoop(() => {
      if (!this.renderer || !this.scene || !this.camera) return;
      const delta = this.clock.getDelta();
      this.marioMixer?.update(delta);
      this.controls?.update();
      this.updateMenuButtons();
      this.renderer.render(this.scene, this.camera);
    });
  }

  private handleResize(): void {
    if (!this.renderer || !this.camera) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  private createGalaxyBackground(): THREE.CanvasTexture {
    const size = 1024;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return new THREE.CanvasTexture(canvas);

    const gradient = ctx.createRadialGradient(
      size * 0.35,
      size * 0.25,
      size * 0.1,
      size * 0.5,
      size * 0.5,
      size * 0.8,
    );
    gradient.addColorStop(0, "#1b0b3f");
    gradient.addColorStop(0.5, "#0b0620");
    gradient.addColorStop(1, "#05020f");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 1200; i += 1) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = Math.random() < 0.85 ? Math.random() * 1.2 : Math.random() * 2;
      const alpha = 0.35 + Math.random() * 0.6;
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let i = 0; i < 10; i += 1) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = 120 + Math.random() * 220;
      const alpha = 0.03 + Math.random() * 0.05;
      ctx.fillStyle = `rgba(120, 150, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.mapping = THREE.EquirectangularReflectionMapping;
    return texture;
  }

  private createGalaxyEnvironment(): THREE.Texture | null {
    if (!this.renderer) return null;

    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const gradient = ctx.createRadialGradient(
      size * 0.5,
      size * 0.45,
      6,
      size * 0.5,
      size * 0.5,
      size * 0.6,
    );
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(0.35, "#9ed6ff");
    gradient.addColorStop(0.7, "#4f6bff");
    gradient.addColorStop(1, "#12081f");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 250; i += 1) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = Math.random() * 1.8;
      ctx.fillStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.7})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.mapping = THREE.EquirectangularReflectionMapping;
    const generator = new THREE.PMREMGenerator(this.renderer);
    const environment = generator.fromEquirectangular(texture).texture;
    generator.dispose();
    texture.dispose();
    return environment;
  }
}
