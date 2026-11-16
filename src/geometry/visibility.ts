import * as THREE from 'three';
import type { ParsedEdge, ParsedFace, ParsedGeometry } from './parseGeometry';

export interface SolidTriangle {
  a: THREE.Vector3;
  b: THREE.Vector3;
  c: THREE.Vector3;
  normal: THREE.Vector3;
  planeOffset: number;
}

export type EdgeVisibilityClassification = 'visible' | 'hidden' | 'partial';

export interface EdgeOcclusionDetail {
  edgeId: string;
  classification: EdgeVisibilityClassification;
  visibleFraction: number;
  hiddenFraction: number;
  visibleSegments: Array<[THREE.Vector3, THREE.Vector3]>;
  hiddenSegments: Array<[THREE.Vector3, THREE.Vector3]>;
}

export interface VisibilityOptions {
  autoHiddenLines: boolean;
  /**
   * Progressive reveal for section triangle MNP (used in Teacher Mode):
   * 0 = hide MN, NP, PM
   * 1 = show MN
   * 2 = show MN, NP
   * 3 = show MN, NP, PM
   */
  progressiveSectionStep: number;
  /**
   * True when OrthographicCamera is active (e.g. perpendicular base view):
   * rays are parallel to viewForward instead of converging to cameraPosition.
   */
  isOrthographic?: boolean;
  viewForward?: THREE.Vector3;
}

export interface VisibilitySolver {
  update: (
    cameraPosition: THREE.Vector3,
    buffers: {
      pyramidVisible: Float32Array;
      pyramidHidden: Float32Array;
      sectionVisible: Float32Array;
      sectionHidden: Float32Array;
    },
    options: VisibilityOptions,
  ) => {
    pyramidVisibleCount: number;
    pyramidHiddenCount: number;
    sectionVisibleCount: number;
    sectionHiddenCount: number;
  };
  analyzeAllEdges: (
    cameraPosition: THREE.Vector3,
    options?: { isOrthographic?: boolean; viewForward?: THREE.Vector3 },
  ) => Record<string, EdgeOcclusionDetail>;
  maxVerticesPerBuffer: number;
}

const SAMPLE_STEPS = 48;
const BISECTION_STEPS = 7;
const COPLANAR_EPS = 1e-4;
const RAY_FRONT_EPS = 1e-4;
const BARY_EPS = 1e-5;

const _rayDir = new THREE.Vector3();
const _rayOrigin = new THREE.Vector3();
const _edge1 = new THREE.Vector3();
const _edge2 = new THREE.Vector3();
const _pvec = new THREE.Vector3();
const _tvec = new THREE.Vector3();
const _qvec = new THREE.Vector3();
const _sample = new THREE.Vector3();
const _pStart = new THREE.Vector3();
const _pEnd = new THREE.Vector3();
const _toCam = new THREE.Vector3();

function buildOutwardTriangles(
  solidFaces: ParsedFace[],
  solidCentroid: THREE.Vector3,
): SolidTriangle[] {
  const triangles: SolidTriangle[] = [];
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const triCenter = new THREE.Vector3();
  const toFace = new THREE.Vector3();

  for (const face of solidFaces) {
    const pts = face.points;
    if (pts.length < 3) continue;

    for (let i = 1; i < pts.length - 1; i++) {
      let a = pts[0];
      let b = pts[i];
      let c = pts[i + 1];

      ab.subVectors(b, a);
      ac.subVectors(c, a);
      const normal = new THREE.Vector3().crossVectors(ab, ac);
      const len = normal.length();
      if (len < 1e-8) continue;
      normal.divideScalar(len);

      triCenter.copy(a).add(b).add(c).divideScalar(3);
      toFace.subVectors(triCenter, solidCentroid);

      if (normal.dot(toFace) < 0) {
        normal.negate();
        const tmp = b;
        b = c;
        c = tmp;
      }

      triangles.push({
        a,
        b,
        c,
        normal,
        planeOffset: normal.dot(a),
      });
    }
  }

  return triangles;
}

