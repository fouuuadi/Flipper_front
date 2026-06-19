import * as THREE from "three";
import type { Ball } from "@modules/ball";
import type { RapierPhysicsAdapter } from "@physics/RapierPhysicsAdapter";
import type { NamedPhysicsCollider } from "./BlenderPhysicsColliders";

type ColliderMap = Record<string, NamedPhysicsCollider>;

interface SpinAnimation {
  object: THREE.Object3D;
  initialRotation: THREE.Quaternion;
  elapsed: number;
  duration: number;
}

interface BurstEffect {
  mesh: THREE.Mesh;
  elapsed: number;
  duration: number;
}

const PLANET_BUMPERS = new Set(["Planet_Glace", "Planet_Terre", "Planet_Volcan"]);
const RAMP_BOOSTS = new Set(["Rampe", "Ramp_2"]);
const SPINNERS = new Set(["Champignion_a", "Champignion_b"]);

export class TableInteractions {
  private readonly handleToName = new Map<number, string>();
  private readonly visuals = new Map<string, THREE.Object3D>();
  private readonly cooldowns = new Map<string, number>();
  private readonly spins: SpinAnimation[] = [];
  private readonly bursts: BurstEffect[] = [];

  private elapsed = 0;
  private shakeTime = 0;
  private previousShake = new THREE.Vector3();

  constructor(
    private readonly physics: RapierPhysicsAdapter,
    private readonly ball: Ball,
    private readonly colliders: ColliderMap,
    private readonly tableRoot: THREE.Object3D,
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.Camera,
  ) {
    for (const [name, entry] of Object.entries(colliders)) {
      this.handleToName.set(entry.collider.handle, name);
      const visual = this.findVisual(name);
      if (visual) this.visuals.set(name, visual);
    }

    this.physics.onCollision((handle1, handle2, started) => {
      this.handleCollision(handle1, handle2, started);
    });
  }

  update(deltaTime: number): void {
    this.elapsed += deltaTime;
    this.updateSpins(deltaTime);
    this.updateBursts(deltaTime);
    this.updateShake(deltaTime);
  }

  private handleCollision(handle1: number, handle2: number, started: boolean): void {
    if (!started) return;

    const ballCollider = this.ball.getCollider();
    if (!ballCollider) return;

    const ballHandle = ballCollider.handle;
    let name: string | undefined;
    if (handle1 === ballHandle) name = this.handleToName.get(handle2);
    if (handle2 === ballHandle) name = this.handleToName.get(handle1);
    if (!name || this.isCoolingDown(name)) return;

    if (PLANET_BUMPERS.has(name)) {
      this.bumpFrom(name, 2.25, 0.18);
    } else if (RAMP_BOOSTS.has(name)) {
      this.boostRamp(name);
    } else if (SPINNERS.has(name)) {
      this.spinMushroom(name);
      this.randomSpinnerKick();
    } else if (name === "Bump") {
      this.bumpFrom(name, 2.2, 0.28);
      this.startShake();
    }
  }

  private isCoolingDown(name: string): boolean {
    const cooldown = name === "Bump" ? 0.28 : SPINNERS.has(name) ? 0.22 : 0.12;
    const lastTime = this.cooldowns.get(name) ?? -Infinity;
    if (this.elapsed - lastTime < cooldown) return true;

    this.cooldowns.set(name, this.elapsed);
    return false;
  }

  private bumpFrom(name: string, impulse: number, popImpulse: number): void {
    const body = this.ball.getBody();
    if (!body) return;

    const center = this.colliders[name]?.center ?? new THREE.Vector3();
    const position = body.translation();
    const direction = new THREE.Vector3(position.x, position.y, position.z).sub(center);
    direction.y = Math.max(direction.y, 0.08);
    if (direction.lengthSq() < 1e-6) direction.set(0, 1, 0);
    direction.normalize().multiplyScalar(impulse);
    direction.y += popImpulse;

    this.ball.applyImpulse({ x: direction.x, y: direction.y, z: direction.z });
  }

