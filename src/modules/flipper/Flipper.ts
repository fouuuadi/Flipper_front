import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { PLAYFIELD_TILT_DEG } from "@modules/playfield/Playfield";

type FlipperSide = "left" | "right";

export class Flipper {
  mesh: THREE.Mesh;
  rigidBody: RAPIER.RigidBody;
  collider: RAPIER.Collider;

  private isActive = false;
  private angle = 0;
  private readonly activeAngle: number;
  private readonly restAngle: number;
  private readonly minLimit: number;
  private readonly maxLimit: number;
  private readonly playfieldPitch: number;

  constructor(world: RAPIER.World, side: FlipperSide) {
    const flipperLength = 0.86;
    const flipperHeight = 0.18;
    const flipperDepth = 0.28;
    const hingeInset = 0.08;
    // [FIX] La pointe d'un flipper s'étend vers le CENTRE de la table (les deux
    // flippers se font face), pas vers l'extérieur. Pivot gauche ≈ x=+0.82,
    // pivot droit ≈ x=-0.68 (mesuré via les logs de BlenderFlipperBridge) :
    // donc la pointe gauche doit s'étendre vers x négatif (vers le centre) et
    // la pointe droite vers x positif. L'ancien code faisait l'inverse
    // (gauche vers +x, droite vers -x, donc vers l'EXTÉRIEUR de la table) —
    // le collider (et son offset local, identique) couvrait alors le côté
    // opposé à la vraie pointe visible, là où la balle ne passe jamais,
    // laissant la vraie pointe (visible, côté centre) sans collider : la
    // balle traversait donc le flipper près de sa pointe, exactement comme
    // signalé.
    const localOffsetX =
      side === "left" ? -(flipperLength / 2 - hingeInset) : flipperLength / 2 - hingeInset;

    const geometry = new THREE.BoxGeometry(flipperLength, flipperHeight, flipperDepth);
    geometry.translate(localOffsetX, 0, 0);
    const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });

    this.mesh = new THREE.Mesh(geometry, material);

    // Position des pivots en bas de table, côté drain
    const xOffset = side === "left" ? -1.02 : 1.02;
    const zPosition = 4.2;
    this.playfieldPitch = THREE.MathUtils.degToRad(PLAYFIELD_TILT_DEG);
    const yPosition = 0.14 - Math.tan(this.playfieldPitch) * zPosition;

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

