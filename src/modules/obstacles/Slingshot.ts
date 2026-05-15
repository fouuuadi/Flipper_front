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

  private readonly maxLinearSpeed = 6.0; 
  private readonly maxHorizontalSpeed = 4.2;
  private readonly inwardBias = 0.55;

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
    // Ici on active les events Rapier
    colDesc.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    colDesc.setRestitution(0.6);
    colDesc.setFriction(0.25);
    this.collider = world.createCollider(colDesc, this.rigidBody);
    this.center = { x, y: 0.5, z: 1 };
  }
 
  setBallBody(body: RAPIER.RigidBody | null): void {
    this.ballBody = body;
  }

  // Ici on active le hit
  notifyHit(): void {
    if (this.cooldownTimer > 0) return;
    this.kickBall();
  }

   update(ball?: Ball, deltaTime: number = 0) {

    if (this.cooldownTimer > 0) {
      this.cooldownTimer = Math.max(0, this.cooldownTimer - deltaTime);
    }

    if (this.hitTimer > 0) {
      this.hitTimer = Math.max(0, this.hitTimer - deltaTime);
      if (this.hitTimer === 0) {
        this.material.color.setHex(this.defaultColor);
        this.material.emissive.setHex(0x000000);
        this.material.needsUpdate = true;
      }
    }

    if (!ball || !this.ballBody) return;

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