/**
 * Tests whether segment (rayOrigin -> targetPoint) intersects solid triangle (a, b, c)
 * strictly before reaching targetPoint (s in (0, 1 - RAY_FRONT_EPS)).
 */
function rayHitsTriangleBeforePoint(
  rayOrigin: THREE.Vector3,
  targetPoint: THREE.Vector3,
  tri: SolidTriangle,
): boolean {
  _rayDir.subVectors(targetPoint, rayOrigin);

  _edge1.subVectors(tri.b, tri.a);
  _edge2.subVectors(tri.c, tri.a);

  _pvec.crossVectors(_rayDir, _edge2);
  const det = _edge1.dot(_pvec);

  if (Math.abs(det) < 1e-8) {
    return false;
  }

  const invDet = 1 / det;
  _tvec.subVectors(rayOrigin, tri.a);
  const u = _tvec.dot(_pvec) * invDet;
  if (u < -BARY_EPS || u > 1 + BARY_EPS) {
    return false;
  }

  _qvec.crossVectors(_tvec, _edge1);
  const v = _rayDir.dot(_qvec) * invDet;
  if (v < -BARY_EPS || u + v > 1 + BARY_EPS) {
    return false;
  }

  const s = _edge2.dot(_qvec) * invDet;
  return s > 1e-5 && s < 1 - RAY_FRONT_EPS;
}

function isSectionEdgeIncluded(edge: ParsedEdge, progressiveStep: number): boolean {
  if (progressiveStep >= 3) return true;
  if (progressiveStep <= 0) return false;
  const id = edge.id.toUpperCase();
  if (id === 'MN' || (edge.from === 'M' && edge.to === 'N') || (edge.from === 'N' && edge.to === 'M')) {
    return progressiveStep >= 1;
  }
  if (id === 'NP' || (edge.from === 'N' && edge.to === 'P') || (edge.from === 'P' && edge.to === 'N')) {
    return progressiveStep >= 2;
  }
  return progressiveStep >= 3;
}