<<<<<<< Updated upstream
    const colliderDesc = RAPIER.ColliderDesc.cuboid(
      flipperLength / 2,
      flipperHeight / 2,
      flipperDepth / 2,
=======
    // [RÉDUIT] Maintenant que la direction du pivot est confirmée correcte
    // (logs : pivot physique ≈ pivot Blender à 2cm près) et que la balle est
    // bien détectée/frappée, on resserre le collider autour de la vraie
    // palette : on garde une petite marge de sécurité (pas le 1.3x/1.5x
    // d'origine qui faisait chevaucher les deux flippers au repos), pour
    // qu'il colle visuellement aux deux flippers sans se toucher entre eux.
    // [FIX] 1.1x faisait déborder chaque collider jusqu'à ~14cm au-delà de la
    // pointe visuelle ; les deux colliders (gauche + droit) se chevauchaient
    // alors au centre, créant un "pont" invisible sur lequel la balle se
    // posait sans toucher ni l'un ni l'autre flipper. 0.9x laisse un petit
    // espace entre les deux pointes (comme visuellement), et la hauteur/l'offset
    // sont recentrés sur le mesh visuel (qui fait 0.18 de haut) au lieu de
    // flotter au-dessus.
    // [AJUSTÉ] largeur (depth) réduite à 1.0x (au lieu de 1.2x) pour coller plus
    // près de la vraie palette, et longueur réduite à 0.85x (au lieu de 0.9x)
    // pour creuser un peu plus l'écart entre les deux pointes au repos.
    // [FIX] Chaque collider est tourné (angle de repos propre à chaque flipper),
    // donc ses coins intérieurs se rapprochent bien plus que ne le laisse penser
    // un calcul "à plat" — c'est ce qui faisait toucher les deux boîtes au
    // centre même après le 0.85x précédent (cf. capture : les boîtes se
    // touchent par leur coin, pas par leur face). On réduit plus franchement
    // la longueur et la hauteur pour garantir un vrai espace au repos, afin
    // que la balle puisse tomber entre les deux si elle n'est pas rattrapée.
    // [FIX] Le mesh Blender réel du flipper est centré ~3-4cm plus bas que
    // yPosition (mesuré : centre Blender gauche=0.390/droit=0.359, contre
    // yPosition=0.43/0.40 utilisé par le rigidBody) — le collider (centré sur
    // yPosition + colliderYOffset) flottait donc au-dessus de la vraie
    // palette visible, créant le "plafond" invisible où la balle se bloquait
    // (cf. capture annotée en jaune). On baisse colliderYOffset pour
    // redescendre tout le collider au niveau réel de la palette.
    const colliderLength = flipperLength * 0.5;
    const colliderHeight = 0.1;
    const colliderDepth = flipperDepth * 1.0;
    const colliderYOffset = -0.09;
    this.colliderLocalOffset = new THREE.Vector3(localOffsetX, colliderYOffset, 0);
    const colliderDesc = RAPIER.ColliderDesc.cuboid(
      // [FIX] RAPIER.ColliderDesc.cuboid() attend des DEMI-extents. "/ 1" faisait
      // un collider 2x plus long que prévu (et 2x plus long que le wireframe vert
      // affiché, qui lui utilise la bonne taille) — la balle se cognait contre un
      // collider invisible bien plus large que ce qui était visible à l'écran.
      colliderLength / 2,
      colliderHeight / 2,
      colliderDepth / 2,
>>>>>>> Stashed changes
    )
      .setTranslation(localOffsetX, 0, 0)
      .setFriction(0.55)
      .setRestitution(0.2);
    this.collider = world.createCollider(colliderDesc, this.rigidBody);

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
  }

<<<<<<< Updated upstream
  /** Active le flipper (touche maintenue). L'input est câblé en dehors. */
