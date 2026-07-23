import * as THREE from "three";

import type {
  RealSceneGeometry,
  RealSceneLocalPoint,
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

  const curve = new THREE.CatmullRomCurve3(
    source,
    closed,
    "centripetal",
    0.5,
  );
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
    const points =
      building.localPoints.length > 1 &&
      Math.hypot(
        building.localPoints[0].xMetres -
          building.localPoints[building.localPoints.length - 1].xMetres,
        building.localPoints[0].yMetres -
          building.localPoints[building.localPoints.length - 1].yMetres,
      ) < 0.05
        ? building.localPoints.slice(0, -1)
        : building.localPoints;
    if (points.length < 3) return;

    const shape = new THREE.Shape();
    points.forEach((point, index) => {
      const worldX = point.xMetres - geometry.sceneWidthMetres / 2;
      const worldZ = geometry.sceneHeightMetres / 2 - point.yMetres;
      if (index === 0) shape.moveTo(worldX, -worldZ);
      else shape.lineTo(worldX, -worldZ);
    });
    shape.closePath();

    const buildingGeometry = new THREE.ExtrudeGeometry(shape, {
      depth: Math.max(2.2, building.heightMetres),
      bevelEnabled: false,
      curveSegments: 1,
    });
    buildingGeometry.computeVertexNormals();
    const mesh = new THREE.Mesh(buildingGeometry, wallMaterial.clone());
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = averageTerrainHeight(points, geometry, heightAt) + 0.04;
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

export function addRealSceneGeometryToThreeScene({
  scene,
  geometry,
  heightAt = () => 0,
  showPavements,
  showLaneMarkings,
  wet,
}: AddRealSceneGeometryOptions): THREE.Group {
  const group = new THREE.Group();
  group.name = "RoadSafe real selected-area geometry";

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

  scene.add(group);
  return group;
}
