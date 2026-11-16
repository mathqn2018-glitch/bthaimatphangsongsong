import * as THREE from 'three';

export type VertexRole = 'apex' | 'base' | 'midpoint' | 'auxiliary';
export type EdgeGroup = 'base' | 'lateral' | 'section' | 'auxiliary';
export type FaceKind = 'solid_face' | 'auxiliary_plane';
export type FaceGroup = 'base' | 'lateral' | 'section' | 'auxiliary';

export interface RawVertex {
  id: string;
  label?: string;
  position?: [number, number, number];
  role?: VertexRole;
  ofEdge?: [string, string];
  derivedParallelogram?: [string, string, string];
}

export interface RawEdge {
  id?: string;
  from: string;
  to: string;
  group?: EdgeGroup;
}

export interface RawFace {
  id?: string;
  vertices: string[];
  kind?: FaceKind;
  group?: FaceGroup;
  label?: string;
}

export interface RawGeometryJSON {
  format?: string;
  version?: string;
  id?: string;
  title?: string;
  description?: string;
  coordinateSystem?: 'Y_UP_RIGHT_HANDED' | 'Z_UP_RIGHT_HANDED';
  vertices: RawVertex[];
  edges: RawEdge[];
  faces: RawFace[];
  camera?: {
    position?: [number, number, number];
    target?: [number, number, number];
  };
}

export interface ParsedVertex {
  id: string;
  label: string;
  position: THREE.Vector3;
  role: VertexRole;
  ofEdge?: [string, string];
}

export interface ParsedEdge {
  id: string;
  from: string;
  to: string;
  start: THREE.Vector3;
  end: THREE.Vector3;
  group: EdgeGroup;
}

export interface ParsedFace {
  id: string;
  vertexIds: string[];
  points: THREE.Vector3[];
  kind: FaceKind;
  group: FaceGroup;
  label: string;
}

export interface ParsedGeometry {
  id: string;
  title: string;
  description: string;
  vertices: ParsedVertex[];
  vertexMap: Map<string, ParsedVertex>;
  edges: ParsedEdge[];
  faces: ParsedFace[];
  solidFaces: ParsedFace[];
  auxiliaryFaces: ParsedFace[];
  extendedMNPQuad: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3];
  basePlaneLabelAnchor: THREE.Vector3;
  mnpPlaneLabelAnchor: THREE.Vector3;
  center: THREE.Vector3;
  boundingRadius: number;
  defaultCameraPosition: THREE.Vector3;
  defaultCameraTarget: THREE.Vector3;
}

export interface ParallelogramCheckResult {
  coordsA: [number, number, number];
  coordsB: [number, number, number];
  coordsC: [number, number, number];
  coordsD: [number, number, number];
  vecAB: [number, number, number];
  vecDC: [number, number, number];
  vecAD: [number, number, number];
  vecBC: [number, number, number];
  lengthAB: number;
  lengthCD: number;
  lengthAD: number;
  lengthBC: number;
  baseArea: number;
  isParallelABtoCD: boolean;
  isParallelADtoBC: boolean;
  isEqualLengthABtoCD: boolean;
  isEqualLengthADtoBC: boolean;
  isVectorABEqualsDC: boolean;
  isVectorADEqualsBC: boolean;
  isBaseCoplanar: boolean;
  isBaseNonDegenerate: boolean;
  areBaseTrianglesConsistent: boolean;
  areBaseEdgesOrderedCorrectly: boolean;
  isValid: boolean;
  failures: string[];
}