=======
  /**
   * [FIX] Le carré vert (collider) ne fait QUE englober le vrai mesh
   * Blender "Flipper_left"/"Flipper_right" — au lieu des dimensions estimées
   * à la main (flipperLength/flipperDepth/colliderYOffset plus haut) qui ne
   * collaient jamais exactement (d'où le "plafond" et l'angle qui semblait
   * faux). Appelé une fois le GLB chargé (cf. BlenderTableLoader.ts). Avant
   * cet appel, le flipper garde les dimensions approximatives ci-dessus (pas
   * de collider manquant pendant le chargement du GLB).
   */
  fitToBlenderMesh(mesh: THREE.Object3D, world: RAPIER.World): void {
    // [BUG TROUVÉ] La version précédente prenait la bounding box MONDE du
    // mesh (déjà axis-aligned, donc gonflée pour un objet tourné) et essayait
    // de la "dé-tourner" en supposant que la SEULE rotation présente était
    // `this.restAngle` (l'angle de repos du flipper physique). Or ce GLB
    // vient d'une chaîne Sketchfab/Collada ("Sketchfab_model...",
    // "Collada_visual_scene_group...", visibles dans les logs) qui bake
    // souvent une rotation supplémentaire (changement d'axes) dans les
    // parents du mesh — donc la vraie rotation totale du mesh n'égale PAS
    // `restQuat`. Résultat : la boîte "dé-tournée" était mal orientée, et en
    // la ré-appliquant via la rotation courante du flipper ça donnait un
    // wireframe vert déformé qui pouvait sembler "levé" même au repos.
    // [FIX] On utilise à la place la bounding box LOCALE de la géométrie
    // (espace objet du mesh, indépendante de toute rotation/hiérarchie), et
    // on la transforme directement via `mesh.matrixWorld` (la vraie
    // transformation complète, peu importe ce qu'elle contient) combinée à
    // l'inverse de la transformation de repos du rigidBody. Aucune
    // hypothèse sur le contenu exact des rotations parentes n'est nécessaire.
    mesh.updateWorldMatrix(true, false);
    const geometry = mesh.geometry as THREE.BufferGeometry | undefined;
    if (!geometry) return;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    const localBox = geometry.boundingBox;
    if (!localBox || localBox.isEmpty()) return;

    const restQuat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(this.playfieldPitch, this.restAngle, 0, "XYZ"),
    );
    const bodyRestMatrix = new THREE.Matrix4().compose(
      this.bodyPosition,
      restQuat,
      new THREE.Vector3(1, 1, 1),
    );
    const meshToBodyRest = bodyRestMatrix.clone().invert().multiply(mesh.matrixWorld);

    const corners = [
      new THREE.Vector3(localBox.min.x, localBox.min.y, localBox.min.z),
      new THREE.Vector3(localBox.min.x, localBox.min.y, localBox.max.z),
      new THREE.Vector3(localBox.min.x, localBox.max.y, localBox.min.z),
      new THREE.Vector3(localBox.min.x, localBox.max.y, localBox.max.z),
      new THREE.Vector3(localBox.max.x, localBox.min.y, localBox.min.z),
      new THREE.Vector3(localBox.max.x, localBox.min.y, localBox.max.z),
      new THREE.Vector3(localBox.max.x, localBox.max.y, localBox.min.z),
      new THREE.Vector3(localBox.max.x, localBox.max.y, localBox.max.z),
    ];

    const localMin = new THREE.Vector3(Infinity, Infinity, Infinity);
    const localMax = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
    for (const corner of corners) {
      corner.applyMatrix4(meshToBodyRest);
      localMin.min(corner);
      localMax.max(corner);
    }

    const localCenter = localMin.clone().add(localMax).multiplyScalar(0.5);
    const halfExtents = localMax.clone().sub(localMin).multiplyScalar(0.5);

    if (halfExtents.x <= 0 || halfExtents.y <= 0 || halfExtents.z <= 0) {
      console.warn(`⚠️ Flipper "${this.side}" : bounding box Blender invalide, collider non modifié`);
      return;
    }

    world.removeCollider(this.collider, true);
    const colliderDesc = RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z)
      .setTranslation(localCenter.x, localCenter.y, localCenter.z)
      .setFriction(0.55)
      .setRestitution(0.35)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    this.collider = world.createCollider(colliderDesc, this.rigidBody);

    this.colliderLocalOffset.copy(localCenter);

    this.colliderDebugMesh.geometry.dispose();
    this.colliderDebugMesh.geometry = new THREE.BoxGeometry(
      halfExtents.x * 2,
      halfExtents.y * 2,
      halfExtents.z * 2,
    );

    console.log(
      `📦 Flipper "${this.side}" : collider ajusté au mesh Blender réel — demi-extents=(${halfExtents.x.toFixed(3)}, ${halfExtents.y.toFixed(3)}, ${halfExtents.z.toFixed(3)}) centre local=(${localCenter.x.toFixed(3)}, ${localCenter.y.toFixed(3)}, ${localCenter.z.toFixed(3)})`,
    );
  }

  /** Active le flipper (touche pressée). */
>>>>>>> Stashed changes
  press(): void {
    this.isActive = true;
  }

  /** Relâche le flipper (touche relâchée). */
  release(): void {
    this.isActive = false;
  }

  update(deltaTime: number) {
    const speed = 16;
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
  }

  addTo(scene: THREE.Scene) {
    scene.add(this.mesh);
  }
}
