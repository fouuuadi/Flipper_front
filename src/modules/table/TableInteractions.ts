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

interface TunnelTeleport {
  from: string;
  to: string;
  elapsed: number;
  duration: number;
  entryVelocity: THREE.Vector3;
}

interface FlashTarget {
  material: THREE.Material & {
    color?: THREE.Color;
    emissive?: THREE.Color;
    emissiveIntensity?: number;
  };
  baseColor: THREE.Color | null;
  baseEmissive: THREE.Color | null;
  baseEmissiveIntensity: number;
}

const PLANET_BUMPERS = new Set(["Planet_Glace", "Planet_Terre", "Planet_Volcan"]);
const RAMP_BOOSTS = new Set(["Rampe", "Ramp_2"]);
const SPINNERS = new Set(["Champignion_a", "Champignion_b"]);
const TUNNEL_PAIRS: Record<string, string> = {
  Tunel_b: "Tunel_c",
  Tunel_c: "Tunel_b",
};

const LIGNE_NAME = "Ligne";
const LIGNE_FLASH_DURATION = 1.4;
const LIGNE_FLASH_HUE_CYCLES = 2;

export class TableInteractions {
  private readonly handleToName = new Map<number, string>();
  private readonly visuals = new Map<string, THREE.Object3D>();
  private readonly cooldowns = new Map<string, number>();
  private readonly spins: SpinAnimation[] = [];
  private readonly bursts: BurstEffect[] = [];
  private readonly ligneFlashTargets: FlashTarget[];
  private ligneFlashElapsed: number | null = null;
  private readonly ligneFlashColor = new THREE.Color();

  private elapsed = 0;
  private shakeTime = 0;
  private previousShake = new THREE.Vector3();
  private tunnelTeleport: TunnelTeleport | null = null;
  private tunnelCooldownUntil = 0;

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

    const ligneVisual = this.visuals.get(LIGNE_NAME);
    this.ligneFlashTargets = ligneVisual ? collectFlashTargets(ligneVisual) : [];

