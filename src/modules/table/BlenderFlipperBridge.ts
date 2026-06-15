import type { Object3D } from "three";
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

  constructor(flipper: Flipper, blenderMesh: Object3D) {
    this.flipper = flipper;
    this.blenderMesh = blenderMesh;
    this.initialMeshRotationY = blenderMesh.rotation.y;
    // Angle de repos du flipper physique, capturé à la construction.
    this.baseFlipperAngle = flipper.mesh.rotation.y;
  }

  update(): void {
    // Le flipper physique a déjà avancé sa rotation cette frame ; on applique
    // son écart au repos sur le mesh Blender (axe Y = swing dans le plan).
    const delta = this.flipper.mesh.rotation.y - this.baseFlipperAngle;
    this.blenderMesh.rotation.y = this.initialMeshRotationY + delta;
  }
}
