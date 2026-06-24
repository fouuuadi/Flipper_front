import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import type { RapierPhysicsAdapter } from "@physics/RapierPhysicsAdapter";
import type { Ball } from "@modules/ball/Ball";
import type { NamedPhysicsCollider } from "@modules/table/BlenderPhysicsColliders";

export interface SlingshotOptions {
  /** Impulsion de base (N·s) appliquée même à vitesse nulle, façon ressort précontraint. */
  baseImpulse?: number;
  /** Facteur multipliant la vitesse d'arrivée de la bille pour amplifier le kick. */
  speedFactor?: number;
  /** Impulsion verticale additionnelle pour un effet de "pop" arcade. */
  popImpulse?: number;
  /** Durée minimale (s) entre deux déclenchements, pour éviter les doubles-kicks sur un même contact. */
  cooldown?: number;
}

/**
 * Slingshot actif façon flipper arcade.
 *
 * Contrairement à un obstacle passif (restitution simple), ce module écoute
 * les événements de collision Rapier entre la bille et le collider du
 * triangle "Slingshot_triangle", puis calcule lui-même une impulsion :
 * - dirigée depuis le centre du slingshot vers le point de contact (donc
 *   globalement "vers l'endroit d'où vient la bille"),
 * - amplifiée selon la vitesse d'arrivée de la bille,
 * - appliquée instantanément (un seul `applyImpulse`), pour un ressenti
 *   réactif comparable à un ressort plutôt qu'à un simple rebond physique.
 */
export class Slingshot {
  private readonly collider: RAPIER.Collider;
  private readonly center: THREE.Vector3;

  private readonly baseImpulse: number;
  private readonly speedFactor: number;
  private readonly popImpulse: number;
  private readonly cooldown: number;

  private elapsed = 0;
  private lastTriggerTime = -Infinity;

  constructor(
    private readonly physics: RapierPhysicsAdapter,
    private readonly ball: Ball,
    namedCollider: NamedPhysicsCollider,
    options: SlingshotOptions = {},
  ) {
    this.collider = namedCollider.collider;
    this.center = namedCollider.center;

    this.baseImpulse = options.baseImpulse ?? 0.55;
    this.speedFactor = options.speedFactor ?? 0.22;
    this.popImpulse = options.popImpulse ?? 0.06;
    this.cooldown = options.cooldown ?? 0.1;

    this.physics.onCollision((handle1, handle2, started) => {
      this.handleCollision(handle1, handle2, started);
    });
  }

  /** À appeler chaque frame pour faire avancer l'horloge interne du cooldown. */
  update(deltaTime: number): void {
    this.elapsed += deltaTime;
  }

  private handleCollision(handle1: number, handle2: number, started: boolean): void {
    if (!started) return;

    const ballCollider = this.ball.getCollider();
    if (!ballCollider) return;

    const slingshotHandle = this.collider.handle;
    const ballHandle = ballCollider.handle;

    const isMatch =
      (handle1 === slingshotHandle && handle2 === ballHandle) ||
      (handle2 === slingshotHandle && handle1 === ballHandle);
    if (!isMatch) return;

    if (this.elapsed - this.lastTriggerTime < this.cooldown) return;
    this.lastTriggerTime = this.elapsed;

    this.applyKick(ballCollider);
  }

  private applyKick(ballCollider: RAPIER.Collider): void {
    const body = this.ball.getBody();
    if (!body) return;

    const world = this.physics.getWorld();

    let normal = new THREE.Vector3(0, 1, 0);
    let contactPoint: THREE.Vector3 | null = null;
    let matched = false;

    world.contactPair(this.collider, ballCollider, (manifold, flipped) => {
      const n = manifold.normal();
      // `normal()` va de collider1 vers collider2. On veut une normale qui
      // pointe du slingshot vers la bille : on l'inverse si l'appel nous a
      // donné le couple "flippé" (bille en position 1).
      normal = new THREE.Vector3(n.x, n.y, n.z);
      if (flipped) normal.negate();

      if (manifold.numContacts() > 0) {
        const p = manifold.solverContactPoint(0);
        contactPoint = new THREE.Vector3(p.x, p.y, p.z);
      }
      matched = true;
    });

    if (!matched) return;

    // Direction principale : du centre du triangle vers le point de contact.
    // Ça repousse la bille "vers l'endroit d'où elle est venue" plutôt que de
    // suivre une normale de solveur parfois instable sur un convex hull fin.
    const resolvedContactPoint = contactPoint as THREE.Vector3 | null;
    const pushDirection = resolvedContactPoint
      ? resolvedContactPoint.clone().sub(this.center)
      : normal.clone();

    if (pushDirection.lengthSq() < 1e-6) pushDirection.copy(normal);

    // On évite d'enfoncer la bille dans le plateau : composante verticale
    // toujours positive (léger "pop" vers le haut, comme un vrai slingshot).
    pushDirection.y = Math.max(pushDirection.y, 0.05);
    if (pushDirection.lengthSq() < 1e-6) pushDirection.set(0, 1, 0);
    pushDirection.normalize();

    const linvel = body.linvel();
    const incomingSpeed = Math.sqrt(linvel.x ** 2 + linvel.y ** 2 + linvel.z ** 2);

    // Réponse "ressort" : une base fixe + un terme proportionnel à la vitesse
    // d'arrivée, pour que la bille reparte plus fort si elle arrive vite.
    const magnitude = this.baseImpulse + incomingSpeed * this.speedFactor;

    const impulse = pushDirection.multiplyScalar(magnitude);
    impulse.y += this.popImpulse;

    this.ball.applyImpulse({ x: impulse.x, y: impulse.y, z: impulse.z });
  }
}
