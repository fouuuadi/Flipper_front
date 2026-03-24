import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import type { BodyId } from "@physics/PhysicsAdapter";

interface WallElement {
  mesh: THREE.Mesh;
  bodyId: BodyId;
}

export class TableBoundaries {
  private world: RAPIER.World;
  private elements: WallElement[] = [];

  // Dimensions basées sur le playfield
  private readonly tableWidth = 5;
  private readonly tableLength = 10;
  private readonly wallThickness = 0.1;
  private readonly wallHeight = 0.3;

  constructor(world: RAPIER.World) {
    this.world = world;
  }

  // Ici on gère les murs latéraux (gauche/droit)
  private createSidewalls(): void {
    const wallColor = 0x444444;

    // Mur gauche
    this.createStaticWall(
      `wall-left`,
      -(this.tableWidth / 2 + this.wallThickness / 2),
      this.wallHeight / 2,
      0,
      wallColor,
      { x: this.wallThickness, y: this.wallHeight, z: this.tableLength },
    );

    // Mur droit
    this.createStaticWall(
      `wall-right`,
      this.tableWidth / 2 + this.wallThickness / 2,
      this.wallHeight / 2,
      0,
      wallColor,
      { x: this.wallThickness, y: this.wallHeight, z: this.tableLength },
    );
  }

  // Ici on gère le mur du haut (backstop)
  private createBackwall(): void {
    const wallColor = 0x555555;
    this.createStaticWall(
      `wall-back`,
      0,
      this.wallHeight / 2,
      -(this.tableLength / 2 + this.wallThickness / 2),
      wallColor,
      { x: this.tableWidth, y: this.wallHeight, z: this.wallThickness },
    );
  }

  // Ici on gère la zone de drain (pas de mur, c'est une ouverture)
  // Le drain est défini implicitement à l'avant de la table (z > 4.5)
  // Pas de mesh ni de collider ici - c'est juste une zone ouverte

  // Ici on gère les rails de guidage vers les flippers
  private createFlipperGuideRails(): void {
    const railColor = 0x888888;
    const railHeight = 0.15;
    const railThickness = 0.08;

    // Rail gauche (vers flipper gauche)
    this.createStaticWall(`rail-guide-left`, -1.5, railHeight / 2, 1.0, railColor, {
      x: railThickness,
      y: railHeight,
      z: 2.5,
    });

    // Rail droit (vers flipper droit)
    this.createStaticWall(`rail-guide-right`, 1.5, railHeight / 2, 1.0, railColor, {
      x: railThickness,
      y: railHeight,
      z: 2.5,
    });
  }

  // Ici on gère la lane du lanceur (couloir droit, isolé)
  private createLauncherLane(): void {
    const laneColor = 0x336633;
    const laneSeparator = 0.12;

    // Séparateur gauche du lanceur
    this.createStaticWall(
      `launcher-lane-separator-left`,
      2.0,
      this.wallHeight / 2,
      -3.5,
      laneColor,
      { x: laneSeparator, y: this.wallHeight, z: 2.0 },
    );

    // Séparateur droit du lanceur (contre le mur droit)
    // La lane est délimitée par le mur droit existant

    // Fond du lanceur (mur bas du couloir)
    this.createStaticWall(
      `launcher-lane-back`,
      2.3,
      this.wallHeight / 2,
      -(this.tableLength / 2 + this.wallThickness / 2),
      laneColor,
      { x: this.tableWidth / 4, y: this.wallHeight, z: this.wallThickness },
    );
  }

  // Ici on crée un élément mur générique (mesh + collider statique)
  private createStaticWall(
    id: string,
    posX: number,
    posY: number,
    posZ: number,
    color: number,
    dimensions: { x: number; y: number; z: number },
  ): void {
    // Mesh visuel
    const geometry = new THREE.BoxGeometry(dimensions.x * 2, dimensions.y * 2, dimensions.z * 2);
    const material = new THREE.MeshStandardMaterial({ color });
    const mesh = new THREE.Mesh(geometry, material);

    mesh.position.set(posX, posY, posZ);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Collider statique Rapier
    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(posX, posY, posZ);
    const body = this.world.createRigidBody(bodyDesc);

    const colliderDesc = RAPIER.ColliderDesc.cuboid(dimensions.x, dimensions.y, dimensions.z)
      .setFriction(0.7)
      .setRestitution(0.1);

    this.world.createCollider(colliderDesc, body);

    this.elements.push({
      mesh,
      bodyId: id,
    });
  }

  addTo(scene: THREE.Scene): void {
    // Créer tous les éléments
    this.createSidewalls();
    this.createBackwall();
    this.createFlipperGuideRails();
    this.createLauncherLane();

    // Ajouter tous les mesh à la scène
    this.elements.forEach((element) => {
      scene.add(element.mesh);
    });
  }

  removeFrom(scene: THREE.Scene): void {
    this.elements.forEach((element) => {
      scene.remove(element.mesh);
    });
  }

  dispose(): void {
    this.elements.forEach((element) => {
      element.mesh.geometry.dispose();
      (element.mesh.material as THREE.Material).dispose();
    });
    this.elements = [];
  }
}
