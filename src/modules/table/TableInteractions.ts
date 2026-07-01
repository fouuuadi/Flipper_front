import * as THREE from "three";
import { gsap } from "gsap";
// [Music] ici on gere la music : import du service audio pour les sons de gameplay
import { gameAudio } from "@services/gameAudio";
import type { Ball } from "@modules/ball";
import type { RapierPhysicsAdapter } from "@physics/RapierPhysicsAdapter";
import type { NamedPhysicsCollider } from "./BlenderPhysicsColliders";

type ColliderMap = Record<string, NamedPhysicsCollider>;

const Y_AXIS = new THREE.Vector3(0, 1, 0);

interface SpinState {
  tween: gsap.core.Tween;
  initialRotation: THREE.Quaternion;
  angle: { value: number };
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

const TUNNEL_TRIGGER_RADIUS = 0.72;
// Une rampe ("Rampe"/"Ramp_2") passe juste au-dessus de l'entrée du tunnel
// "Tunel_b" : sans cette marge, la détection ne regardait que la distance XZ
// et ignorait la hauteur, donc la balle se téléportait dès qu'elle était
// au-dessus du tunnel, même en train de rouler sur la rampe par-dessus.
const TUNNEL_TRIGGER_HEIGHT_MARGIN = 0.35;
// Délai pendant lequel le fallback de proximité du tunnel est désactivé
// après un contact avec une rampe (cf. lastRampContactAt plus bas).
const RAMP_TUNNEL_GUARD_DURATION = 0.5;

export class TableInteractions {
  private readonly handleToName = new Map<number, string>();
  private readonly visuals = new Map<string, THREE.Object3D>();
  private readonly cooldowns = new Map<string, number>();
  private readonly spinStates = new Map<THREE.Object3D, SpinState>();
  private readonly ligneFlashTargets: FlashTarget[];
  private ligneFlashTween: gsap.core.Tween | null = null;
  private readonly ligneFlashColor = new THREE.Color();

