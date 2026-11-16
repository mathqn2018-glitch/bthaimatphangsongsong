import * as THREE from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import type { ParsedGeometry } from './parseGeometry';
import {
  createVisibilitySolver,
  type EdgeOcclusionDetail,
  type EdgeVisibilityClassification,
  type VisibilityOptions,
  type VisibilitySolver,
} from './visibility';

export type SectionDisplayMode = 'triangle' | 'plane';
export type HighlightPairMode = 'none' | 'MN_AB' | 'NP_BC' | 'BOTH';

export interface HighlightOverlayState {
  selectedMidpoint: 'M' | 'N' | 'P' | null;
  highlightPair: HighlightPairMode;
  comparisonMode: boolean;
  /** 0..1 progressive line growth for MN & NP during WOW animation */
  mnNpDrawProgress?: number;
  /** Which segment pair is active during WOW animation */
  wowActivePair?: 'none' | 'mn_np' | 'all';
}

export interface DesignerRenderState {
  mode: 'off' | 'predict' | 'checked';
  predictions: Record<string, EdgeVisibilityClassification>;
  occlusionResults: Record<string, EdgeOcclusionDetail> | null;
}

export interface PyramidSceneRig {
  root: THREE.Group;
  baseGroup: THREE.Group;
  sectionGroup: THREE.Group;
  lateralFacesGroup: THREE.Group;
  gridHelper: THREE.GridHelper;
  vertexHitMeshes: THREE.Mesh[];
  edgeHitMeshes: THREE.Mesh[];
  setHiddenLinesVisible: (visible: boolean) => void;
  setBaseOpacity: (opacity: number) => void;
  setSectionOpacity: (opacity: number) => void;
  setSectionDisplayMode: (mode: SectionDisplayMode) => void;
  setHighlightState: (state: HighlightOverlayState) => void;
  setDesignerState: (state: DesignerRenderState) => void;
  setResolution: (width: number, height: number) => void;
  updateVisibility: (cameraPosition: THREE.Vector3, options: VisibilityOptions) => void;
  analyzeAllEdges: (
    cameraPosition: THREE.Vector3,
    options?: { isOrthographic?: boolean; viewForward?: THREE.Vector3 },
  ) => Record<string, EdgeOcclusionDetail>;
  dispose: () => void;
}

const _segStart = new THREE.Vector3();
const _segEnd = new THREE.Vector3();
const _lerpPt = new THREE.Vector3();

interface DynamicFatLineBundle {
  mesh: LineSegments2;
  material: LineMaterial;
  posBuffer: Float32Array;
  posInterleaved: THREE.InstancedInterleavedBuffer;
  distBuffer: Float32Array;
  distInterleaved: THREE.InstancedInterleavedBuffer;
  maxSegments: number;
  updateFromVertexCount: (vertexCount: number) => void;
}

function createPolygonGeometry(points: THREE.Vector3[]): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const positions: number[] = [];

  // Fan triangulation from vertex 0: for A, B, C, D this yields triangles ABC and ACD
  // strictly preserving the cyclic perimeter A -> B -> C -> D -> A without twisting.
  for (let i = 1; i < points.length - 1; i++) {
    positions.push(
      points[0].x,
      points[0].y,
      points[0].z,
      points[i].x,
      points[i].y,
      points[i].z,
      points[i + 1].x,
      points[i + 1].y,
      points[i + 1].z,
    );
  }

  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}

function createStaticLoopLines(
  loopPoints: THREE.Vector3[],
  material: LineMaterial,
  renderOrder: number,
  dashed: boolean,
): { mesh: LineSegments2; geometry: LineSegmentsGeometry } {
  const positions: number[] = [];
  for (let i = 0; i < loopPoints.length; i++) {
    const a = loopPoints[i];
    const b = loopPoints[(i + 1) % loopPoints.length];
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
  }
  const geo = new LineSegmentsGeometry();
  geo.setPositions(positions);
  const mesh = new LineSegments2(geo, material);
  if (dashed) {
    mesh.computeLineDistances();
  }
  mesh.renderOrder = renderOrder;
  return { mesh, geometry: geo };
}

