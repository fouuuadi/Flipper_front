import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { EventBus } from "@core/EventBus";
import type { Ball } from "@modules/ball";

type SlingshotSide = "left" | "right";

// Ici on gere le typage du payload pour l'EventBus
export interface SlingshotHitPayload {
  side: SlingshotSide;
  position: { x: number; y: number; z: number };
  impulse: { x: number; y: number; z: number };
}

interface SlingshotEventMap extends Record<string, unknown> {
  slingshot_hit: SlingshotHitPayload;
}

export class Slingshot {
  mesh: THREE.Mesh;
  private side: SlingshotSide;

  rigidBody!: RAPIER.RigidBody;
  collider!: RAPIER.Collider;

  private material: THREE.MeshStandardMaterial;
  private hitTimer = 0;

  private eventBus = EventBus.getInstance<SlingshotEventMap>();

  private ballBody: RAPIER.RigidBody | null = null;

  private cooldownTimer = 0;
  private readonly cooldownDuration = 0.14; // s

  private readonly defaultColor = 0x00ff00;
  private readonly hitColor = 0xffee44;
  private readonly hitFlashDuration = 0.18; // s

  // Ici on gere la sortie de balle du flippers
  private readonly kickStrength = 0.28;
  private readonly kickVerticalBoost = 0.07;
  private readonly kickInwardBoost = -0.05;

  private readonly center: { x: number; y: number; z: number };
  private readonly triggerRadius = 0.78;

  private readonly maxLinearSpeed = 6.0; // m/s : vitesse globale max post-kick
  private readonly maxHorizontalSpeed = 4.2; // m/s : vitesse latérale (x/z) max
  private readonly inwardBias = 0.55; // 0..1 : part de l'impulsion redirigée vers le centre table

  constructor(world: RAPIER.World, side: SlingshotSide) {
    this.side = side;

    const geometry = new THREE.BufferGeometry();

    const vertices = new Float32Array([
      0, 0, 0,
      1, 0, 0,
      0, 0, 1,
    ]);

    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(vertices, 3)
    );

    geometry.computeVertexNormals();

    this.material = new THREE.MeshStandardMaterial({
      color: 0x00ff00,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(geometry, this.material);

    const x = this.side === "left" ? -2 : 2;

    this.mesh.position.set(x, 0.5, 1);

    if (this.side === "right") {
      this.mesh.rotation.y = Math.PI;
    }

    const rbDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, 0.5, 1);
    this.rigidBody = world.createRigidBody(rbDesc);

    const colDesc = RAPIER.ColliderDesc.cuboid(0.5, 0.1, 0.5);
    // ✨ ISSUE 19 — on active les events Rapier + bounce arcade pour un vrai feeling flipper
    colDesc.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    colDesc.setRestitution(0.6); // ✨ FIX : on évite la restitution > 1 qui gonfle l'énergie
    colDesc.setFriction(0.25);
    this.collider = world.createCollider(colDesc, this.rigidBody);

    // ✨ ISSUE 19 — on stocke le centre du slingshot pour les checks de proximité
    this.center = { x, y: 0.5, z: 1 };
  }

  /**
   * ✨ ISSUE 19 — permet à main.ts de fournir le RigidBody de la balle
   * pour pouvoir lui appliquer une vraie impulsion physique.
   */
  setBallBody(body: RAPIER.RigidBody | null): void {
    this.ballBody = body;
  }

  /**
   * ✨ ISSUE 19 — déclenchement manuel d'un hit (utilisable par main.ts
   * depuis l'EventQueue Rapier si on veut chaîner les deux systèmes).
   */
  notifyHit(): void {
    if (this.cooldownTimer > 0) return;
    this.kickBall();
  }

  update(ball?: Ball, deltaTime: number = 0) {
    // collision gérée dans main.ts via EventQueue

    // ─── Cooldown anti-spam ──────────────────────────────────────
    if (this.cooldownTimer > 0) {
      this.cooldownTimer = Math.max(0, this.cooldownTimer - deltaTime);
    }

    // ─── Flash : retour à la couleur normale après hitFlashDuration
    if (this.hitTimer > 0) {
      this.hitTimer = Math.max(0, this.hitTimer - deltaTime);
      if (this.hitTimer === 0) {
        this.material.color.setHex(this.defaultColor);
        this.material.emissive.setHex(0x000000);
        this.material.needsUpdate = true;
      }
    }

    if (!ball || !this.ballBody) return;

    // ─── Détection de proximité (collision robuste, indépendante du queue) ──
    const ballPos = ball.mesh.position;
    const dx = ballPos.x - this.center.x;
    const dy = ballPos.y - this.center.y;
    const dz = ballPos.z - this.center.z;
    const distSq = dx * dx + dy * dy + dz * dz;
    const r = this.triggerRadius;

    if (distSq < r * r && this.cooldownTimer <= 0) {
      this.kickBall();
    }
  }