export interface MathVerificationReport {
  isParallelABtoCD: boolean;
  isParallelADtoBC: boolean;
  isEqualLengthABtoCD: boolean;
  isEqualLengthADtoBC: boolean;
  isBaseCoplanar: boolean;
  isBaseNonDegenerate: boolean;
  areBaseTrianglesConsistent: boolean;
  isParallelogramValid: boolean;
  isMidpointM: boolean;
  isMidpointN: boolean;
  isMidpointP: boolean;
  areMidpointsExact: boolean;
  isParallelMNtoAB: boolean;
  isParallelNPtoBC: boolean;
  isParallelMPtoAC: boolean;
  isMNPNonDegenerate: boolean;
  arePlanesParallel: boolean;
  areColoredPlanesCoplanar: boolean;
  coordinatesImmutableOnOrbit: boolean;
  allPassed: boolean;
  failures: string[];
  parallelogramResidual: number;
  midpointMaxError: number;
  planeParallelCrossNorm: number;
  coloredPlaneCoplanarityError: number;
}

export const MATH_TOLERANCE = 1e-8;

function isFiniteTriple(value: unknown): value is [number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    typeof value[0] === 'number' &&
    Number.isFinite(value[0]) &&
    typeof value[1] === 'number' &&
    Number.isFinite(value[1]) &&
    typeof value[2] === 'number' &&
    Number.isFinite(value[2])
  );
}

function toThreeVector(
  pos: [number, number, number],
  coordSystem: 'Y_UP_RIGHT_HANDED' | 'Z_UP_RIGHT_HANDED',
): THREE.Vector3 {
  if (coordSystem === 'Z_UP_RIGHT_HANDED') {
    return new THREE.Vector3(pos[0], pos[2], -pos[1]);
  }
  return new THREE.Vector3(pos[0], pos[1], pos[2]);
}

function computeExtendedMNPQuad(
  M: THREE.Vector3,
  N: THREE.Vector3,
  P: THREE.Vector3,
): [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3] {
  const Q = new THREE.Vector3().addVectors(M, P).sub(N);
  const centroid = new THREE.Vector3().add(M).add(N).add(P).add(Q).multiplyScalar(0.25);
  const expand = 1.38;
  const expandCorner = (pt: THREE.Vector3) =>
    new THREE.Vector3().subVectors(pt, centroid).multiplyScalar(expand).add(centroid);

  return [expandCorner(M), expandCorner(N), expandCorner(P), expandCorner(Q)];
}

/**
 * Computes C = B + D - A strictly using THREE.Vector3 from anchor vertices A, B, D,
 * and derives M = (S+A)/2, N = (S+B)/2, P = (S+C)/2.
 * Throws immediately if base ABCD does not satisfy strict parallelogram invariants.
 */