function createDynamicFatLines(
  maxVertices: number,
  material: LineMaterial,
  renderOrder: number,
  isDashed: boolean,
): DynamicFatLineBundle {
  const maxSegments = Math.max(1, Math.floor(maxVertices / 2));
  const posBuffer = new Float32Array(maxSegments * 6);
  const distBuffer = new Float32Array(maxSegments * 2);

  const geo = new LineSegmentsGeometry();
  const posInterleaved = new THREE.InstancedInterleavedBuffer(posBuffer, 6, 1);
  posInterleaved.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('instanceStart', new THREE.InterleavedBufferAttribute(posInterleaved, 3, 0));
  geo.setAttribute('instanceEnd', new THREE.InterleavedBufferAttribute(posInterleaved, 3, 3));

  const distInterleaved = new THREE.InstancedInterleavedBuffer(distBuffer, 2, 1);
  distInterleaved.setUsage(THREE.DynamicDrawUsage);
  if (isDashed) {
    geo.setAttribute('instanceDistanceStart', new THREE.InterleavedBufferAttribute(distInterleaved, 1, 0));
    geo.setAttribute('instanceDistanceEnd', new THREE.InterleavedBufferAttribute(distInterleaved, 1, 1));
  }

  geo.instanceCount = 0;

  const mesh = new LineSegments2(geo, material);
  mesh.frustumCulled = false;
  mesh.visible = false;
  mesh.renderOrder = renderOrder;

  function updateFromVertexCount(vertexCount: number) {
    const segmentCount = Math.min(Math.floor(vertexCount / 2), maxSegments);
    geo.instanceCount = segmentCount;
    mesh.visible = segmentCount > 0;
    if (segmentCount === 0) return;

    posInterleaved.needsUpdate = true;

    if (isDashed) {
      for (let i = 0; i < segmentCount; i++) {
        const pOff = i * 6;
        _segStart.set(posBuffer[pOff], posBuffer[pOff + 1], posBuffer[pOff + 2]);
        _segEnd.set(posBuffer[pOff + 3], posBuffer[pOff + 4], posBuffer[pOff + 5]);
        distBuffer[i * 2] = 0;
        distBuffer[i * 2 + 1] = _segStart.distanceTo(_segEnd);
      }
      distInterleaved.needsUpdate = true;
    }
  }

  return {
    mesh,
    material,
    posBuffer,
    posInterleaved,
    distBuffer,
    distInterleaved,
    maxSegments,
    updateFromVertexCount,
  };
}

function writeSeg(buffer: Float32Array, idx: number, a: THREE.Vector3, b: THREE.Vector3): number {
  const off = idx * 3;
  buffer[off] = a.x;
  buffer[off + 1] = a.y;
  buffer[off + 2] = a.z;
  buffer[off + 3] = b.x;
  buffer[off + 4] = b.y;
  buffer[off + 5] = b.z;
  return idx + 2;
}

