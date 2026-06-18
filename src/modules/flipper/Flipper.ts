import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { PLAYFIELD_TILT_DEG } from "@modules/playfield/Playfield";

type FlipperSide = "left" | "right";

export class Flipper {
  mesh: THREE.Mesh;
  rigidBody: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  readonly side: FlipperSide;

  // [DEBUG] Wireframe affichant la forme/position EXACTE du collider physique
  // du flipper, pour vérifier visuellement s'il est bien aligné avec le vrai
  // mesh Blender (sans ça, impossible de savoir pourquoi la balle "passe à
  // travers" sans accès au navigateur).
  private readonly colliderDebugMesh: THREE.Mesh;
  private readonly colliderLocalOffset: THREE.Vector3;
  private readonly bodyPosition: THREE.Vector3;

  private isActive = false;
  private angle = 0;
  private readonly activeAngle: number;
  private readonly restAngle: number;
  private readonly minLimit: number;
  private readonly maxLimit: number;
  private readonly playfieldPitch: number;

  constructor(world: RAPIER.World, side: FlipperSide) {
    this.side = side;
    const flipperLength = 0.86;
    const flipperHeight = 0.18;
    const flipperDepth = 0.28;
    const hingeInset = 0.08;
    const localOffsetX =
      side === "left" ? flipperLength / 2 - hingeInset : -(flipperLength / 2 - hingeInset);

    const geometry = new THREE.BoxGeometry(flipperLength, flipperHeight, flipperDepth);
    geometry.translate(localOffsetX, 0, 0);
    const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });

    this.mesh = new THREE.Mesh(geometry, material);

    const xOffset = side === "left" ? 0.82 : -0.68;
    const zPosition = -2.33;
    const yPosition = side === "left" ? 0.43 : 0.4;
    this.playfieldPitch = -THREE.MathUtils.degToRad(PLAYFIELD_TILT_DEG);

    this.restAngle = side === "left" ? 0.18 : -0.18;
    this.activeAngle = side === "left" ? 0.78 : -0.78;
    this.minLimit = side === "left" ? -0.28 : -0.92;
    this.maxLimit = side === "left" ? 0.92 : 0.28;
    this.angle = this.restAngle;

    this.mesh.position.set(xOffset, yPosition, zPosition);
    this.mesh.rotation.set(this.playfieldPitch, this.angle, 0, "XYZ");

    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;

    // Ici on gére la physique

    const rigidBodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
      xOffset,
      yPosition,
      zPosition,
    );

    this.rigidBody = world.createRigidBody(rigidBodyDesc);

    // Le collider est volontairement bien plus "épais"/"large" que le visuel
    // (et décalé vers le bas) : ni la hauteur exacte du sol Blender au niveau
    // des flippers, ni l'étendue réelle de la palette (longueur/profondeur)
    // ne sont garanties identiques aux valeurs estimées ici, donc on élargit
    // largement la zone de contact pour être sûr que la balle ne puisse
    // jamais "passer par-dessus" / en-dessous / à côté.
    const colliderLength = flipperLength * 1.3;
    const colliderHeight = 0.6;
    const colliderDepth = flipperDepth * 1.5;
    const colliderYOffset = -0.2;
    this.colliderLocalOffset = new THREE.Vector3(localOffsetX, colliderYOffset, 0);
    const colliderDesc = RAPIER.ColliderDesc.cuboid(
      colliderLength / 2,
      colliderHeight / 2,
      colliderDepth / 2,
    )
      .setTranslation(this.colliderLocalOffset.x, this.colliderLocalOffset.y, this.colliderLocalOffset.z)
      .setFriction(0.55)
      .setRestitution(0.35) // un vrai flipper "claque" la balle, pas un contact mou
      // [DEBUG] nécessaire pour que RapierPhysicsAdapter puisse logger les
      // collisions ball <-> flipper (sinon Rapier ne génère aucun événement).
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    this.collider = world.createCollider(colliderDesc, this.rigidBody);

    this.bodyPosition = new THREE.Vector3(xOffset, yPosition, zPosition);
    const debugGeometry = new THREE.BoxGeometry(colliderLength, colliderHeight, colliderDepth);
    const debugMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      wireframe: true,
      depthTest: false,
    });
    this.colliderDebugMesh = new THREE.Mesh(debugGeometry, debugMaterial);

    const pivotDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(xOffset, yPosition, zPosition);

    const pivot = world.createRigidBody(pivotDesc);

    const jointData = RAPIER.JointData.revolute(
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
    );

    jointData.limitsEnabled = true;
    jointData.limits = [this.minLimit, this.maxLimit];

    world.createImpulseJoint(jointData, pivot, this.rigidBody, true);

    // [DEBUG] Position initiale du wireframe (avant le premier update()).
    const restQuat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(this.playfieldPitch, this.angle, 0, "XYZ"),
    );
    this.colliderDebugMesh.position
      .copy(this.bodyPosition)
      .add(this.colliderLocalOffset.clone().applyQuaternion(restQuat));
    this.colliderDebugMesh.quaternion.copy(restQuat);
  }

  /** Active le flipper (touche pressée). */
  press(): void {
    this.isActive = true;
  }

  /** Relâche le flipper (touche relâchée). */
  release(): void {
    this.isActive = false;
  }

  update(deltaTime: number) {
    const speed = 22; // plus rapide = "claque" la balle comme un vrai flipper, pas une simple poussée
    const target = this.isActive ? this.activeAngle : this.restAngle;
    const delta = target - this.angle;
    const step = Math.sign(delta) * Math.min(Math.abs(delta), speed * deltaTime);

    this.angle += step;
    this.angle = Math.max(this.minLimit, Math.min(this.maxLimit, this.angle));

    // Ici on gére la rotation
    const threeQuat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(this.playfieldPitch, this.angle, 0, "XYZ"),
    );

    const rotation = new RAPIER.Quaternion(threeQuat.x, threeQuat.y, threeQuat.z, threeQuat.w);

    this.rigidBody.setNextKinematicRotation(rotation);

    this.mesh.rotation.set(this.playfieldPitch, this.angle, 0, "XYZ");

    // [DEBUG] Le collider réel est un cuboïde décalé localement
    // (colliderLocalOffset) DANS le repère du body avant rotation ; on
    // reproduit donc ici exactement la même composition (offset puis
    // rotation) pour que le wireframe affiche la vraie position physique.
    const offsetWorld = this.colliderLocalOffset.clone().applyQuaternion(threeQuat);
    this.colliderDebugMesh.position.copy(this.bodyPosition).add(offsetWorld);
    this.colliderDebugMesh.quaternion.copy(threeQuat);
  }

  addTo(scene: THREE.Scene) {
    // this.mesh (boîte rouge pleine) n'a jamais été ajoutée à la scène
    // (le vrai visuel est le mesh Blender, synchronisé via BlenderFlipperBridge) ;
    // on ne touche pas à ce comportement existant.
    // Seul le wireframe de debug du collider est ajouté ici.
    scene.add(this.colliderDebugMesh);
  }
}
