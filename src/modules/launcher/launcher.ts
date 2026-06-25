import * as THREE from "three";
import type { Ball } from "@modules/ball";

export interface LauncherOptions {
  /** Durée (s) de maintien d'Espace pour atteindre la puissance maximale. */
  maxCharge?: number;
  /** Demi-largeur (axe X) de la zone de lancement, en unités monde. */
  zoneHalfWidth?: number;
  /** Étendue de la zone vers l'arrière (butée du plunger). */
  zoneBackMargin?: number;
  /** Étendue de la zone vers l'avant (sortie du couloir vers le plateau). */
  zoneFrontMargin?: number;
}

/**
 * Plunger (lanceur à ressort) sans asset 3D dédié : la bille passe sous le
 * tunnel de lancement donc le plunger n'est jamais visible, seul le
 * comportement physique compte.
 *
 * - Maintenir Espace compresse le ressort : la puissance accumulée croît avec
 *   la durée de l'appui, jusqu'à `maxCharge`.
 * - Relâcher Espace frappe la bille avec une impulsion vers l'avant (axe +z
 *   du couloir), proportionnelle (de façon non-linéaire, façon ressort réel)
 *   à la puissance accumulée.
 * - Le plunger n'agit (ni charge, ni frappe) que si la bille est physiquement
 *   présente dans le couloir de lancement.
 */
export class Launcher {
  mesh: THREE.Mesh;
  // State
  private isCharging: boolean = false;
  private chargeTime: number = 0;
  private readonly maxCharge: number;

  private readonly zoneCenter: THREE.Vector2;
  private readonly zoneHalfWidth: number;
  private readonly zoneBackMargin: number;
  private readonly zoneFrontMargin: number;

  private ball: Ball;

  private initialZ: number;
  // Constructor
  constructor(ball: Ball, options: LauncherOptions = {}) {
    this.ball = ball;
    this.maxCharge = options.maxCharge ?? 1.4;

    const geometry = new THREE.CylinderGeometry(0.2, 0.2, 2, 16);
    const material = new THREE.MeshStandardMaterial({ color: 0x888888 });

    this.mesh = new THREE.Mesh(geometry, material);

    // Position
    this.mesh.position.set(-7.6, 4.9, -13.4);

    // Inclinaison
    // léger angle vers la table
    this.mesh.rotation.x = -Math.PI / 3; // ~ -30°
    this.mesh.rotation.z = 0.15; // léger décalage esthétique

    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;

    this.initialZ = this.mesh.position.z;

    // Zone de lancement : couloir étroit autour du plunger. La bille y
    // démarre (cf. `initialPosition` de `Ball`) et doit y rester pour que le
    // plunger puisse charger/frapper.
    this.zoneCenter = new THREE.Vector2(this.mesh.position.x, this.mesh.position.z);
    this.zoneHalfWidth = options.zoneHalfWidth ?? 0.45;
    this.zoneBackMargin = options.zoneBackMargin ?? 0.6;
    this.zoneFrontMargin = options.zoneFrontMargin ?? 3.2;
  }

  /** Vrai si la bille est actuellement dans le couloir de lancement. */
  isBallInLaunchZone(): boolean {
    const position = this.ball.mesh.position;

    const dx = Math.abs(position.x - this.zoneCenter.x);
    if (dx > this.zoneHalfWidth) return false;

    const dz = position.z - this.zoneCenter.y;
    return dz >= -this.zoneBackMargin && dz <= this.zoneFrontMargin;
  }

  /** Début de la charge (touche maintenue). L'input est câblé en dehors. */
  startCharge(): void {
    if (this.isCharging) return;
    // Pas de charge si la bille n'est pas dans le couloir : on ne veut pas
    // qu'Espace ait un effet quelconque ailleurs sur le plateau.
    if (!this.isBallInLaunchZone()) return;

    this.isCharging = true;
    this.chargeTime = this.maxCharge;
  }

  /** Relâche le lanceur : propulse la bille selon la charge accumulée. */
  release(): void {
    if (!this.isCharging) return;
    this.isCharging = false;

    this.chargeTime = 0;

    // Si la bille a quitté le couloir pendant la charge (cas limite), on
    // n'applique aucune frappe : le plunger n'agit que sur une bille présente.
    if (!this.isBallInLaunchZone()) return;

    // La bille attend gelée dans le couloir : on la réintègre à la simulation
    // avant de la propulser (un corps gelé ignore vitesses et impulsions).
    this.ball.unfreeze();

    // Courbe non-linéaire (quadratique) : un ressort réel restitue son
    // énergie de façon progressive puis de plus en plus franche, pas
    // linéairement avec le temps de compression.
    // Impulsion vers le haut de la nouvelle table Blender (axe +z).
    // Puissance augmentée pour qu'une charge à fond envoie la bille bien plus
    // haut dans le couloir / sur le plateau.
    const body = this.ball.getBody();
    if (!body) return;

    this.ball.allowTemporaryMaxLinearSpeed(18, 3);
    const velocity = body.linvel();
    body.setLinvel(
      {
        x: velocity.x * 0.35,
        y: Math.max(velocity.y, 0),
        z: Math.max(velocity.z, 15),
      },
      true,
    );
    this.ball.applyImpulse({ x: 0, y: 0, z: 2.2 });
  }

  update(_deltaTime?: number) {
    if (this.isCharging) {
      // Sécurité : si la bille sort du couloir en cours de charge, on
      // annule proprement (le plunger ne doit agir que sur une bille présente).
      if (!this.isBallInLaunchZone()) {
        this.isCharging = false;
        this.chargeTime = 0;
      } else {
        this.chargeTime = this.maxCharge;
      }
    }

    // animation (la compression visuelle n'est jamais rendue, cf. docstring,
    // mais reste utile pour du debug / une future GUI).
    const compression = this.chargeTime / this.maxCharge;
    this.mesh.position.z = this.initialZ + compression * 0.75;
  }

  addTo(scene: THREE.Scene) {
    scene.add(this.mesh);
  }
}
