import { BoxHelper, Vector3, type Object3D, type Scene } from "three";
import type { Flipper } from "@modules/flipper/Flipper";

/**
 * Synchronise un mesh de flipper issu du GLB Blender sur le flipper physique
 * correspondant. Le flipper physique (`Flipper`) gère déjà l'input clavier et
 * écrit son angle courant dans `mesh.rotation.y` à chaque frame ; le bridge se
 * contente de reporter le delta d'angle (par rapport au repos) sur le mesh
 * Blender. Aucune logique clavier ici — une seule source de vérité.
 */
export class BlenderFlipperBridge {
  private readonly flipper: Flipper;
  private readonly blenderMesh: Object3D;
  private readonly initialMeshRotationY: number;
  private readonly baseFlipperAngle: number;

  // [DEBUG] Compteur de frames pour throttler les logs de diagnostic
  // demandés (position physique vs position Blender) sans spammer la console.
  private frameCount = 0;
  // [DEBUG] Position monde réelle du mesh Blender au repos, capturée une
  // seule fois au chargement, pour comparaison avec le pivot du rigidBody.
  private readonly initialBlenderWorldPos: Vector3;

  // [DEBUG] Demandé : un wireframe qui englobe le VRAI mesh Blender, calculé
  // par Three.js lui-même (THREE.BoxHelper recalcule la bounding box monde
  // de l'objet à chaque `.update()`) — donc AUCUNE formule maison, aucune
  // hypothèse sur des rotations parentes, etc. Sert à vérifier si le
  // collider physique (wireframe vert dans Flipper.ts, calculé à la main)
  // colle bien au vrai mesh, sans dépendre de mes calculs pour le tracé
  // lui-même. Couleur cyan pour le distinguer du vert du collider physique.
  private readonly liveMeshBoundsHelper: BoxHelper | null;

  constructor(flipper: Flipper, blenderMesh: Object3D, scene?: Scene) {
    this.flipper = flipper;
    this.blenderMesh = blenderMesh;
    this.initialMeshRotationY = blenderMesh.rotation.y;
    // Angle de repos du flipper physique, capturé à la construction.
    this.baseFlipperAngle = flipper.mesh.rotation.y;

    // [DEBUG] cf. plus bas — log unique au démarrage pour valider le point 1
    // de la demande de diagnostic : colliders Rapier et mesh Blender doivent
    // être au même endroit.
    blenderMesh.updateWorldMatrix(true, false);
    this.initialBlenderWorldPos = blenderMesh.getWorldPosition(new Vector3());
    const physPos = flipper.rigidBody.translation();
    console.log(
      `📍 [INIT] Flipper "${flipper.side}" — physique=(${physPos.x.toFixed(3)}, ${physPos.y.toFixed(3)}, ${physPos.z.toFixed(3)}) | Blender monde=(${this.initialBlenderWorldPos.x.toFixed(3)}, ${this.initialBlenderWorldPos.y.toFixed(3)}, ${this.initialBlenderWorldPos.z.toFixed(3)}) | écart=(${(physPos.x - this.initialBlenderWorldPos.x).toFixed(3)}, ${(physPos.y - this.initialBlenderWorldPos.y).toFixed(3)}, ${(physPos.z - this.initialBlenderWorldPos.z).toFixed(3)})`,
    );

    if (scene) {
      this.liveMeshBoundsHelper = new BoxHelper(blenderMesh, 0x00ffff);
      scene.add(this.liveMeshBoundsHelper);
    } else {
      this.liveMeshBoundsHelper = null;
    }
  }

  update(): void {
    // Le flipper physique a déjà avancé sa rotation cette frame ; on applique
    // son écart au repos sur le mesh Blender (axe Y = swing dans le plan).
    const delta = this.flipper.mesh.rotation.y - this.baseFlipperAngle;
    this.blenderMesh.rotation.y = this.initialMeshRotationY + delta;

    // [DEBUG] Recalcule le wireframe cyan sur la position/rotation RÉELLE et
    // ACTUELLE du mesh Blender (peu importe ce qu'on a calculé ailleurs).
    this.liveMeshBoundsHelper?.update();

    // [DEBUG] log throttlé (~1x/sec) demandé pour le diagnostic : position
    // physique (pivot du rigidBody, fixe) vs position monde courante du mesh
    // Blender (qui ne devrait QUE tourner autour du même pivot, donc rester
    // proche de initialBlenderWorldPos) — à retirer une fois confirmé/corrigé.
    this.frameCount++;
    if (this.frameCount % 60 === 0) {
      const physPos = this.flipper.rigidBody.translation();
      const blenderWorldPos = this.blenderMesh.getWorldPosition(new Vector3());
      console.log(
        `📍 Flipper "${this.flipper.side}" — physique=(${physPos.x.toFixed(3)}, ${physPos.y.toFixed(3)}, ${physPos.z.toFixed(3)}) | Blender monde=(${blenderWorldPos.x.toFixed(3)}, ${blenderWorldPos.y.toFixed(3)}, ${blenderWorldPos.z.toFixed(3)}) | angle=${this.flipper.mesh.rotation.y.toFixed(3)}`,
      );
    }
  }
}