export function createVisibilitySolver(geometry: ParsedGeometry): VisibilitySolver {
  // ONLY solidFaces (ABCD, SAB, SBC, SCD, SDA) act as geometric occluders.
  // Translucent illustration planes (triangle MNP / extended plane (MNP)) are explicitly excluded.
  const solidCentroid = new THREE.Vector3();
  const seenIds = new Set<string>();
  let solidVertexCount = 0;

  for (const face of geometry.solidFaces) {
    for (let i = 0; i < face.vertexIds.length; i++) {
      const vid = face.vertexIds[i];
      if (!seenIds.has(vid)) {
        seenIds.add(vid);
        solidCentroid.add(face.points[i]);
        solidVertexCount++;
      }
    }
  }
  if (solidVertexCount > 0) {
    solidCentroid.divideScalar(solidVertexCount);
  } else {
    solidCentroid.copy(geometry.center);
  }

  const solidTriangles = buildOutwardTriangles(geometry.solidFaces, solidCentroid);

  const edgeMeta: Array<{
    edge: ParsedEdge;
    nonCoplanarTriangles: SolidTriangle[];
  }> = geometry.edges.map((edge) => {
    const nonCoplanarTriangles = solidTriangles.filter((tri) => {
      const distA = Math.abs(tri.normal.dot(edge.start) - tri.planeOffset);
      const distB = Math.abs(tri.normal.dot(edge.end) - tri.planeOffset);
      return distA > COPLANAR_EPS || distB > COPLANAR_EPS;
    });
    return { edge, nonCoplanarTriangles };
  });

  const orthoRayDistance = geometry.boundingRadius * 20;

  function isPointOccluded(
    cameraPos: THREE.Vector3,
    point: THREE.Vector3,
    candidateTriangles: SolidTriangle[],
    isOrthographic: boolean,
    viewForward?: THREE.Vector3,
  ): boolean {
    if (isOrthographic && viewForward) {
      _rayOrigin.copy(point).addScaledVector(viewForward, -orthoRayDistance);
    } else {
      _rayOrigin.copy(cameraPos);
    }

    for (let i = 0; i < candidateTriangles.length; i++) {
      const tri = candidateTriangles[i];
      if (isOrthographic && viewForward) {
        if (tri.normal.dot(viewForward) >= -1e-5) {
          continue;
        }
      } else {
        _toCam.subVectors(cameraPos, tri.a);
        if (tri.normal.dot(_toCam) <= 1e-5) {
          continue;
        }
      }

      if (rayHitsTriangleBeforePoint(_rayOrigin, point, tri)) {
        return true;
      }
    }
    return false;
  }

  const maxSegmentsPerEdge = SAMPLE_STEPS + 2;
  const maxVerticesPerBuffer = geometry.edges.length * maxSegmentsPerEdge * 2;

  function writeSegment(
    buffer: Float32Array,
    vertexIndex: number,
    p0: THREE.Vector3,
    p1: THREE.Vector3,
  ): number {
    const offset = vertexIndex * 3;
    buffer[offset] = p0.x;
    buffer[offset + 1] = p0.y;
    buffer[offset + 2] = p0.z;
    buffer[offset + 3] = p1.x;
    buffer[offset + 4] = p1.y;
    buffer[offset + 5] = p1.z;
    return vertexIndex + 2;
  }

  function solveSingleEdge(
    meta: { edge: ParsedEdge; nonCoplanarTriangles: SolidTriangle[] },
    cameraPosition: THREE.Vector3,
    isOrtho: boolean,
    viewForward: THREE.Vector3 | undefined,
    onSegment: (p0: THREE.Vector3, p1: THREE.Vector3, isOccluded: boolean, t0: number, t1: number) => void,
  ) {
    const { edge, nonCoplanarTriangles } = meta;
    let prevT = 0;
    _sample.lerpVectors(edge.start, edge.end, 0.004);
    let prevOccluded = isPointOccluded(
      cameraPosition,
      _sample,
      nonCoplanarTriangles,
      isOrtho,
      viewForward,
    );
    let segStartT = 0;

    for (let step = 1; step <= SAMPLE_STEPS; step++) {
      const t = step === SAMPLE_STEPS ? 0.996 : (step / SAMPLE_STEPS) * 0.992 + 0.004;
      _sample.lerpVectors(edge.start, edge.end, t);
      const occluded = isPointOccluded(
        cameraPosition,
        _sample,
        nonCoplanarTriangles,
        isOrtho,
        viewForward,
      );

      if (occluded !== prevOccluded) {
        let lo = prevT === 0 ? 0.004 : prevT;
        let hi = t;
        for (let b = 0; b < BISECTION_STEPS; b++) {
          const mid = (lo + hi) * 0.5;
          _sample.lerpVectors(edge.start, edge.end, mid);
          const midOcc = isPointOccluded(
            cameraPosition,
            _sample,
            nonCoplanarTriangles,
            isOrtho,
            viewForward,
          );
          if (midOcc === prevOccluded) {
            lo = mid;
          } else {
            hi = mid;
          }
        }
        const splitT = (lo + hi) * 0.5;
        _pStart.lerpVectors(edge.start, edge.end, segStartT);
        _pEnd.lerpVectors(edge.start, edge.end, splitT);
        onSegment(_pStart, _pEnd, prevOccluded, segStartT, splitT);
        segStartT = splitT;
        prevOccluded = occluded;
      }
      prevT = t;
    }

    _pStart.lerpVectors(edge.start, edge.end, segStartT);
    _pEnd.copy(edge.end);
    onSegment(_pStart, _pEnd, prevOccluded, segStartT, 1);
  }

  function update(
    cameraPosition: THREE.Vector3,
    buffers: {
      pyramidVisible: Float32Array;
      pyramidHidden: Float32Array;
      sectionVisible: Float32Array;
      sectionHidden: Float32Array;
    },
    options: VisibilityOptions,
  ) {
    let pyramidVisibleCount = 0;
    let pyramidHiddenCount = 0;
    let sectionVisibleCount = 0;
    let sectionHiddenCount = 0;

    const isOrtho = Boolean(options.isOrthographic && options.viewForward);

    for (let eIdx = 0; eIdx < edgeMeta.length; eIdx++) {
      const meta = edgeMeta[eIdx];
      const { edge } = meta;
      const isSection = edge.group === 'section';

      if (isSection && !isSectionEdgeIncluded(edge, options.progressiveSectionStep)) {
        continue;
      }

      if (!options.autoHiddenLines) {
        if (isSection) {
          sectionVisibleCount = writeSegment(
            buffers.sectionVisible,
            sectionVisibleCount,
            edge.start,
            edge.end,
          );
        } else {
          pyramidVisibleCount = writeSegment(
            buffers.pyramidVisible,
            pyramidVisibleCount,
            edge.start,
            edge.end,
          );
        }
        continue;
      }

      solveSingleEdge(meta, cameraPosition, isOrtho, options.viewForward, (p0, p1, occluded) => {
        if (isSection) {
          if (occluded) {
            sectionHiddenCount = writeSegment(buffers.sectionHidden, sectionHiddenCount, p0, p1);
          } else {
            sectionVisibleCount = writeSegment(buffers.sectionVisible, sectionVisibleCount, p0, p1);
          }
        } else {
          if (occluded) {
            pyramidHiddenCount = writeSegment(buffers.pyramidHidden, pyramidHiddenCount, p0, p1);
          } else {
            pyramidVisibleCount = writeSegment(buffers.pyramidVisible, pyramidVisibleCount, p0, p1);
          }
        }
      });
    }

    return {
      pyramidVisibleCount,
      pyramidHiddenCount,
      sectionVisibleCount,
      sectionHiddenCount,
    };
  }

  function analyzeAllEdges(
    cameraPosition: THREE.Vector3,
    options?: { isOrthographic?: boolean; viewForward?: THREE.Vector3 },
  ): Record<string, EdgeOcclusionDetail> {
    const isOrtho = Boolean(options?.isOrthographic && options?.viewForward);
    const results: Record<string, EdgeOcclusionDetail> = {};

    for (const meta of edgeMeta) {
      let visibleT = 0;
      let hiddenT = 0;
      const visibleSegments: Array<[THREE.Vector3, THREE.Vector3]> = [];
      const hiddenSegments: Array<[THREE.Vector3, THREE.Vector3]> = [];

      solveSingleEdge(meta, cameraPosition, isOrtho, options?.viewForward, (p0, p1, occluded, t0, t1) => {
        const span = Math.max(0, t1 - t0);
        if (occluded) {
          hiddenT += span;
          hiddenSegments.push([p0.clone(), p1.clone()]);
        } else {
          visibleT += span;
          visibleSegments.push([p0.clone(), p1.clone()]);
        }
      });

      const total = Math.max(visibleT + hiddenT, 1e-6);
      const visibleFraction = visibleT / total;
      const hiddenFraction = hiddenT / total;

      let classification: EdgeVisibilityClassification = 'partial';
      if (visibleFraction >= 0.96) {
        classification = 'visible';
      } else if (visibleFraction <= 0.04) {
        classification = 'hidden';
      }

      results[meta.edge.id] = {
        edgeId: meta.edge.id,
        classification,
        visibleFraction,
        hiddenFraction,
        visibleSegments,
        hiddenSegments,
      };
    }

    return results;
  }

  return {
    update,
    analyzeAllEdges,
    maxVerticesPerBuffer,
  };
}