  private elapsed = 0;
  private shakeTime = 0;
  private previousShake = new THREE.Vector3();
  private tunnelTeleport: TunnelTeleport | null = null;
  private tunnelCooldownUntil = 0;
  // Dernier instant où la bille a touché une rampe ("Rampe"/"Ramp_2"). La
  // rampe passe juste à côté de l'entrée avant de "Tunel_c" : sans ce garde,
  // la détection par proximité du tunnel (fallback) déclenchait la
  // téléportation alors que la bille était encore sur la rampe, avant même
  // l'impulsion de saut, ce qui annulait le saut et faisait entrer la bille
  // par le mauvais côté (par-dessus/derrière au lieu de l'entrée frontale).
  private lastRampContactAt = -Infinity;

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
    this.updateShake(deltaTime);
    this.updateTunnelTeleport(deltaTime);
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
      this.bumpFrom(name, 0.72, 0.06);
      // [Music] ici on gere la music : son bumper sur les planètes
      gameAudio.playBumper();
    } else if (RAMP_BOOSTS.has(name)) {
      this.lastRampContactAt = this.elapsed;
      this.boostRamp(name);
    } else if (SPINNERS.has(name)) {
      this.spinMushroom(name);
      this.randomSpinnerKick();
    } else if (name === "Bump") {
      this.bumpFrom(name, 0.62, 0.05);
      this.startShake();
      // [Music] ici on gere la music : son bumper sur le bumper central
      gameAudio.playBumper();
    } else if (name in TUNNEL_PAIRS) {
      if (import.meta.env.DEV) {
        console.debug("[Tunnel] collision détectée avec", name, {
          tunnelTeleportEnCours: this.tunnelTeleport,
          tunnelCooldownUntil: this.tunnelCooldownUntil,
          elapsed: this.elapsed,
        });
      }
      this.startTunnelTeleport(name);
    } else if (name === LIGNE_NAME) {
      this.triggerLigneFlash();
    }
  }

  private triggerLigneFlash(): void {
    if (this.ligneFlashTargets.length === 0) return;

    this.ligneFlashTween?.kill();
    const state = { progress: 0 };
    this.ligneFlashTween = gsap.to(state, {
      progress: 1,
      duration: LIGNE_FLASH_DURATION,
      ease: "none",
      onUpdate: () => {
        // Enveloppe d'intensité : monte puis redescend une seule fois.
        const pulse = Math.sin(state.progress * Math.PI);
        // La teinte tourne sur plusieurs cycles pendant l'animation -> couleurs variées plutôt qu'une seule.
        const hue = (state.progress * LIGNE_FLASH_HUE_CYCLES) % 1;
        this.applyLigneFlash(pulse, hue);
      },
      onComplete: () => {
        this.resetLigneFlash();
        this.ligneFlashTween = null;
      },
    });
  }

  private applyLigneFlash(pulse: number, hue: number): void {
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
  }

  private resetLigneFlash(): void {
    for (const target of this.ligneFlashTargets) {
      if (target.material.color && target.baseColor) target.material.color.copy(target.baseColor);
      if (target.material.emissive) {
        target.material.emissive.copy(target.baseEmissive ?? new THREE.Color(0x000000));
      }
      if (target.material.emissiveIntensity !== undefined) {
        target.material.emissiveIntensity = target.baseEmissiveIntensity;
      }
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
    const horizontalSpeed = new THREE.Vector3(velocity.x, 0, velocity.z).length();
    if (horizontalSpeed < 0.35) return;

    const targetSpeed = Math.max(horizontalSpeed * 1.45, 4.2);
    const scale = targetSpeed / horizontalSpeed;

    body.setLinvel(
      {
        x: velocity.x * scale,
        // Petit "saut" perceptible quand la balle prend la rampe, plutôt
        // qu'un simple plancher de vitesse verticale quasi nul.
        y: Math.max(velocity.y, 0.85),
        z: velocity.z * scale,
      },
      true,
    );
    this.createBoostBurst(this.colliders[name]?.center ?? new THREE.Vector3());
  }

  private spinMushroom(name: string): void {
    const visual = this.visuals.get(name);
    if (!visual) return;

    // Si un spin est déjà en cours sur ce visuel, on le relance depuis le
    // même point de départ (même logique qu'un simple reset de "elapsed").
    const existing = this.spinStates.get(visual);
    const initialRotation = existing?.initialRotation ?? visual.quaternion.clone();
    existing?.tween.kill();

    const angle = { value: 0 };
    const tween = gsap.to(angle, {
      value: Math.PI * 2,
      duration: 0.38,
      ease: "power2.out",
      onUpdate: () => {
        visual.quaternion
          .copy(initialRotation)
          .multiply(new THREE.Quaternion().setFromAxisAngle(Y_AXIS, angle.value));
      },
      onComplete: () => {
        visual.quaternion.copy(initialRotation);
        this.spinStates.delete(visual);
      },
    });
    this.spinStates.set(visual, { tween, initialRotation, angle });
  }

  private randomSpinnerKick(): void {
    const angle = Math.random() * Math.PI * 2;
    const impulse = 0.55;
    this.ball.applyImpulse({
      x: Math.cos(angle) * impulse,
      y: 0.16,
      z: Math.sin(angle) * impulse,
    });
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

    const duration = 0.28;
    gsap.to(mesh.scale, { x: 2.8, y: 2.8, z: 2.8, duration, ease: "none" });
    gsap.to(material, {
      opacity: 0,
      duration,
      ease: "none",
      onComplete: () => {
        this.scene.remove(mesh);
        geometry.dispose();
        material.dispose();
      },
    });
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
    this.previousShake.set((Math.random() - 0.5) * strength, (Math.random() - 0.5) * strength, 0);
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

    // La bille vient de toucher/quitter une rampe : "Tunel_c" est juste à
    // côté de "Rampe"/"Ramp_2", donc le fallback par proximité la
    // téléporterait avant même qu'elle ait pu sauter par-dessus l'entrée
    // (saut annulé) et la ferait entrer par le dessus/l'arrière plutôt que
    // par l'entrée frontale réelle (détectée via la vraie collision plus
    // bas, dans handleCollision).
    if (this.elapsed - this.lastRampContactAt < RAMP_TUNNEL_GUARD_DURATION) return;

    const position = body.translation();
    for (const tunnelName of Object.keys(TUNNEL_PAIRS)) {
      const center = this.colliders[tunnelName]?.center;
      if (!center) continue;

      const distanceXZ = Math.hypot(position.x - center.x, position.z - center.z);
      const heightAboveEntrance = position.y - center.y;
      if (
        distanceXZ <= TUNNEL_TRIGGER_RADIUS &&
        heightAboveEntrance <= TUNNEL_TRIGGER_HEIGHT_MARGIN
      ) {
        this.startTunnelTeleport(tunnelName);
        return;
      }
    }
  }

  private startTunnelTeleport(from: string): void {
    if (this.tunnelTeleport || this.elapsed < this.tunnelCooldownUntil) {
      if (import.meta.env.DEV) {
        console.debug("[Tunnel] démarrage ignoré pour", from, {
          raison: this.tunnelTeleport ? "téléportation déjà en cours" : "cooldown global actif",
        });
      }
      return;
    }

    const to = TUNNEL_PAIRS[from];
    if (!to || !this.colliders[from] || !this.colliders[to]) {
      if (import.meta.env.DEV) {
        console.warn("[Tunnel] collider manquant, téléportation impossible", {
          from,
          to,
          colliderFromExiste: !!this.colliders[from],
          colliderToExiste: to ? !!this.colliders[to] : false,
        });
      }
      return;
    }

    if (import.meta.env.DEV) {
      console.debug("[Tunnel] téléportation démarrée :", from, "->", to);
    }

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
      if (import.meta.env.DEV && teleport) {
        console.warn("[Tunnel] sortie annulée, destination introuvable pour", teleport.to);
      }
      this.tunnelTeleport = null;
      return;
    }

    if (import.meta.env.DEV) {
      console.debug("[Tunnel] sortie par", teleport.to, "position cible :", destination);
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
    // La marge verticale (destination.y + 0.05, au lieu de + 0.22) règle le
    // passage à travers "wall_four". Mais réduire aussi la distance de
    // sortie à 0.55 plaçait la bille encore À L'INTÉRIEUR du collider de
    // "Tunel_c" (demi-diagonale ~0.96) : elle restait coincée à se
    // dépénétrer contre son propre tunnel après plusieurs passages. On
    // ressort donc plus loin (1.0, au-delà de cette demi-diagonale) tout en
    // gardant la hauteur basse.
    const exitPosition = destination.clone().addScaledVector(direction, 1.0);
    exitPosition.y = Math.max(body.translation().y, destination.y + 0.05);

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
  return stripInvisibleNameCharacters(name.normalize("NFKC")).replace(/^_+/, "").toLowerCase();
}

function stripInvisibleNameCharacters(name: string): string {
  return Array.from(name, (character) => {
    const code = character.codePointAt(0) ?? 0;
    const isInvisible =
      code <= 0x20 ||
      (code >= 0x7f && code <= 0xa0) ||
      code === 0x1680 ||
      code === 0x180e ||
      (code >= 0x2000 && code <= 0x200b) ||
      code === 0x2028 ||
      code === 0x2029 ||
      code === 0x202f ||
      code === 0x205f ||
      code === 0x3000 ||
      code === 0xfeff;
    return isInvisible ? "" : character;
  }).join("");
}
