import * as THREE from "three";

import type {
  RealSceneGeometry,
  RealSceneLandCoverType,
  RealSceneLocalPoint,
  RealSceneVegetationGeometry,
  RealSceneVegetationType,
} from "../types/realSceneGeometry";

interface AddRealSceneGeometryOptions {
  scene: THREE.Scene;
  geometry: RealSceneGeometry;
  heightAt?: (x: number, z: number) => number;
  showPavements: boolean;
  showLaneMarkings: boolean;
  wet: boolean;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function worldPoint(
  point: RealSceneLocalPoint,
  geometry: RealSceneGeometry,
  heightAt: (x: number, z: number) => number,
  yOffset: number,
): THREE.Vector3 {
  const x = point.xMetres - geometry.sceneWidthMetres / 2;
  const z = geometry.sceneHeightMetres / 2 - point.yMetres;
  return new THREE.Vector3(x, heightAt(x, z) + yOffset, z);
}

function createRibbonGeometry(
  sourcePoints: THREE.Vector3[],
  widthMetres: number,
  closed: boolean,
): THREE.BufferGeometry | null {
  if (sourcePoints.length < 2) return null;
  const source =
    closed && sourcePoints[0].distanceTo(sourcePoints[sourcePoints.length - 1]) < 0.05
      ? sourcePoints.slice(0, -1)
      : sourcePoints;
  if (source.length < 2) return null;

  const curve = new THREE.CatmullRomCurve3(source, closed, "centripetal", 0.5);
  const estimatedLength = curve.getLength();
  const samples = clamp(Math.ceil(estimatedLength * 1.6), 20, 800);
  const halfWidth = Math.max(0.05, widthMetres / 2);
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let index = 0; index <= samples; index += 1) {
    const progress = index / samples;
    const point = curve.getPointAt(progress);
    const tangent = curve.getTangentAt(progress).normalize();
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    const left = point.clone().addScaledVector(side, halfWidth);
    const right = point.clone().addScaledVector(side, -halfWidth);
    positions.push(left.x, left.y, left.z, right.x, right.y, right.z);
    uvs.push(0, progress * Math.max(1, estimatedLength / 4));
    uvs.push(1, progress * Math.max(1, estimatedLength / 4));

    if (index < samples) {
      const base = index * 2;
      indices.push(base, base + 2, base + 1, base + 2, base + 3, base + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function addRibbon(
  group: THREE.Group,
  points: THREE.Vector3[],
  widthMetres: number,
  closed: boolean,
  material: THREE.Material,
  renderOrder: number,
): THREE.Mesh | null {
  const geometry = createRibbonGeometry(points, widthMetres, closed);
  if (!geometry) return null;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.renderOrder = renderOrder;
  group.add(mesh);
  return mesh;
}

function averageTerrainHeight(
  points: RealSceneLocalPoint[],
  geometry: RealSceneGeometry,
  heightAt: (x: number, z: number) => number,
): number {
  if (points.length === 0) return 0;
  const total = points.reduce((sum, point) => {
    const x = point.xMetres - geometry.sceneWidthMetres / 2;
    const z = geometry.sceneHeightMetres / 2 - point.yMetres;
    return sum + heightAt(x, z);
  }, 0);
  return total / points.length;
}

function localPolygonShape(
  points: RealSceneLocalPoint[],
  geometry: RealSceneGeometry,
): THREE.Shape | null {
  const source =
    points.length > 1 &&
    Math.hypot(
      points[0].xMetres - points[points.length - 1].xMetres,
      points[0].yMetres - points[points.length - 1].yMetres,
    ) < 0.05
      ? points.slice(0, -1)
      : points;
  if (source.length < 3) return null;

  const shape = new THREE.Shape();
  source.forEach((point, index) => {
    const worldX = point.xMetres - geometry.sceneWidthMetres / 2;
    const worldZ = geometry.sceneHeightMetres / 2 - point.yMetres;
    if (index === 0) shape.moveTo(worldX, -worldZ);
    else shape.lineTo(worldX, -worldZ);
  });
  shape.closePath();
  return shape;
}

function landCoverColour(type: RealSceneLandCoverType): number {
  switch (type) {
    case "Forest":
      return 0x23452f;
    case "Woodland":
      return 0x31553a;
    case "Scrub":
      return 0x526247;
    case "Grass":
      return 0x4d6847;
    case "Meadow":
      return 0x66764e;
    case "Farmland":
      return 0x766b49;
    case "Orchard":
      return 0x405e3f;
    case "Park":
      return 0x45664a;
    case "Garden":
      return 0x587354;
    case "Wetland":
      return 0x405f5c;
    case "Bare Ground":
      return 0x7c6d58;
    case "Water":
      return 0x315f78;
    case "Other":
    default:
      return 0x4d594a;
  }
}

function addLandCoverMeshes(
  group: THREE.Group,
  geometry: RealSceneGeometry,
  heightAt: (x: number, z: number) => number,
): void {
  (geometry.landCover ?? []).forEach((cover) => {
    const shape = localPolygonShape(cover.localPoints, geometry);
    if (!shape) return;
    const meshGeometry = new THREE.ShapeGeometry(shape, 1);
    const material = new THREE.MeshStandardMaterial({
      color: landCoverColour(cover.landCoverType),
      roughness: cover.landCoverType === "Water" ? 0.38 : 1,
      metalness: cover.landCoverType === "Water" ? 0.08 : 0,
      transparent: cover.landCoverType === "Water",
      opacity: cover.landCoverType === "Water" ? 0.88 : 1,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: 2,
    });
    const mesh = new THREE.Mesh(meshGeometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y =
      averageTerrainHeight(cover.localPoints, geometry, heightAt) + 0.018;
    mesh.receiveShadow = true;
    mesh.renderOrder = 0;
    mesh.userData.realSceneFeatureId = cover.id;
    group.add(mesh);
  });
}

function addBuildingMeshes(
  group: THREE.Group,
  geometry: RealSceneGeometry,
  heightAt: (x: number, z: number) => number,
): void {
  const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0x586574,
    roughness: 0.84,
    metalness: 0.02,
  });

  geometry.buildings.forEach((building) => {
    const shape = localPolygonShape(building.localPoints, geometry);
    if (!shape) return;

    const buildingGeometry = new THREE.ExtrudeGeometry(shape, {
      depth: Math.max(2.2, building.heightMetres),
      bevelEnabled: false,
      curveSegments: 1,
    });
    buildingGeometry.computeVertexNormals();
    const mesh = new THREE.Mesh(buildingGeometry, wallMaterial.clone());
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y =
      averageTerrainHeight(building.localPoints, geometry, heightAt) + 0.04;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.realSceneFeatureId = building.id;
    group.add(mesh);
  });
}

function addBarrierMeshes(
  group: THREE.Group,
  geometry: RealSceneGeometry,
  heightAt: (x: number, z: number) => number,
): void {
  const material = new THREE.MeshStandardMaterial({
    color: 0x8c949b,
    roughness: 0.8,
  });

  geometry.barriers.forEach((barrier) => {
    for (let index = 1; index < barrier.localPoints.length; index += 1) {
      const start = worldPoint(
        barrier.localPoints[index - 1],
        geometry,
        heightAt,
        barrier.heightMetres / 2,
      );
      const end = worldPoint(
        barrier.localPoints[index],
        geometry,
        heightAt,
        barrier.heightMetres / 2,
      );
      const midpoint = start.clone().add(end).multiplyScalar(0.5);
      const length = start.distanceTo(end);
      if (length < 0.08) continue;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(length, barrier.heightMetres, 0.16),
        material,
      );
      mesh.position.copy(midpoint);
      mesh.rotation.y = -Math.atan2(end.z - start.z, end.x - start.x);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
  });
}

function plantsOfType(
  vegetation: RealSceneVegetationGeometry[],
  type: RealSceneVegetationType,
): RealSceneVegetationGeometry[] {
  return vegetation.filter((plant) => plant.vegetationType === type);
}

function setInstanceTransform(
  mesh: THREE.InstancedMesh,
  index: number,
  position: THREE.Vector3,
  scale: THREE.Vector3,
  rotationY: number,
): void {
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(0, rotationY, 0),
  );
  matrix.compose(position, quaternion, scale);
  mesh.setMatrixAt(index, matrix);
}

function addVegetationInstances(
  group: THREE.Group,
  geometry: RealSceneGeometry,
  heightAt: (x: number, z: number) => number,
): void {
  const dummyColour = new THREE.Color();

  const addTreeType = (
    type: "Tree" | "Palm",
    trunkMaterial: THREE.MeshStandardMaterial,
    canopyMaterial: THREE.MeshStandardMaterial,
  ) => {
    const plants = plantsOfType(geometry.vegetation ?? [], type);
    if (plants.length === 0) return;

    const trunkGeometry = new THREE.CylinderGeometry(0.12, 0.17, 1, 7);
    const canopyGeometry =
      type === "Palm"
        ? new THREE.ConeGeometry(0.65, 1, 7)
        : new THREE.IcosahedronGeometry(0.72, 1);
    const trunks = new THREE.InstancedMesh(
      trunkGeometry,
      trunkMaterial,
      plants.length,
    );
    const canopies = new THREE.InstancedMesh(
      canopyGeometry,
      canopyMaterial,
      plants.length,
    );
    trunks.castShadow = true;
    trunks.receiveShadow = true;
    canopies.castShadow = true;
    canopies.receiveShadow = true;

    plants.forEach((plant, index) => {
      const base = worldPoint(plant.localPosition, geometry, heightAt, 0);
      const trunkHeight = type === "Palm" ? plant.heightMetres * 0.78 : plant.heightMetres * 0.55;
      const trunkRadius = clamp(plant.heightMetres * 0.035, 0.09, 0.34);
      const canopyWidth = Math.max(0.7, plant.canopyDiameterMetres);
      const canopyHeight = type === "Palm" ? canopyWidth * 0.55 : canopyWidth * 0.82;
      const rotation = ((index * 2.399963) + (plant.osmId ?? index) * 0.013) % (Math.PI * 2);

      setInstanceTransform(
        trunks,
        index,
        base.clone().add(new THREE.Vector3(0, trunkHeight / 2, 0)),
        new THREE.Vector3(trunkRadius / 0.12, trunkHeight, trunkRadius / 0.12),
        rotation,
      );
      setInstanceTransform(
        canopies,
        index,
        base.clone().add(new THREE.Vector3(0, trunkHeight + canopyHeight * 0.42, 0)),
        new THREE.Vector3(canopyWidth / 1.44, canopyHeight, canopyWidth / 1.44),
        rotation,
      );
      dummyColour.setHSL(
        type === "Palm" ? 0.29 : 0.32,
        0.38,
        0.29 + (index % 5) * 0.018,
      );
      canopies.setColorAt(index, dummyColour);
    });

    trunks.instanceMatrix.needsUpdate = true;
    canopies.instanceMatrix.needsUpdate = true;
    if (canopies.instanceColor) canopies.instanceColor.needsUpdate = true;
    group.add(trunks, canopies);
  };

  addTreeType(
    "Tree",
    new THREE.MeshStandardMaterial({ color: 0x5a402d, roughness: 1 }),
    new THREE.MeshStandardMaterial({ color: 0x2f613a, roughness: 0.96 }),
  );
  addTreeType(
    "Palm",
    new THREE.MeshStandardMaterial({ color: 0x74543a, roughness: 0.96 }),
    new THREE.MeshStandardMaterial({ color: 0x3f7544, roughness: 0.94 }),
  );

  const shrubs = plantsOfType(geometry.vegetation ?? [], "Shrub");
  if (shrubs.length > 0) {
    const shrubGeometry = new THREE.IcosahedronGeometry(0.6, 1);
    const shrubMaterial = new THREE.MeshStandardMaterial({
      color: 0x4f7048,
      roughness: 1,
    });
    const shrubMesh = new THREE.InstancedMesh(
      shrubGeometry,
      shrubMaterial,
      shrubs.length,
    );
    shrubMesh.castShadow = true;
    shrubMesh.receiveShadow = true;
    shrubs.forEach((plant, index) => {
      const base = worldPoint(plant.localPosition, geometry, heightAt, 0);
      const width = Math.max(0.6, plant.canopyDiameterMetres);
      setInstanceTransform(
        shrubMesh,
        index,
        base.clone().add(new THREE.Vector3(0, plant.heightMetres * 0.45, 0)),
        new THREE.Vector3(width, Math.max(0.5, plant.heightMetres), width),
        (index * 1.618) % (Math.PI * 2),
      );
    });
    shrubMesh.instanceMatrix.needsUpdate = true;
    group.add(shrubMesh);
  }
}

function addSelectedAreaBoundary(
  group: THREE.Group,
  geometry: RealSceneGeometry,
  heightAt: (x: number, z: number) => number,
): void {
  const halfWidth = geometry.sceneWidthMetres / 2;
  const halfHeight = geometry.sceneHeightMetres / 2;
  const corners = [
    new THREE.Vector3(-halfWidth, 0, -halfHeight),
    new THREE.Vector3(halfWidth, 0, -halfHeight),
    new THREE.Vector3(halfWidth, 0, halfHeight),
    new THREE.Vector3(-halfWidth, 0, halfHeight),
    new THREE.Vector3(-halfWidth, 0, -halfHeight),
  ].map((point) => {
    point.y = heightAt(point.x, point.z) + 0.16;
    return point;
  });
  const material = new THREE.LineBasicMaterial({
    color: 0x4d97ff,
    transparent: true,
    opacity: 0.58,
  });
  const boundary = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(corners),
    material,
  );
  boundary.renderOrder = 20;
  group.add(boundary);
}

export function addRealSceneGeometryToThreeScene({
  scene,
  geometry,
  heightAt = () => 0,
  showPavements,
  showLaneMarkings,
  wet,
}: AddRealSceneGeometryOptions): THREE.Group {
  const group = new THREE.Group();
  group.name = "RoadSafe exact selected-area geometry";

  const roadMaterial = new THREE.MeshPhysicalMaterial({
    color: wet ? 0x46545e : 0x34393f,
    roughness: wet ? 0.38 : 0.88,
    metalness: wet ? 0.12 : 0,
    clearcoat: wet ? 0.3 : 0,
    clearcoatRoughness: 0.28,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const pavementMaterial = new THREE.MeshStandardMaterial({
    color: 0x7d8286,
    roughness: 0.94,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  const pathMaterial = new THREE.MeshStandardMaterial({
    color: 0xb3a27f,
    roughness: 0.96,
    side: THREE.DoubleSide,
  });
  const centreMaterial = new THREE.MeshStandardMaterial({
    color: 0xd4ad45,
    roughness: 0.72,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -3,
  });

  addLandCoverMeshes(group, geometry, heightAt);
  addVegetationInstances(group, geometry, heightAt);

  geometry.roads.forEach((road) => {
    const points = road.localPoints.map((point) =>
      worldPoint(point, geometry, heightAt, 0.085),
    );
    if (showPavements) {
      addRibbon(
        group,
        points.map((point) => point.clone().setY(point.y - 0.025)),
        road.widthMetres + 2.6,
        road.isRoundabout,
        pavementMaterial,
        1,
      );
    }
    addRibbon(
      group,
      points,
      road.widthMetres,
      road.isRoundabout,
      roadMaterial,
      2,
    );
    if (showLaneMarkings && road.laneCount > 1) {
      addRibbon(
        group,
        points.map((point) => point.clone().setY(point.y + 0.018)),
        0.11,
        road.isRoundabout,
        centreMaterial,
        3,
      );
    }
  });

  geometry.paths.forEach((path) => {
    addRibbon(
      group,
      path.localPoints.map((point) =>
        worldPoint(point, geometry, heightAt, 0.095),
      ),
      path.widthMetres,
      false,
      pathMaterial,
      2,
    );
  });

  addBuildingMeshes(group, geometry, heightAt);
  addBarrierMeshes(group, geometry, heightAt);
  addSelectedAreaBoundary(group, geometry, heightAt);

  scene.add(group);
  return group;
}