export function parseGeometryJSON(raw: unknown): ParsedGeometry {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Dữ liệu hình học không hợp lệ (không phải đối tượng JSON).');
  }

  const data = raw as Partial<RawGeometryJSON>;

  if (data.format && data.format !== 'HH-3D-JSON') {
    throw new Error(`Định dạng tệp không được hỗ trợ: ${String(data.format)}.`);
  }

  if (!Array.isArray(data.vertices) || data.vertices.length < 4) {
    throw new Error('Tệp JSON thiếu danh sách đỉnh hợp lệ (cần tối thiểu 4 đỉnh).');
  }

  if (!Array.isArray(data.edges) || data.edges.length === 0) {
    throw new Error('Tệp JSON thiếu danh sách cạnh hợp lệ.');
  }

  if (!Array.isArray(data.faces) || data.faces.length === 0) {
    throw new Error('Tệp JSON thiếu danh sách mặt hợp lệ.');
  }

  const coordSystem =
    data.coordinateSystem === 'Z_UP_RIGHT_HANDED'
      ? 'Z_UP_RIGHT_HANDED'
      : 'Y_UP_RIGHT_HANDED';

  const rawById = new Map<string, RawVertex>();
  for (const item of data.vertices) {
    if (!item || typeof item.id !== 'string' || !item.id.trim()) {
      throw new Error('Phát hiện đỉnh không có mã định danh hợp lệ.');
    }
    if (rawById.has(item.id)) {
      throw new Error(`Trùng mã đỉnh "${item.id}" trong tệp dữ liệu.`);
    }
    rawById.set(item.id, item);
  }

  // 1. Parse primary anchor points (S, A, B, D and any explicit non-derived vertices)
  const vertexMap = new Map<string, ParsedVertex>();
  const vertices: ParsedVertex[] = [];

  for (const item of data.vertices) {
    const isDerivedC =
      item.id === 'C' ||
      (Array.isArray(item.derivedParallelogram) && item.derivedParallelogram.length === 3);
    const isDerivedMidpoint =
      item.role === 'midpoint' && Array.isArray(item.ofEdge) && item.ofEdge.length === 2;

    if (!isDerivedC && !isDerivedMidpoint) {
      if (!isFiniteTriple(item.position)) {
        throw new Error(`Tọa độ đỉnh "${item.id}" không hợp lệ.`);
      }
      const parsed: ParsedVertex = {
        id: item.id,
        label: typeof item.label === 'string' && item.label.trim() ? item.label.trim() : item.id,
        position: toThreeVector(item.position, coordSystem),
        role: item.role ?? 'auxiliary',
        ofEdge: item.ofEdge,
      };
      vertexMap.set(parsed.id, parsed);
    }
  }

  // 2. Strictly compute C = B + D - A (never read C independently!)
  const rawC = rawById.get('C');
  const ptA = vertexMap.get('A')?.position;
  const ptB = vertexMap.get('B')?.position;
  const ptD = vertexMap.get('D')?.position;

  if (!rawC || !ptA || !ptB || !ptD) {
    throw new Error('Thiếu các đỉnh gốc A, B, D để tính đỉnh C = B + D - A.');
  }

  const computedC = ptB.clone().add(ptD).sub(ptA);
  if (rawC.position && isFiniteTriple(rawC.position)) {
    const suppliedC = toThreeVector(rawC.position, coordSystem);
    if (suppliedC.distanceTo(computedC) >= MATH_TOLERANCE) {
      throw new Error('Tọa độ đỉnh C trong dữ liệu không khớp công thức C = B + D - A.');
    }
  }

  vertexMap.set('C', {
    id: 'C',
    label: typeof rawC.label === 'string' && rawC.label.trim() ? rawC.label.trim() : 'C',
    position: computedC,
    role: rawC.role ?? 'base',
  });

  // Strict mathematical validation on base parallelogram ABCD
  const AB = ptB.clone().sub(ptA);
  const DC = computedC.clone().sub(ptD);
  const AD = ptD.clone().sub(ptA);
  const BC = computedC.clone().sub(ptB);

  const parallelogramValid =
    AB.distanceTo(DC) < MATH_TOLERANCE &&
    AD.distanceTo(BC) < MATH_TOLERANCE &&
    AB.clone().cross(AD).length() > MATH_TOLERANCE;

  if (!parallelogramValid) {
    throw new Error('Đáy ABCD không phải hình bình hành hợp lệ.');
  }

  // 3. Strictly derive midpoints M = (S+A)/2, N = (S+B)/2, P = (S+C)/2
  for (const item of data.vertices) {
    if (item.role === 'midpoint' && Array.isArray(item.ofEdge) && item.ofEdge.length === 2) {
      const p1 = vertexMap.get(item.ofEdge[0]);
      const p2 = vertexMap.get(item.ofEdge[1]);
      if (!p1 || !p2) {
        throw new Error(`Trung điểm "${item.id}" tham chiếu cạnh không tồn tại.`);
      }
      const exactMid = p1.position.clone().add(p2.position).multiplyScalar(0.5);
      if (item.position && isFiniteTriple(item.position)) {
        const supplied = toThreeVector(item.position, coordSystem);
        if (supplied.distanceTo(exactMid) >= MATH_TOLERANCE) {
          throw new Error(
            `Tọa độ trung điểm "${item.id}" không khớp công thức (${item.ofEdge[0]} + ${item.ofEdge[1]})/2.`,
          );
        }
      }
      vertexMap.set(item.id, {
        id: item.id,
        label: typeof item.label === 'string' && item.label.trim() ? item.label.trim() : item.id,
        position: exactMid,
        role: 'midpoint',
        ofEdge: item.ofEdge,
      });
    }
  }

  // Preserve declaration order from data.vertices in vertices array
  for (const item of data.vertices) {
    const v = vertexMap.get(item.id);
    if (!v) {
      throw new Error(`Không thể khởi tạo đỉnh "${item.id}".`);
    }
    vertices.push(v);
  }

  // 4. Build edges directly from single-source-of-truth vertexMap positions
  const edges: ParsedEdge[] = [];
  for (let i = 0; i < data.edges.length; i++) {
    const item = data.edges[i];
    if (!item || typeof item.from !== 'string' || typeof item.to !== 'string') {
      throw new Error(`Cạnh thứ ${i + 1} thiếu đỉnh đầu hoặc đỉnh cuối.`);
    }
    const vFrom = vertexMap.get(item.from);
    const vTo = vertexMap.get(item.to);
    if (!vFrom || !vTo) {
      throw new Error(`Cạnh (${item.from}, ${item.to}) tham chiếu đỉnh không tồn tại.`);
    }
    if (item.from === item.to) {
      throw new Error(`Cạnh (${item.from}, ${item.to}) có hai đầu trùng nhau.`);
    }

    edges.push({
      id: item.id && item.id.trim() ? item.id : `${item.from}${item.to}`,
      from: item.from,
      to: item.to,
      start: vFrom.position.clone(),
      end: vTo.position.clone(),
      group: item.group ?? 'lateral',
    });
  }

  // 5. Build faces directly from single-source-of-truth vertexMap positions
  const faces: ParsedFace[] = [];
  for (let i = 0; i < data.faces.length; i++) {
    const item = data.faces[i];
    if (!item || !Array.isArray(item.vertices) || item.vertices.length < 3) {
      throw new Error(`Mặt thứ ${i + 1} cần ít nhất 3 đỉnh.`);
    }

    const points: THREE.Vector3[] = [];
    for (const vid of item.vertices) {
      const v = vertexMap.get(vid);
      if (!v) {
        throw new Error(`Mặt "${item.id ?? i + 1}" tham chiếu đỉnh "${vid}" không tồn tại.`);
      }
      points.push(v.position.clone());
    }

    faces.push({
      id: item.id && item.id.trim() ? item.id : `face_${i + 1}`,
      vertexIds: [...item.vertices],
      points,
      kind: item.kind ?? 'solid_face',
      group: item.group ?? 'lateral',
      label: item.label && item.label.trim() ? item.label : `Mặt ${i + 1}`,
    });
  }

  const solidFaces = faces.filter((f) => f.kind === 'solid_face');
  const auxiliaryFaces = faces.filter((f) => f.kind === 'auxiliary_plane');

  if (solidFaces.length === 0) {
    throw new Error('Mô hình cần ít nhất một mặt thực (solid_face) để xác định che khuất.');
  }

  const box = new THREE.Box3();
  for (const v of vertices) {
    box.expandByPoint(v.position);
  }
  const center = new THREE.Vector3();
  box.getCenter(center);

  const sphere = new THREE.Sphere();
  box.getBoundingSphere(sphere);

  const vM = vertexMap.get('M')?.position;
  const vN = vertexMap.get('N')?.position;
  const vP = vertexMap.get('P')?.position;

  if (!vM || !vN || !vP) {
    throw new Error('Thiếu các trung điểm M, N, P.');
  }

  const extendedMNPQuad = computeExtendedMNPQuad(vM, vN, vP);

  const basePlaneLabelAnchor = computedC
    .clone()
    .add(ptD)
    .multiplyScalar(0.5)
    .add(new THREE.Vector3(0, 0, 0.42));

  const mnpPlaneLabelAnchor = new THREE.Vector3()
    .addVectors(extendedMNPQuad[2], extendedMNPQuad[3])
    .multiplyScalar(0.5);

  const defaultCameraTarget =
    data.camera?.target && isFiniteTriple(data.camera.target)
      ? toThreeVector(data.camera.target, coordSystem)
      : center.clone();

  const defaultCameraPosition =
    data.camera?.position && isFiniteTriple(data.camera.position)
      ? toThreeVector(data.camera.position, coordSystem)
      : center.clone().add(new THREE.Vector3(sphere.radius * 1.1, sphere.radius * 1.1, sphere.radius * 2.1));

  return {
    id: data.id ?? 'pyramid_model',
    title: data.title ?? 'Hình chóp 3D',
    description: data.description ?? '',
    vertices,
    vertexMap,
    edges,
    faces,
    solidFaces,
    auxiliaryFaces,
    extendedMNPQuad,
    basePlaneLabelAnchor,
    mnpPlaneLabelAnchor,
    center,
    boundingRadius: Math.max(sphere.radius, 1),
    defaultCameraPosition,
    defaultCameraTarget,
  };
}