  /**
   * ✨ ISSUE 19 — applique l'impulsion arcade + flash + emit `slingshot_hit`.
   * - slingshot gauche  → pousse la balle vers la droite (+x)
   * - slingshot droit   → pousse la balle vers la gauche (-x)
   */
  private kickBall(): void {
    if (!this.ballBody) return;

    const dirX = this.side === "left" ? 1 : -1;

    const impulse = {
      x: dirX * this.kickStrength,
      y: this.kickVerticalBoost,
      z: this.kickInwardBoost,
    };

    // On atténue la vitesse latérale courante pour que l'impulsion ait du punch
    const currentLin = this.ballBody.linvel();
    this.ballBody.setLinvel(
      {
        x: currentLin.x * 0.35,
        y: currentLin.y,
        z: currentLin.z * 0.6,
      },
      true,
    );

    this.ballBody.applyImpulse(impulse, true);

    // ✨ FIX — Bias "vers le centre table" : on redirige une partie de la
    // vélocité X vers x=0 pour éviter que la balle ne file droit dans le mur.
    // (slingshot gauche  → balle propulsée à droite mais ramenée vers le centre)
    // (slingshot droit   → balle propulsée à gauche mais ramenée vers le centre)
    const linAfterImpulse = this.ballBody.linvel();
    const towardCenterX = -Math.sign(this.center.x); // gauche=+1, droit=-1
    const biasedX =
      linAfterImpulse.x * (1 - this.inwardBias) +
      Math.abs(linAfterImpulse.x) * towardCenterX * this.inwardBias;
    this.ballBody.setLinvel(
      { x: biasedX, y: linAfterImpulse.y, z: linAfterImpulse.z },
      true,
    );

    // ✨ FIX — Clamp horizontal (x/z) : empêche la balle de filer trop vite
    // latéralement et de traverser/sauter les walls.
    const linH = this.ballBody.linvel();
    const horizSq = linH.x * linH.x + linH.z * linH.z;
    if (horizSq > this.maxHorizontalSpeed * this.maxHorizontalSpeed) {
      const horiz = Math.sqrt(horizSq);
      const k = this.maxHorizontalSpeed / horiz;
      this.ballBody.setLinvel(
        { x: linH.x * k, y: linH.y, z: linH.z * k },
        true,
      );
    }

    // ✨ FIX — Clamp global de vitesse : safety net anti-éjection.
    const linFinal = this.ballBody.linvel();
    const speedSq =
      linFinal.x * linFinal.x +
      linFinal.y * linFinal.y +
      linFinal.z * linFinal.z;
    if (speedSq > this.maxLinearSpeed * this.maxLinearSpeed) {
      const speed = Math.sqrt(speedSq);
      const k = this.maxLinearSpeed / speed;
      this.ballBody.setLinvel(
        { x: linFinal.x * k, y: linFinal.y * k, z: linFinal.z * k },
        true,
      );
    }

    // ✨ FIX — On coupe aussi tout spin angulaire excessif (peut faire fuser la balle)
    const ang = this.ballBody.angvel();
    const angCap = 18; // rad/s
    const angSq = ang.x * ang.x + ang.y * ang.y + ang.z * ang.z;
    if (angSq > angCap * angCap) {
      const a = Math.sqrt(angSq);
      const k = angCap / a;
      this.ballBody.setAngvel(
        { x: ang.x * k, y: ang.y * k, z: ang.z * k },
        true,
      );
    }

    // Anti-spam (la balle peut rester proche plusieurs frames)
    this.cooldownTimer = this.cooldownDuration;

    // Flash visuel
    this.material.color.setHex(this.hitColor);
    this.material.emissive.setHex(0x554400);
    this.material.needsUpdate = true;
    this.hitTimer = this.hitFlashDuration;

    // Emit EventBus pour le reste du jeu (score, audio, FX, etc.)
    this.eventBus.emit("slingshot_hit", {
      side: this.side,
      position: { ...this.center },
      impulse,
    });

    console.log(`💥 Slingshot ${this.side} HIT — impulse:`, impulse);
  }

  addTo(scene: THREE.Scene) {
    scene.add(this.mesh);
  }
}