export function buildPyramidScene(geometry: ParsedGeometry): PyramidSceneRig {
  const root = new THREE.Group();
  root.name = geometry.id;

  const baseGroup = new THREE.Group();
  const sectionGroup = new THREE.Group();
  const lateralFacesGroup = new THREE.Group();
  const verticesGroup = new THREE.Group();
  const highlightGroup = new THREE.Group();
  const designerGroup = new THREE.Group();
  const hitTargetsGroup = new THREE.Group();

  const disposables: Array<{ dispose: () => void }> = [];
  const allLineMaterials: LineMaterial[] = [];

  // 1. Subtle coordinate grid beneath base ABCD
  const gridHelper = new THREE.GridHelper(10, 20, 0x99e2db, 0xd8f1ef);
  gridHelper.position.set(geometry.center.x, -0.015, geometry.center.z);
  const gridMats = Array.isArray(gridHelper.material)
    ? gridHelper.material
    : [gridHelper.material];
  gridMats.forEach((mat) => {
    mat.transparent = true;
    mat.opacity = 0.62;
    mat.depthWrite = false;
    disposables.push(mat);
  });
  disposables.push(gridHelper.geometry);
  root.add(gridHelper);

  // 2. Plane materials per V5 spec:
  //    - Base (ABCD): #00CFC8, deep blue border (#2563EB)
  //    - Plane (MNP): #FFB347, deep orange border (#EA580C / #C2410C)
  //    - Lateral faces: subtle translucent glass tint
  const lateralMaterial = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.08,
    roughness: 0.4,
    metalness: 0.05,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  disposables.push(lateralMaterial);

  const baseMaterial = new THREE.MeshStandardMaterial({
    color: 0x00cfc8,
    transparent: true,
    opacity: 0.26,
    roughness: 0.42,
    metalness: 0.04,
    side: THREE.DoubleSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  disposables.push(baseMaterial);

  const sectionTriangleMaterial = new THREE.MeshStandardMaterial({
    color: 0xffb347,
    transparent: true,
    opacity: 0.34,
    roughness: 0.35,
    metalness: 0.06,
    side: THREE.DoubleSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  disposables.push(sectionTriangleMaterial);

  const sectionPlaneMaterial = new THREE.MeshStandardMaterial({
    color: 0xffb347,
    transparent: true,
    opacity: 0.28,
    roughness: 0.38,
    metalness: 0.04,
    side: THREE.DoubleSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  disposables.push(sectionPlaneMaterial);

  let sectionTriangleMesh: THREE.Mesh | null = null;

  for (const face of geometry.faces) {
    const faceGeo = createPolygonGeometry(face.points);
    disposables.push(faceGeo);

    if (face.kind === 'auxiliary_plane' || face.group === 'section') {
      const mesh = new THREE.Mesh(faceGeo, sectionTriangleMaterial);
      mesh.name = face.id;
      mesh.renderOrder = 2;
      sectionTriangleMesh = mesh;
      sectionGroup.add(mesh);
    } else if (face.group === 'base') {
      const mesh = new THREE.Mesh(faceGeo, baseMaterial);
      mesh.name = face.id;
      mesh.renderOrder = 1;
      baseGroup.add(mesh);
    } else {
      const mesh = new THREE.Mesh(faceGeo, lateralMaterial);
      mesh.name = face.id;
      mesh.renderOrder = 1;
      lateralFacesGroup.add(mesh);
    }
  }

  // Note: Base edges (AB, BC, CD, DA) and section edges (MN, NP, PM) are drawn exclusively
  // by the dynamic visibility solver so solid/dashed occlusion never gets overwritten.

  // Extended representative parallelogram for Plane (MNP)
  const extQuadGeo = createPolygonGeometry(geometry.extendedMNPQuad);
  disposables.push(extQuadGeo);
  const sectionPlaneMesh = new THREE.Mesh(extQuadGeo, sectionPlaneMaterial);
  sectionPlaneMesh.name = 'plane_MNP_extended';
  sectionPlaneMesh.renderOrder = 2;
  sectionPlaneMesh.visible = false;
  sectionGroup.add(sectionPlaneMesh);

  const extPlaneBorderMat = new LineMaterial({
    color: 0xc2410c,
    linewidth: 2.8,
    dashed: true,
    dashSize: 0.18,
    gapSize: 0.1,
    dashScale: 1,
    depthTest: false,
    transparent: true,
    opacity: 0.92,
  });
  allLineMaterials.push(extPlaneBorderMat);
  disposables.push(extPlaneBorderMat);
  const extBorder = createStaticLoopLines(geometry.extendedMNPQuad, extPlaneBorderMat, 4, true);
  extBorder.mesh.visible = false;
  disposables.push(extBorder.geometry);
  sectionGroup.add(extBorder.mesh);

  root.add(lateralFacesGroup);
  root.add(baseGroup);
  root.add(sectionGroup);

  // 3. Vertex markers & invisible raycast hit meshes
  const apexSphereGeo = new THREE.SphereGeometry(0.095, 22, 22);
  const baseSphereGeo = new THREE.SphereGeometry(0.075, 18, 18);
  const midpointSphereGeo = new THREE.SphereGeometry(0.084, 18, 18);
  const hitSphereGeo = new THREE.SphereGeometry(0.24, 12, 12);

  const apexVertexMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: 0xca8a04,
    emissiveIntensity: 0.24,
    roughness: 0.25,
    metalness: 0.45,
  });
  const baseVertexMat = new THREE.MeshStandardMaterial({
    color: 0x2563eb,
    roughness: 0.32,
    metalness: 0.2,
  });
  const midpointVertexMat = new THREE.MeshStandardMaterial({
    color: 0xea580c,
    emissive: 0xc2410c,
    emissiveIntensity: 0.18,
    roughness: 0.28,
    metalness: 0.25,
  });
  const selectedMidpointMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: 0xea580c,
    emissiveIntensity: 0.55,
    roughness: 0.2,
    metalness: 0.3,
  });
  const invisibleHitMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });

  disposables.push(
    apexSphereGeo,
    baseSphereGeo,
    midpointSphereGeo,
    hitSphereGeo,
    apexVertexMat,
    baseVertexMat,
    midpointVertexMat,
    selectedMidpointMat,
    invisibleHitMat,
  );

  const vertexMeshesById = new Map<string, THREE.Mesh>();
  const vertexHitMeshes: THREE.Mesh[] = [];

  for (const vertex of geometry.vertices) {
    let geo = baseSphereGeo;
    let mat = baseVertexMat;
    if (vertex.role === 'apex') {
      geo = apexSphereGeo;
      mat = apexVertexMat;
    } else if (vertex.role === 'midpoint') {
      geo = midpointSphereGeo;
      mat = midpointVertexMat;
    }

    const marker = new THREE.Mesh(geo, mat);
    marker.position.copy(vertex.position);
    marker.name = `vertex_${vertex.id}`;
    marker.renderOrder = 7;
    verticesGroup.add(marker);
    vertexMeshesById.set(vertex.id, marker);

    const hitSphere = new THREE.Mesh(hitSphereGeo, invisibleHitMat);
    hitSphere.position.copy(vertex.position);
    hitSphere.userData = { vertexId: vertex.id };
    hitTargetsGroup.add(hitSphere);
    vertexHitMeshes.push(hitSphere);
  }
  root.add(verticesGroup);

  // Edge hit cylinders for clicking/tapping edges in Designer Challenge
  const edgeHitGeo = new THREE.CylinderGeometry(0.12, 0.12, 1, 8);
  disposables.push(edgeHitGeo);
  const edgeHitMeshes: THREE.Mesh[] = [];
  const upVec = new THREE.Vector3(0, 1, 0);
  const edgeDir = new THREE.Vector3();
  const edgeMid = new THREE.Vector3();
  const edgeQuat = new THREE.Quaternion();

  for (const edge of geometry.edges) {
    edgeDir.subVectors(edge.end, edge.start);
    const len = edgeDir.length();
    if (len < 1e-6) continue;
    edgeMid.addVectors(edge.start, edge.end).multiplyScalar(0.5);
    edgeQuat.setFromUnitVectors(upVec, edgeDir.clone().normalize());

    const hitCyl = new THREE.Mesh(edgeHitGeo, invisibleHitMat);
    hitCyl.position.copy(edgeMid);
    hitCyl.quaternion.copy(edgeQuat);
    hitCyl.scale.set(1, len, 1);
    hitCyl.userData = { edgeId: edge.id };
    hitTargetsGroup.add(hitCyl);
    edgeHitMeshes.push(hitCyl);
  }
  root.add(hitTargetsGroup);

  // 4. Primary edge LineSegments2 driven by geometric visibility solver
  const solver: VisibilitySolver = createVisibilitySolver(geometry);

  const pyramidVisibleMat = new LineMaterial({
    color: 0x1d4ed8,
    linewidth: 3.6,
    dashed: false,
    depthTest: false,
    transparent: true,
    opacity: 0.98,
  });
  const pyramidHiddenMat = new LineMaterial({
    color: 0x60a5fa,
    linewidth: 2.5,
    dashed: true,
    dashSize: 0.16,
    gapSize: 0.12,
    dashScale: 1,
    depthTest: false,
    transparent: true,
    opacity: 0.9,
  });
  const sectionVisibleMat = new LineMaterial({
    color: 0xea580c,
    linewidth: 3.8,
    dashed: false,
    depthTest: false,
    transparent: true,
    opacity: 1,
  });
  const sectionHiddenMat = new LineMaterial({
    color: 0xfb923c,
    linewidth: 2.6,
    dashed: true,
    dashSize: 0.16,
    gapSize: 0.12,
    dashScale: 1,
    depthTest: false,
    transparent: true,
    opacity: 0.88,
  });

  allLineMaterials.push(
    pyramidVisibleMat,
    pyramidHiddenMat,
    sectionVisibleMat,
    sectionHiddenMat,
  );
  disposables.push(
    pyramidVisibleMat,
    pyramidHiddenMat,
    sectionVisibleMat,
    sectionHiddenMat,
  );

  const pyramidVisibleSegs = createDynamicFatLines(
    solver.maxVerticesPerBuffer,
    pyramidVisibleMat,
    5,
    false,
  );
  const pyramidHiddenSegs = createDynamicFatLines(
    solver.maxVerticesPerBuffer,
    pyramidHiddenMat,
    3,
    true,
  );
  const sectionVisibleSegs = createDynamicFatLines(
    solver.maxVerticesPerBuffer,
    sectionVisibleMat,
    5,
    false,
  );
  const sectionHiddenSegs = createDynamicFatLines(
    solver.maxVerticesPerBuffer,
    sectionHiddenMat,
    4,
    true,
  );

  disposables.push(
    pyramidVisibleSegs.mesh.geometry,
    pyramidHiddenSegs.mesh.geometry,
    sectionVisibleSegs.mesh.geometry,
    sectionHiddenSegs.mesh.geometry,
  );

  root.add(pyramidHiddenSegs.mesh);
  root.add(sectionHiddenSegs.mesh);
  root.add(pyramidVisibleSegs.mesh);
  root.add(sectionVisibleSegs.mesh);

  // 5. Highlight Overlay Bundles (Step 2 parent edge, Step 3/Comparison/WOW parallel pairs)
  const hlBlueMat = new LineMaterial({
    color: 0x0284c7,
    linewidth: 6.2,
    dashed: false,
    depthTest: false,
    transparent: true,
    opacity: 0.98,
  });
  const hlEmeraldMat = new LineMaterial({
    color: 0x059669,
    linewidth: 6.2,
    dashed: false,
    depthTest: false,
    transparent: true,
    opacity: 0.98,
  });
  const hlAmberMat = new LineMaterial({
    color: 0xd97706,
    linewidth: 6.0,
    dashed: false,
    depthTest: false,
    transparent: true,
    opacity: 0.98,
  });
  allLineMaterials.push(hlBlueMat, hlEmeraldMat, hlAmberMat);
  disposables.push(hlBlueMat, hlEmeraldMat, hlAmberMat);

  const hlBlueSegs = createDynamicFatLines(12, hlBlueMat, 8, false);
  const hlEmeraldSegs = createDynamicFatLines(12, hlEmeraldMat, 8, false);
  const hlAmberSegs = createDynamicFatLines(12, hlAmberMat, 8, false);
  disposables.push(
    hlBlueSegs.mesh.geometry,
    hlEmeraldSegs.mesh.geometry,
    hlAmberSegs.mesh.geometry,
  );
  highlightGroup.add(hlBlueSegs.mesh);
  highlightGroup.add(hlEmeraldSegs.mesh);
  highlightGroup.add(hlAmberSegs.mesh);
  root.add(highlightGroup);

  // 6. Designer Challenge Overlays (Neutral prediction lines + Checked Correct/Wrong overlays)
  const desNeutralSolidMat = new LineMaterial({
    color: 0x475569,
    linewidth: 3.6,
    dashed: false,
    depthTest: false,
    transparent: true,
    opacity: 0.94,
  });
  const desNeutralDashedMat = new LineMaterial({
    color: 0x64748b,
    linewidth: 2.8,
    dashed: true,
    dashSize: 0.16,
    gapSize: 0.1,
    dashScale: 1,
    depthTest: false,
    transparent: true,
    opacity: 0.85,
  });
  const desCorrectSolidMat = new LineMaterial({
    color: 0x10b981,
    linewidth: 4.5,
    dashed: false,
    depthTest: false,
    transparent: true,
    opacity: 0.98,
  });
  const desCorrectDashedMat = new LineMaterial({
    color: 0x10b981,
    linewidth: 3.2,
    dashed: true,
    dashSize: 0.16,
    gapSize: 0.1,
    dashScale: 1,
    depthTest: false,
    transparent: true,
    opacity: 0.92,
  });
  const desWrongSolidMat = new LineMaterial({
    color: 0xef4444,
    linewidth: 4.8,
    dashed: false,
    depthTest: false,
    transparent: true,
    opacity: 0.98,
  });
  const desWrongDashedMat = new LineMaterial({
    color: 0xef4444,
    linewidth: 3.4,
    dashed: true,
    dashSize: 0.16,
    gapSize: 0.1,
    dashScale: 1,
    depthTest: false,
    transparent: true,
    opacity: 0.95,
  });

  allLineMaterials.push(
    desNeutralSolidMat,
    desNeutralDashedMat,
    desCorrectSolidMat,
    desCorrectDashedMat,
    desWrongSolidMat,
    desWrongDashedMat,
  );
  disposables.push(
    desNeutralSolidMat,
    desNeutralDashedMat,
    desCorrectSolidMat,
    desCorrectDashedMat,
    desWrongSolidMat,
    desWrongDashedMat,
  );

  const desNeutralSolid = createDynamicFatLines(48, desNeutralSolidMat, 6, false);
  const desNeutralDashed = createDynamicFatLines(48, desNeutralDashedMat, 6, true);
  const desCorrectSolid = createDynamicFatLines(solver.maxVerticesPerBuffer, desCorrectSolidMat, 7, false);
  const desCorrectDashed = createDynamicFatLines(solver.maxVerticesPerBuffer, desCorrectDashedMat, 7, true);
  const desWrongSolid = createDynamicFatLines(solver.maxVerticesPerBuffer, desWrongSolidMat, 7, false);
  const desWrongDashed = createDynamicFatLines(solver.maxVerticesPerBuffer, desWrongDashedMat, 7, true);

  disposables.push(
    desNeutralSolid.mesh.geometry,
    desNeutralDashed.mesh.geometry,
    desCorrectSolid.mesh.geometry,
    desCorrectDashed.mesh.geometry,
    desWrongSolid.mesh.geometry,
    desWrongDashed.mesh.geometry,
  );

  designerGroup.add(desNeutralSolid.mesh);
  designerGroup.add(desNeutralDashed.mesh);
  designerGroup.add(desCorrectSolid.mesh);
  designerGroup.add(desCorrectDashed.mesh);
  designerGroup.add(desWrongSolid.mesh);
  designerGroup.add(desWrongDashed.mesh);
  designerGroup.visible = false;
  root.add(designerGroup);

  const buffers = {
    pyramidVisible: pyramidVisibleSegs.posBuffer,
    pyramidHidden: pyramidHiddenSegs.posBuffer,
    sectionVisible: sectionVisibleSegs.posBuffer,
    sectionHidden: sectionHiddenSegs.posBuffer,
  };

  let showHiddenFlag = true;
  let lastHasPyramidHidden = false;
  let lastHasSectionHidden = false;
  let designerMode: 'off' | 'predict' | 'checked' = 'off';

  const vMap = geometry.vertexMap;
  const ptS = vMap.get('S')?.position;
  const ptA = vMap.get('A')?.position;
  const ptB = vMap.get('B')?.position;
  const ptC = vMap.get('C')?.position;
  const ptM = vMap.get('M')?.position;
  const ptN = vMap.get('N')?.position;
  const ptP = vMap.get('P')?.position;

  function setResolution(width: number, height: number) {
    for (const mat of allLineMaterials) {
      mat.resolution.set(width, height);
    }
  }

  function setHiddenLinesVisible(visible: boolean) {
    showHiddenFlag = visible;
    const normalActive = designerMode === 'off';
    pyramidHiddenSegs.mesh.visible = normalActive && visible && lastHasPyramidHidden;
    sectionHiddenSegs.mesh.visible = normalActive && visible && lastHasSectionHidden;
  }

  function setBaseOpacity(opacity: number) {
    baseMaterial.opacity = THREE.MathUtils.clamp(opacity, 0, 0.95);
  }

  function setSectionOpacity(opacity: number) {
    const clamped = THREE.MathUtils.clamp(opacity, 0, 0.95);
    sectionTriangleMaterial.opacity = clamped;
    sectionPlaneMaterial.opacity = Math.max(0.08, clamped * 0.85);
  }

  function setSectionDisplayMode(mode: SectionDisplayMode) {
    const showExt = mode === 'plane';
    if (sectionTriangleMesh) {
      sectionTriangleMesh.visible = !showExt;
    }
    sectionPlaneMesh.visible = showExt;
    extBorder.mesh.visible = showExt;
  }

  function setHighlightState(state: HighlightOverlayState) {
    // 1. Midpoint selection marker scaling & glow
    for (const id of ['M', 'N', 'P'] as const) {
      const mesh = vertexMeshesById.get(id);
      if (!mesh) continue;
      if (state.selectedMidpoint === id) {
        mesh.material = selectedMidpointMat;
        mesh.scale.setScalar(1.45);
      } else {
        mesh.material = midpointVertexMat;
        mesh.scale.setScalar(1);
      }
    }

    let blueCount = 0;
    let emeraldCount = 0;
    let amberCount = 0;

    if (state.selectedMidpoint && ptS) {
      const targetPt =
        state.selectedMidpoint === 'M'
          ? ptA
          : state.selectedMidpoint === 'N'
            ? ptB
            : ptC;
      if (targetPt) {
        amberCount = writeSeg(hlAmberSegs.posBuffer, amberCount, ptS, targetPt);
      }
    }

    const drawProgress = THREE.MathUtils.clamp(state.mnNpDrawProgress ?? 1, 0, 1);

    if (state.wowActivePair === 'mn_np' && ptM && ptN && ptP) {
      if (drawProgress > 0.01) {
        _lerpPt.lerpVectors(ptM, ptN, drawProgress);
        blueCount = writeSeg(hlBlueSegs.posBuffer, blueCount, ptM, _lerpPt);
        _lerpPt.lerpVectors(ptN, ptP, drawProgress);
        emeraldCount = writeSeg(hlEmeraldSegs.posBuffer, emeraldCount, ptN, _lerpPt);
      }
    } else if (
      (state.highlightPair === 'MN_AB' || state.highlightPair === 'BOTH' || state.comparisonMode || state.wowActivePair === 'all') &&
      ptM &&
      ptN &&
      ptA &&
      ptB
    ) {
      blueCount = writeSeg(hlBlueSegs.posBuffer, blueCount, ptM, ptN);
      blueCount = writeSeg(hlBlueSegs.posBuffer, blueCount, ptA, ptB);
    }

    if (
      state.wowActivePair !== 'mn_np' &&
      (state.highlightPair === 'NP_BC' || state.highlightPair === 'BOTH' || state.comparisonMode || state.wowActivePair === 'all') &&
      ptN &&
      ptP &&
      ptB &&
      ptC
    ) {
      emeraldCount = writeSeg(hlEmeraldSegs.posBuffer, emeraldCount, ptN, ptP);
      emeraldCount = writeSeg(hlEmeraldSegs.posBuffer, emeraldCount, ptB, ptC);
    }

    hlBlueSegs.updateFromVertexCount(blueCount);
    hlEmeraldSegs.updateFromVertexCount(emeraldCount);
    hlAmberSegs.updateFromVertexCount(amberCount);
  }

  function setDesignerState(state: DesignerRenderState) {
    designerMode = state.mode;
    const isDesigner = state.mode !== 'off';

    designerGroup.visible = isDesigner;
    pyramidVisibleSegs.mesh.visible = !isDesigner;
    sectionVisibleSegs.mesh.visible = !isDesigner;
    pyramidHiddenSegs.mesh.visible = !isDesigner && showHiddenFlag && lastHasPyramidHidden;
    sectionHiddenSegs.mesh.visible = !isDesigner && showHiddenFlag && lastHasSectionHidden;

    if (!isDesigner) return;

    if (state.mode === 'predict') {
      desCorrectSolid.updateFromVertexCount(0);
      desCorrectDashed.updateFromVertexCount(0);
      desWrongSolid.updateFromVertexCount(0);
      desWrongDashed.updateFromVertexCount(0);

      let nSolid = 0;
      let nDashed = 0;

      for (const edge of geometry.edges) {
        const pred = state.predictions[edge.id] ?? 'visible';
        if (pred === 'visible') {
          nSolid = writeSeg(desNeutralSolid.posBuffer, nSolid, edge.start, edge.end);
        } else if (pred === 'hidden') {
          nDashed = writeSeg(desNeutralDashed.posBuffer, nDashed, edge.start, edge.end);
        } else {
          // Partial prediction visual: first half solid, second half dashed
          _lerpPt.lerpVectors(edge.start, edge.end, 0.5);
          nSolid = writeSeg(desNeutralSolid.posBuffer, nSolid, edge.start, _lerpPt);
          nDashed = writeSeg(desNeutralDashed.posBuffer, nDashed, _lerpPt, edge.end);
        }
      }

      desNeutralSolid.updateFromVertexCount(nSolid);
      desNeutralDashed.updateFromVertexCount(nDashed);
    } else if (state.mode === 'checked' && state.occlusionResults) {
      desNeutralSolid.updateFromVertexCount(0);
      desNeutralDashed.updateFromVertexCount(0);

      let cSolid = 0;
      let cDashed = 0;
      let wSolid = 0;
      let wDashed = 0;

      for (const edge of geometry.edges) {
        const detail = state.occlusionResults[edge.id];
        const pred = state.predictions[edge.id] ?? 'visible';
        if (!detail) continue;

        const isCorrect = pred === detail.classification;

        for (const [sPt, ePt] of detail.visibleSegments) {
          if (isCorrect) {
            cSolid = writeSeg(desCorrectSolid.posBuffer, cSolid, sPt, ePt);
          } else {
            wSolid = writeSeg(desWrongSolid.posBuffer, wSolid, sPt, ePt);
          }
        }
        for (const [sPt, ePt] of detail.hiddenSegments) {
          if (isCorrect) {
            cDashed = writeSeg(desCorrectDashed.posBuffer, cDashed, sPt, ePt);
          } else {
            wDashed = writeSeg(desWrongDashed.posBuffer, wDashed, sPt, ePt);
          }
        }
      }

      desCorrectSolid.updateFromVertexCount(cSolid);
      desCorrectDashed.updateFromVertexCount(cDashed);
      desWrongSolid.updateFromVertexCount(wSolid);
      desWrongDashed.updateFromVertexCount(wDashed);
    }
  }

  function updateVisibility(cameraPosition: THREE.Vector3, options: VisibilityOptions) {
    if (designerMode !== 'off') return;

    const counts = solver.update(cameraPosition, buffers, options);

    pyramidVisibleSegs.updateFromVertexCount(counts.pyramidVisibleCount);
    pyramidHiddenSegs.updateFromVertexCount(counts.pyramidHiddenCount);
    sectionVisibleSegs.updateFromVertexCount(counts.sectionVisibleCount);
    sectionHiddenSegs.updateFromVertexCount(counts.sectionHiddenCount);

    lastHasPyramidHidden = counts.pyramidHiddenCount > 0;
    lastHasSectionHidden = counts.sectionHiddenCount > 0;

    pyramidHiddenSegs.mesh.visible = showHiddenFlag && lastHasPyramidHidden;
    sectionHiddenSegs.mesh.visible = showHiddenFlag && lastHasSectionHidden;
  }

  function analyzeAllEdges(
    cameraPosition: THREE.Vector3,
    options?: { isOrthographic?: boolean; viewForward?: THREE.Vector3 },
  ) {
    return solver.analyzeAllEdges(cameraPosition, options);
  }

  function dispose() {
    for (const item of disposables) {
      item.dispose();
    }
  }

  return {
    root,
    baseGroup,
    sectionGroup,
    lateralFacesGroup,
    gridHelper,
    vertexHitMeshes,
    edgeHitMeshes,
    setHiddenLinesVisible,
    setBaseOpacity,
    setSectionOpacity,
    setSectionDisplayMode,
    setHighlightState,
    setDesignerState,
    setResolution,
    updateVisibility,
    analyzeAllEdges,
    dispose,
  };
}