function areVectorsParallel(u: THREE.Vector3, v: THREE.Vector3, eps = MATH_TOLERANCE): boolean {
  const lenU = u.length();
  const lenV = v.length();
  if (lenU <= eps || lenV <= eps) return false;
  const cross = new THREE.Vector3().crossVectors(u, v);
  return cross.length() / (lenU * lenV) < eps;
}

function pointToPlaneDistance(
  pt: THREE.Vector3,
  origin: THREE.Vector3,
  unitNormal: THREE.Vector3,
): number {
  return Math.abs(new THREE.Vector3().subVectors(pt, origin).dot(unitNormal));
}

export function computeParallelogramCheck(geometry: ParsedGeometry): ParallelogramCheckResult {
  const A = geometry.vertexMap.get('A')?.position;
  const B = geometry.vertexMap.get('B')?.position;
  const C = geometry.vertexMap.get('C')?.position;
  const D = geometry.vertexMap.get('D')?.position;

  if (!A || !B || !C || !D) {
    return {
      coordsA: [0, 0, 0],
      coordsB: [0, 0, 0],
      coordsC: [0, 0, 0],
      coordsD: [0, 0, 0],
      vecAB: [0, 0, 0],
      vecDC: [0, 0, 0],
      vecAD: [0, 0, 0],
      vecBC: [0, 0, 0],
      lengthAB: 0,
      lengthCD: 0,
      lengthAD: 0,
      lengthBC: 0,
      baseArea: 0,
      isParallelABtoCD: false,
      isParallelADtoBC: false,
      isEqualLengthABtoCD: false,
      isEqualLengthADtoBC: false,
      isVectorABEqualsDC: false,
      isVectorADEqualsBC: false,
      isBaseCoplanar: false,
      isBaseNonDegenerate: false,
      areBaseTrianglesConsistent: false,
      areBaseEdgesOrderedCorrectly: false,
      isValid: false,
      failures: ['Thiếu một hoặc nhiều đỉnh A, B, C, D trong mô hình.'],
    };
  }

  const failures: string[] = [];

  const AB = B.clone().sub(A);
  const DC = C.clone().sub(D);
  const CD = D.clone().sub(C);
  const AD = D.clone().sub(A);
  const BC = C.clone().sub(B);
  const AC = C.clone().sub(A);

  const lengthAB = AB.length();
  const lengthCD = CD.length();
  const lengthAD = AD.length();
  const lengthBC = BC.length();

  const isParallelABtoCD = areVectorsParallel(AB, CD, MATH_TOLERANCE);
  const isParallelADtoBC = areVectorsParallel(AD, BC, MATH_TOLERANCE);
  const isEqualLengthABtoCD = Math.abs(lengthAB - lengthCD) < MATH_TOLERANCE;
  const isEqualLengthADtoBC = Math.abs(lengthAD - lengthBC) < MATH_TOLERANCE;
  const isVectorABEqualsDC = AB.distanceTo(DC) < MATH_TOLERANCE;
  const isVectorADEqualsBC = AD.distanceTo(BC) < MATH_TOLERANCE;

  const normalABC = AB.clone().cross(AC);
  const normalACD = AC.clone().cross(AD);
  const normalBase = AB.clone().cross(AD);
  const baseArea = normalBase.length();

  const coplanarVolume = Math.abs(AC.dot(normalBase));
  const isBaseCoplanar = coplanarVolume < MATH_TOLERANCE;
  const isBaseNonDegenerate = baseArea > MATH_TOLERANCE && lengthAB > MATH_TOLERANCE && lengthAD > MATH_TOLERANCE;

  const areBaseTrianglesConsistent =
    normalABC.length() > MATH_TOLERANCE &&
    normalACD.length() > MATH_TOLERANCE &&
    normalABC.clone().normalize().dot(normalACD.clone().normalize()) > 1 - MATH_TOLERANCE;

  const baseEdges = geometry.edges.filter((e) => e.group === 'base');
  const edgePairs = new Set(baseEdges.map((e) => `${e.from}-${e.to}`));
  const areBaseEdgesOrderedCorrectly =
    baseEdges.length === 4 &&
    (edgePairs.has('A-B') || edgePairs.has('B-A')) &&
    (edgePairs.has('B-C') || edgePairs.has('C-B')) &&
    (edgePairs.has('C-D') || edgePairs.has('D-C')) &&
    (edgePairs.has('D-A') || edgePairs.has('A-D'));

  if (!isParallelABtoCD) failures.push('AB không song song với CD.');
  if (!isParallelADtoBC) failures.push('AD không song song với BC.');
  if (!isEqualLengthABtoCD || !isVectorABEqualsDC) failures.push('AB không bằng DC.');
  if (!isEqualLengthADtoBC || !isVectorADEqualsBC) failures.push('AD không bằng BC.');
  if (!isBaseCoplanar) failures.push('Bốn đỉnh A, B, C, D không đồng phẳng.');
  if (!isBaseNonDegenerate) failures.push('Đáy ABCD bị suy biến (diện tích bằng 0).');
  if (!areBaseTrianglesConsistent) failures.push('Pháp tuyến hai tam giác đáy ABC và ACD không nhất quán.');
  if (!areBaseEdgesOrderedCorrectly) failures.push('Thứ tự các cạnh đáy không đúng AB, BC, CD, DA.');

  return {
    coordsA: [A.x, A.y, A.z],
    coordsB: [B.x, B.y, B.z],
    coordsC: [C.x, C.y, C.z],
    coordsD: [D.x, D.y, D.z],
    vecAB: [AB.x, AB.y, AB.z],
    vecDC: [DC.x, DC.y, DC.z],
    vecAD: [AD.x, AD.y, AD.z],
    vecBC: [BC.x, BC.y, BC.z],
    lengthAB,
    lengthCD,
    lengthAD,
    lengthBC,
    baseArea,
    isParallelABtoCD,
    isParallelADtoBC,
    isEqualLengthABtoCD,
    isEqualLengthADtoBC,
    isVectorABEqualsDC,
    isVectorADEqualsBC,
    isBaseCoplanar,
    isBaseNonDegenerate,
    areBaseTrianglesConsistent,
    areBaseEdgesOrderedCorrectly,
    isValid: failures.length === 0,
    failures,
  };
}