  private boostRamp(name: string): void {
    const body = this.ball.getBody();
    if (!body) return;

    const velocity = body.linvel();
    const horizontalSpeed = Math.sqrt(velocity.x ** 2 + velocity.z ** 2);
    if (horizontalSpeed < 0.35) return;

    const targetSpeed = Math.max(horizontalSpeed * 1.45, 4.2);
    const scale = targetSpeed / horizontalSpeed;

    body.setLinvel(
      {
        x: velocity.x * scale,
        y: Math.max(velocity.y, 0.15),
        z: velocity.z * scale,
      },
      true,
    );
    this.createBoostBurst(this.colliders[name]?.center ?? new THREE.Vector3());
  }

  private spinMushroom(name: string): void {
    const visual = this.visuals.get(name);
    if (!visual) return;

    const existing = this.spins.find((spin) => spin.object === visual);
    if (existing) {
      existing.elapsed = 0;
      return;
    }

    this.spins.push({
      object: visual,
      initialRotation: visual.quaternion.clone(),
      elapsed: 0,
      duration: 0.38,
    });
  }

  private randomSpinnerKick(): void {
    const angle = Math.random() * Math.PI * 2;
    const impulse = 1.2;
    this.ball.applyImpulse({
      x: Math.cos(angle) * impulse,
      y: 0.16,
      z: Math.sin(angle) * impulse,
    });
  }

  private updateSpins(deltaTime: number): void {
    for (let i = this.spins.length - 1; i >= 0; i -= 1) {
      const spin = this.spins[i];
      spin.elapsed += deltaTime;

      const progress = Math.min(spin.elapsed / spin.duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      const spinRotation = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        eased * Math.PI * 2,
      );
      spin.object.quaternion.copy(spin.initialRotation).multiply(spinRotation);

      if (progress >= 1) {
        spin.object.quaternion.copy(spin.initialRotation);
        this.spins.splice(i, 1);
      }
    }
  }

  private createBoostBurst(center: THREE.Vector3): void {
    const geometry = new THREE.RingGeometry(0.18, 0.52, 24);
    const material = new THREE.MeshBasicMaterial({
      color: 0x00d4ff,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(center);
    mesh.position.y += 0.22;
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 1001;
    this.scene.add(mesh);
    this.bursts.push({ mesh, elapsed: 0, duration: 0.28 });
  }

  private updateBursts(deltaTime: number): void {
    for (let i = this.bursts.length - 1; i >= 0; i -= 1) {
      const burst = this.bursts[i];
      burst.elapsed += deltaTime;
      const progress = Math.min(burst.elapsed / burst.duration, 1);
      const material = burst.mesh.material as THREE.MeshBasicMaterial;
      material.opacity = 0.75 * (1 - progress);
      burst.mesh.scale.setScalar(1 + progress * 1.8);

      if (progress >= 1) {
        this.scene.remove(burst.mesh);
        burst.mesh.geometry.dispose();
        material.dispose();
        this.bursts.splice(i, 1);
      }
    }
  }

  private startShake(): void {
    this.shakeTime = 0.24;
  }

  private updateShake(deltaTime: number): void {
    if (this.previousShake.lengthSq() > 0) {
      this.camera.position.sub(this.previousShake);
      this.previousShake.set(0, 0, 0);
    }

    if (this.shakeTime <= 0) return;

    this.shakeTime = Math.max(0, this.shakeTime - deltaTime);
    const strength = (this.shakeTime / 0.24) * 0.08;
    this.previousShake.set(
      (Math.random() - 0.5) * strength,
      (Math.random() - 0.5) * strength,
      0,
    );
    this.camera.position.add(this.previousShake);
  }

  private findVisual(name: string): THREE.Object3D | null {
    let found: THREE.Object3D | null = null;

    this.tableRoot.traverse((object) => {
      if (found) return;
      if (normalizeName(object.name) === name.toLowerCase()) found = object;
    });

    return found;
  }
}

function normalizeName(name: string): string {
  return name
    .normalize("NFKC")
    .replace(/[\u0000-\u0020\u007f-\u00a0\u1680\u180e\u2000-\u200b\u2028\u2029\u202f\u205f\u3000\ufeff]/g, "")
    .replace(/^_+/, "")
    .toLowerCase();
}