    this.physics.onCollision((handle1, handle2, started) => {
      this.handleCollision(handle1, handle2, started);
    });
  }

  update(deltaTime: number): void {
    this.elapsed += deltaTime;
    this.updateSpins(deltaTime);
    this.updateBursts(deltaTime);
    this.updateShake(deltaTime);
    this.updateTunnelTeleport(deltaTime);
    this.updateLigneFlash(deltaTime);
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
    } else if (name in TUNNEL_PAIRS) {
      this.startTunnelTeleport(name);
    } else if (name === LIGNE_NAME) {
      this.triggerLigneFlash();
    }
  }

  private triggerLigneFlash(): void {
    if (this.ligneFlashTargets.length === 0) return;
    this.ligneFlashElapsed = 0;
  }

  private updateLigneFlash(deltaTime: number): void {
    if (this.ligneFlashElapsed === null) return;

    this.ligneFlashElapsed += deltaTime;
    const progress = Math.min(this.ligneFlashElapsed / LIGNE_FLASH_DURATION, 1);
    // Enveloppe d'intensité : monte puis redescend une seule fois.
    const pulse = Math.sin(progress * Math.PI);
    // La teinte tourne sur plusieurs cycles pendant l'animation -> couleurs variées plutôt qu'une seule.
    const hue = (progress * LIGNE_FLASH_HUE_CYCLES) % 1;
    this.ligneFlashColor.setHSL(hue, 1, 0.55);

    for (const target of this.ligneFlashTargets) {
      if (target.material.color && target.baseColor) {
        target.material.color.copy(target.baseColor).lerp(this.ligneFlashColor, pulse * 0.85);
      }
      if (target.material.emissive) {
        target.material.emissive
          .copy(target.baseEmissive ?? new THREE.Color(0x000000))
          .lerp(this.ligneFlashColor, pulse);
      }
      if (target.material.emissiveIntensity !== undefined) {
        target.material.emissiveIntensity = target.baseEmissiveIntensity + pulse * 1.6;
      }
    }

    if (progress >= 1) {
      for (const target of this.ligneFlashTargets) {
        if (target.material.color && target.baseColor) target.material.color.copy(target.baseColor);
        if (target.material.emissive) {
          target.material.emissive.copy(target.baseEmissive ?? new THREE.Color(0x000000));
        }
        if (target.material.emissiveIntensity !== undefined) {
          target.material.emissiveIntensity = target.baseEmissiveIntensity;
        }
      }
      this.ligneFlashElapsed = null;
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

  private updateTunnelTeleport(deltaTime: number): void {
    const body = this.ball.getBody();
    if (!body) return;

    if (this.tunnelTeleport) {
      this.tunnelTeleport.elapsed += deltaTime;
      const fromCenter = this.colliders[this.tunnelTeleport.from]?.center;
      if (!fromCenter) {
        this.tunnelTeleport = null;
        return;
      }

      const position = body.translation();
      const pull = fromCenter.clone().sub(new THREE.Vector3(position.x, position.y, position.z));
      pull.y = 0;
      const pullDistance = pull.length();
      if (pullDistance > 0.01) pull.normalize();

      body.setLinvel(
        {
          x: pull.x * 5.4,
          y: Math.max(body.linvel().y, 0),
          z: pull.z * 5.4,
        },
        true,
      );

      if (this.tunnelTeleport.elapsed >= this.tunnelTeleport.duration || pullDistance < 0.16) {
        this.finishTunnelTeleport();
      }
      return;
    }

    if (this.elapsed < this.tunnelCooldownUntil) return;

    const position = body.translation();
    for (const tunnelName of Object.keys(TUNNEL_PAIRS)) {
      const center = this.colliders[tunnelName]?.center;
      if (!center) continue;

      const distanceXZ = Math.hypot(position.x - center.x, position.z - center.z);
      if (distanceXZ <= 0.72) {
        this.startTunnelTeleport(tunnelName);
        return;
      }
    }
  }

  private startTunnelTeleport(from: string): void {
    if (this.tunnelTeleport || this.elapsed < this.tunnelCooldownUntil) return;

    const to = TUNNEL_PAIRS[from];
    if (!to || !this.colliders[from] || !this.colliders[to]) return;

    const velocity = this.ball.getBody()?.linvel();
    this.tunnelTeleport = {
      from,
      to,
      elapsed: 0,
      duration: 0.18,
      entryVelocity: velocity
        ? new THREE.Vector3(velocity.x, velocity.y, velocity.z)
        : new THREE.Vector3(0, 0, 1),
    };
    this.cooldowns.set(from, this.elapsed);
  }

  private finishTunnelTeleport(): void {
    const teleport = this.tunnelTeleport;
    const body = this.ball.getBody();
    const destination = teleport ? this.colliders[teleport.to]?.center : null;
    if (!teleport || !body || !destination) {
      this.tunnelTeleport = null;
      return;
    }

    const direction = new THREE.Vector3(teleport.entryVelocity.x, 0, teleport.entryVelocity.z);
    if (direction.lengthSq() < 0.01) {
      const source = this.colliders[teleport.from]?.center ?? destination;
      direction.copy(destination).sub(source);
      direction.y = 0;
    }
    if (direction.lengthSq() < 0.01) direction.set(0, 0, 1);
    direction.normalize();

    const speed = Math.max(Math.hypot(teleport.entryVelocity.x, teleport.entryVelocity.z), 4.8);
    const exitPosition = destination.clone().addScaledVector(direction, 0.92);
    exitPosition.y = Math.max(body.translation().y, destination.y + 0.22);

    body.setTranslation({ x: exitPosition.x, y: exitPosition.y, z: exitPosition.z }, true);
    body.setLinvel(
      {
        x: direction.x * speed,
        y: Math.max(teleport.entryVelocity.y, 0.08),
        z: direction.z * speed,
      },
      true,
    );
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);

    this.tunnelTeleport = null;
    this.tunnelCooldownUntil = this.elapsed + 0.72;
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

function collectFlashTargets(visual: THREE.Object3D): FlashTarget[] {
  const targets: FlashTarget[] = [];

  visual.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      const colorMaterial = material as THREE.Material & {
        color?: THREE.Color;
        emissive?: THREE.Color;
        emissiveIntensity?: number;
      };
      if (!colorMaterial.color) continue;

      targets.push({
        material: colorMaterial,
        baseColor: colorMaterial.color.clone(),
        baseEmissive: colorMaterial.emissive ? colorMaterial.emissive.clone() : null,
        baseEmissiveIntensity: colorMaterial.emissiveIntensity ?? 0,
      });
    }
  });

  return targets;
}

function normalizeName(name: string): string {
  return name
    .normalize("NFKC")
    .replace(/[\u0000-\u0020\u007f-\u00a0\u1680\u180e\u2000-\u200b\u2028\u2029\u202f\u205f\u3000\ufeff]/g, "")
    .replace(/^_+/, "")
    .toLowerCase();
}