export function buildExportablePyramidGroup(
  geometry: ParsedGeometry,
  options: { showBase: boolean; showSection: boolean; targetScaleMeters?: number },
): { group: THREE.Group; dispose: () => void } {
  const group = new THREE.Group();
  group.name = 'Hinh_chop_SABCD_MNP';

  const disposables: Array<{ dispose: () => void }> = [];
  const scale = options.targetScaleMeters ?? 0.08;

  const up = new THREE.Vector3(0, 1, 0);
  const dir = new THREE.Vector3();
  const mid = new THREE.Vector3();
  const quat = new THREE.Quaternion();

  const pyramidEdgeMat = new THREE.MeshStandardMaterial({
    color: 0x1d4ed8,
    roughness: 0.35,
    metalness: 0.15,
  });
  const sectionEdgeMat = new THREE.MeshStandardMaterial({
    color: 0xea580c,
    roughness: 0.3,
    metalness: 0.2,
  });
  const apexSphereMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    roughness: 0.25,
    metalness: 0.4,
  });
  const baseFaceMat = new THREE.MeshStandardMaterial({
    color: 0x00cfc8,
    transparent: true,
    opacity: 0.28,
    roughness: 0.45,
    side: THREE.DoubleSide,
  });
  const sectionFaceMat = new THREE.MeshStandardMaterial({
    color: 0xffb347,
    transparent: true,
    opacity: 0.38,
    roughness: 0.35,
    side: THREE.DoubleSide,
  });
  const lateralFaceMat = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.12,
    roughness: 0.4,
    side: THREE.DoubleSide,
  });

  const unitCylGeo = new THREE.CylinderGeometry(0.03, 0.03, 1, 10);
  const apexSphereGeo = new THREE.SphereGeometry(0.088, 16, 16);
  const baseSphereGeo = new THREE.SphereGeometry(0.068, 14, 14);
  const midpointSphereGeo = new THREE.SphereGeometry(0.075, 14, 14);

  disposables.push(
    pyramidEdgeMat,
    sectionEdgeMat,
    apexSphereMat,
    baseFaceMat,
    sectionFaceMat,
    lateralFaceMat,
    unitCylGeo,
    apexSphereGeo,
    baseSphereGeo,
    midpointSphereGeo,
  );

  for (const edge of geometry.edges) {
    dir.subVectors(edge.end, edge.start);
    const len = dir.length();
    if (len < 1e-6) continue;
    mid.addVectors(edge.start, edge.end).multiplyScalar(0.5);
    quat.setFromUnitVectors(up, dir.clone().normalize());

    const cyl = new THREE.Mesh(
      unitCylGeo,
      edge.group === 'section' ? sectionEdgeMat : pyramidEdgeMat,
    );
    cyl.position.copy(mid);
    cyl.quaternion.copy(quat);
    cyl.scale.set(1, len, 1);
    group.add(cyl);
  }

  for (const vertex of geometry.vertices) {
    let geo = baseSphereGeo;
    let mat = pyramidEdgeMat;
    if (vertex.role === 'apex') {
      geo = apexSphereGeo;
      mat = apexSphereMat;
    } else if (vertex.role === 'midpoint') {
      geo = midpointSphereGeo;
      mat = sectionEdgeMat;
    }
    const sphere = new THREE.Mesh(geo, mat);
    sphere.position.copy(vertex.position);
    group.add(sphere);
  }

  for (const face of geometry.faces) {
    if (face.group === 'base' && !options.showBase) continue;
    if ((face.kind === 'auxiliary_plane' || face.group === 'section') && !options.showSection) {
      continue;
    }

    const faceGeo = createPolygonGeometry(face.points);
    disposables.push(faceGeo);

    const mat =
      face.kind === 'auxiliary_plane' || face.group === 'section'
        ? sectionFaceMat
        : face.group === 'base'
          ? baseFaceMat
          : lateralFaceMat;
    group.add(new THREE.Mesh(faceGeo, mat));
  }

  group.position.set(-geometry.center.x * scale, 0, -geometry.center.z * scale);
  group.scale.setScalar(scale);

  return {
    group,
    dispose: () => {
      for (const d of disposables) d.dispose();
    },
  };
}