export function verifyPyramidMath(geometry: ParsedGeometry): MathVerificationReport {
  const S = geometry.vertexMap.get('S')?.position;
  const A = geometry.vertexMap.get('A')?.position;
  const B = geometry.vertexMap.get('B')?.position;
  const C = geometry.vertexMap.get('C')?.position;
  const D = geometry.vertexMap.get('D')?.position;
  const M = geometry.vertexMap.get('M')?.position;
  const N = geometry.vertexMap.get('N')?.position;
  const P = geometry.vertexMap.get('P')?.position;

  if (!S || !A || !B || !C || !D || !M || !N || !P) {
    return {
      isParallelABtoCD: false,
      isParallelADtoBC: false,
      isEqualLengthABtoCD: false,
      isEqualLengthADtoBC: false,
      isBaseCoplanar: false,
      isBaseNonDegenerate: false,
      areBaseTrianglesConsistent: false,
      isParallelogramValid: false,
      isMidpointM: false,
      isMidpointN: false,
      isMidpointP: false,
      areMidpointsExact: false,
      isParallelMNtoAB: false,
      isParallelNPtoBC: false,
      isParallelMPtoAC: false,
      isMNPNonDegenerate: false,
      arePlanesParallel: false,
      areColoredPlanesCoplanar: false,
      coordinatesImmutableOnOrbit: false,
      allPassed: false,
      failures: ['Thiếu đỉnh bắt buộc trong bộ S, A, B, C, D, M, N, P.'],
      parallelogramResidual: Infinity,
      midpointMaxError: Infinity,
      planeParallelCrossNorm: Infinity,
      coloredPlaneCoplanarityError: Infinity,
    };
  }

  const baseCheck = computeParallelogramCheck(geometry);
  const failures = [...baseCheck.failures];

  const vecAB = B.clone().sub(A);
  const vecAD = D.clone().sub(A);
  const vecBC = C.clone().sub(B);
  const vecAC = C.clone().sub(A);

  const normalABCD = vecAB.clone().cross(vecAD);
  const baseArea = normalABCD.length();
  const vecAS = S.clone().sub(A);
  const pyramidHeight = baseArea > 1e-6 ? Math.abs(vecAS.dot(normalABCD)) / baseArea : 0;
  const isBaseNonDegenerate = baseCheck.isBaseNonDegenerate && pyramidHeight > 1e-6;
  if (pyramidHeight <= 1e-6) {
    failures.push('Đỉnh S nằm đồng phẳng với đáy ABCD (hình chóp suy biến).');
  }

  const acSum = A.clone().add(C);
  const bdSum = B.clone().add(D);
  const parallelogramResidual = acSum.distanceTo(bdSum);

  const isParallelogramValid = baseCheck.isValid && isBaseNonDegenerate && parallelogramResidual < MATH_TOLERANCE;
  if (!isParallelogramValid && baseCheck.isValid) {
    failures.push('Đáy ABCD không thỏa mãn hình bình hành A + C = B + D.');
  }

  const expectedM = S.clone().add(A).multiplyScalar(0.5);
  const expectedN = S.clone().add(B).multiplyScalar(0.5);
  const expectedP = S.clone().add(C).multiplyScalar(0.5);

  const errM = M.distanceTo(expectedM);
  const errN = N.distanceTo(expectedN);
  const errP = P.distanceTo(expectedP);
  const midpointMaxError = Math.max(errM, errN, errP);

  const isMidpointM = errM < MATH_TOLERANCE;
  const isMidpointN = errN < MATH_TOLERANCE;
  const isMidpointP = errP < MATH_TOLERANCE;
  if (!isMidpointM) failures.push('Điểm M không phải trung điểm của SA.');
  if (!isMidpointN) failures.push('Điểm N không phải trung điểm của SB.');
  if (!isMidpointP) failures.push('Điểm P không phải trung điểm của SC.');
  const areMidpointsExact = isMidpointM && isMidpointN && isMidpointP;

  const vecMN = N.clone().sub(M);
  const vecNP = P.clone().sub(N);
  const vecMP = P.clone().sub(M);

  const isParallelMNtoAB = areVectorsParallel(vecMN, vecAB, MATH_TOLERANCE);
  const isParallelNPtoBC = areVectorsParallel(vecNP, vecBC, MATH_TOLERANCE);
  const isParallelMPtoAC = areVectorsParallel(vecMP, vecAC, MATH_TOLERANCE);
  if (!isParallelMNtoAB) failures.push('MN không song song với AB.');
  if (!isParallelNPtoBC) failures.push('NP không song song với BC.');
  if (!isParallelMPtoAC) failures.push('MP không song song với AC.');

  const normalMNP = vecMN.clone().cross(vecNP);
  const isMNPNonDegenerate = normalMNP.length() > 1e-6;
  if (!isMNPNonDegenerate) failures.push('M, N, P thẳng hàng, không xác định được mặt phẳng (MNP).');

  const unitNormalABCD =
    normalABCD.length() > 1e-8 ? normalABCD.clone().normalize() : new THREE.Vector3(0, 1, 0);
  const unitNormalMNP =
    normalMNP.length() > 1e-8 ? normalMNP.clone().normalize() : new THREE.Vector3(0, 1, 0);

  const planeParallelCrossNorm =
    normalMNP.length() > 1e-8 && normalABCD.length() > 1e-8
      ? new THREE.Vector3().crossVectors(unitNormalMNP, unitNormalABCD).length()
      : Infinity;
  const arePlanesParallel = planeParallelCrossNorm < MATH_TOLERANCE;
  if (!arePlanesParallel) failures.push('Mặt phẳng (MNP) không song song với mặt phẳng (ABCD).');

  const baseFace = geometry.faces.find((f) => f.group === 'base');
  const baseOrderOk =
    Boolean(baseFace) &&
    baseFace!.vertexIds.length === 4 &&
    baseFace!.vertexIds[0] === 'A' &&
    baseFace!.vertexIds[1] === 'B' &&
    baseFace!.vertexIds[2] === 'C' &&
    baseFace!.vertexIds[3] === 'D';
  if (!baseOrderOk) {
    failures.push('Thứ tự đỉnh mặt đáy trong mô hình không đúng chu trình A → B → C → D.');
  }

  let coloredPlaneCoplanarityError = 0;
  for (const pt of [A, B, C, D]) {
    coloredPlaneCoplanarityError = Math.max(
      coloredPlaneCoplanarityError,
      pointToPlaneDistance(pt, A, unitNormalABCD),
    );
  }
  for (const pt of [M, N, P, ...geometry.extendedMNPQuad]) {
    coloredPlaneCoplanarityError = Math.max(
      coloredPlaneCoplanarityError,
      pointToPlaneDistance(pt, M, unitNormalMNP),
    );
  }
  const areColoredPlanesCoplanar =
    baseOrderOk && coloredPlaneCoplanarityError < MATH_TOLERANCE;
  if (!areColoredPlanesCoplanar) {
    failures.push('Miền tô màu (ABCD) hoặc (MNP) bị lệch khỏi mặt phẳng toán học.');
  }

  const coordinatesImmutableOnOrbit = geometry.vertices.every(
    (v) =>
      Number.isFinite(v.position.x) &&
      Number.isFinite(v.position.y) &&
      Number.isFinite(v.position.z),
  );

  return {
    isParallelABtoCD: baseCheck.isParallelABtoCD,
    isParallelADtoBC: baseCheck.isParallelADtoBC,
    isEqualLengthABtoCD: baseCheck.isEqualLengthABtoCD,
    isEqualLengthADtoBC: baseCheck.isEqualLengthADtoBC,
    isBaseCoplanar: baseCheck.isBaseCoplanar,
    isBaseNonDegenerate,
    areBaseTrianglesConsistent: baseCheck.areBaseTrianglesConsistent,
    isParallelogramValid,
    isMidpointM,
    isMidpointN,
    isMidpointP,
    areMidpointsExact,
    isParallelMNtoAB,
    isParallelNPtoBC,
    isParallelMPtoAC,
    isMNPNonDegenerate,
    arePlanesParallel,
    areColoredPlanesCoplanar,
    coordinatesImmutableOnOrbit,
    allPassed: failures.length === 0,
    failures,
    parallelogramResidual,
    midpointMaxError,
    planeParallelCrossNorm,
    coloredPlaneCoplanarityError,
  };
}
