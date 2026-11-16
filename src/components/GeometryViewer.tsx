import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { ParsedGeometry } from '../geometry/parseGeometry';
import {
  buildExportablePyramidGroup,
  buildPyramidScene,
  type DesignerRenderState,
  type HighlightPairMode,
  type PyramidSceneRig,
  type SectionDisplayMode,
} from '../geometry/buildPyramid';
import type { EdgeOcclusionDetail } from '../geometry/visibility';

export type CameraPreset = 'default' | 'top' | 'front' | 'side' | 'ortho_base';

export interface GeometryViewerHandle {
  setCameraPreset: (preset: CameraPreset) => void;
  captureSnapshot: () => void;
  startWebXR: (overlayElement: HTMLElement) => Promise<void>;
  stopWebXR: () => Promise<void>;
  setARTransform: (scaleMultiplier: number, rotationYDeg: number) => void;
  analyzeCurrentOcclusion: () => Record<string, EdgeOcclusionDetail> | null;
}

export interface GeometryViewerProps {
  geometry: ParsedGeometry;
  showBase: boolean;
  baseOpacity: number;
  showSection: boolean;
  sectionOpacity: number;
  sectionDisplayMode: SectionDisplayMode;
  comparisonMode: boolean;
  showPlaneLabels: boolean;
  showLabels: boolean;
  showGrid: boolean;
  autoRotate: boolean;
  autoHiddenLines: boolean;
  showHiddenEdges: boolean;
  progressiveSectionStep: number;
  selectedMidpoint: 'M' | 'N' | 'P' | null;
  highlightPair: HighlightPairMode;
  mnNpDrawProgress?: number;
  wowActivePair?: 'none' | 'mn_np' | 'all';
  designerState: DesignerRenderState;
  onVertexClick?: (vertexId: string) => void;
  onEdgeClick?: (edgeId: string) => void;
  onWebXRStateChange: (active: boolean, errorMessage?: string | null) => void;
}

function detectWebGLSupport(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl2') || canvas.getContext('webgl')),
    );
  } catch {
    return false;
  }
}

export const GeometryViewer = forwardRef<GeometryViewerHandle, GeometryViewerProps>(
  function GeometryViewer(
    {
      geometry,
      showBase,
      baseOpacity,
      showSection,
      sectionOpacity,
      sectionDisplayMode,
      comparisonMode,
      showPlaneLabels,
      showLabels,
      showGrid,
      autoRotate,
      autoHiddenLines,
      showHiddenEdges,
      progressiveSectionStep,
      selectedMidpoint,
      highlightPair,
      mnNpDrawProgress = 1,
      wowActivePair = 'none',
      designerState,
      onVertexClick,
      onEdgeClick,
      onWebXRStateChange,
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const labelRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const basePlaneLabelRef = useRef<HTMLDivElement | null>(null);
    const mnpPlaneLabelRef = useRef<HTMLDivElement | null>(null);

    const [contextLost, setContextLost] = useState(false);
    const webglSupported = useMemo(() => detectWebGLSupport(), []);

    const sceneApiRef = useRef<{
      setCameraPreset: (preset: CameraPreset) => void;
      syncState: (recomputeVisibility: boolean) => void;
      captureSnapshot: () => void;
      startWebXR: (overlayElement: HTMLElement) => Promise<void>;
      stopWebXR: () => Promise<void>;
      setARTransform: (scaleMultiplier: number, rotationYDeg: number) => void;
      analyzeCurrentOcclusion: () => Record<string, EdgeOcclusionDetail> | null;
    } | null>(null);

    // Latest prop refs for synchronous reading inside Three.js RAF loop
    const showBaseRef = useRef(showBase);
    const baseOpacityRef = useRef(baseOpacity);
    const showSectionRef = useRef(showSection);
    const sectionOpacityRef = useRef(sectionOpacity);
    const sectionDisplayModeRef = useRef(sectionDisplayMode);
    const comparisonModeRef = useRef(comparisonMode);
    const showPlaneLabelsRef = useRef(showPlaneLabels);
    const showLabelsRef = useRef(showLabels);
    const showGridRef = useRef(showGrid);
    const autoRotateRef = useRef(autoRotate);
    const autoHiddenLinesRef = useRef(autoHiddenLines);
    const showHiddenEdgesRef = useRef(showHiddenEdges);
    const progressiveStepRef = useRef(progressiveSectionStep);
    const selectedMidpointRef = useRef(selectedMidpoint);
    const highlightPairRef = useRef(highlightPair);
    const mnNpDrawProgressRef = useRef(mnNpDrawProgress);
    const wowActivePairRef = useRef(wowActivePair);
    const designerStateRef = useRef(designerState);
    const onVertexClickRef = useRef(onVertexClick);
    const onEdgeClickRef = useRef(onEdgeClick);
    const onWebXRStateChangeRef = useRef(onWebXRStateChange);

    showBaseRef.current = showBase;
    baseOpacityRef.current = baseOpacity;
    showSectionRef.current = showSection;
    sectionOpacityRef.current = sectionOpacity;
    sectionDisplayModeRef.current = sectionDisplayMode;
    comparisonModeRef.current = comparisonMode;
    showPlaneLabelsRef.current = showPlaneLabels;
    showLabelsRef.current = showLabels;
    showGridRef.current = showGrid;
    autoRotateRef.current = autoRotate;
    autoHiddenLinesRef.current = autoHiddenLines;
    showHiddenEdgesRef.current = showHiddenEdges;
    progressiveStepRef.current = progressiveSectionStep;
    selectedMidpointRef.current = selectedMidpoint;
    highlightPairRef.current = highlightPair;
    mnNpDrawProgressRef.current = mnNpDrawProgress;
    wowActivePairRef.current = wowActivePair;
    designerStateRef.current = designerState;
    onVertexClickRef.current = onVertexClick;
    onEdgeClickRef.current = onEdgeClick;
    onWebXRStateChangeRef.current = onWebXRStateChange;

    useImperativeHandle(
      ref,
      () => ({
        setCameraPreset: (preset) => sceneApiRef.current?.setCameraPreset(preset),
        captureSnapshot: () => sceneApiRef.current?.captureSnapshot(),
        startWebXR: async (el) => {
          if (sceneApiRef.current) {
            await sceneApiRef.current.startWebXR(el);
          }
        },
        stopWebXR: async () => {
          if (sceneApiRef.current) {
            await sceneApiRef.current.stopWebXR();
          }
        },
        setARTransform: (scale, rot) => {
          sceneApiRef.current?.setARTransform(scale, rot);
        },
        analyzeCurrentOcclusion: () =>
          sceneApiRef.current?.analyzeCurrentOcclusion() ?? null,
      }),
      [],
    );

    useEffect(() => {
      sceneApiRef.current?.syncState(true);
    }, [
      showBase,
      baseOpacity,
      showSection,
      sectionOpacity,
      sectionDisplayMode,
      comparisonMode,
      showPlaneLabels,
      showLabels,
      showGrid,
      autoRotate,
      autoHiddenLines,
      showHiddenEdges,
      progressiveSectionStep,
      selectedMidpoint,
      highlightPair,
      mnNpDrawProgress,
      wowActivePair,
      designerState,
    ]);

    useEffect(() => {
      const container = containerRef.current;
      if (!container || !webglSupported) return;

      const _projVec = new THREE.Vector3();
      const _offsetDir = new THREE.Vector3();
      const _viewForward = new THREE.Vector3();
      const _pointerNDC = new THREE.Vector2();
      const raycaster = new THREE.Raycaster();

      const width = Math.max(container.clientWidth, 1);
      const height = Math.max(container.clientHeight, 1);

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true,
      });

      const rawGl = renderer.getContext();
      const dbgExt = rawGl.getExtension('WEBGL_debug_renderer_info');
      const glRendererStr = dbgExt
        ? String(rawGl.getParameter(dbgExt.UNMASKED_RENDERER_WEBGL))
        : '';
      const isSoftwareGl = /swiftshader|llvmpipe|softpipe/i.test(glRendererStr);

      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSoftwareGl ? 1 : 2));
      renderer.setSize(width, height);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.04;
      renderer.domElement.style.display = 'block';
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.touchAction = 'none';
      container.appendChild(renderer.domElement);

      const scene = new THREE.Scene();

      const pmrem = new THREE.PMREMGenerator(renderer);
      const envScene = new RoomEnvironment();
      const envTexture = pmrem.fromScene(envScene, 0.04).texture;
      scene.environment = envTexture;
      envScene.dispose();
      pmrem.dispose();

      const hemiLight = new THREE.HemisphereLight(0xffffff, 0xcbeee9, 1.05);
      const dirLight = new THREE.DirectionalLight(0xffffff, 1.15);
      dirLight.position.set(5.5, 9, 6.5);
      scene.add(hemiLight);
      scene.add(dirLight);

      const aspect = width / height;
      const perspCamera = new THREE.PerspectiveCamera(42, aspect, 0.1, 100);
      perspCamera.position.copy(geometry.defaultCameraPosition);

      const computeEffectiveOrthoHalfHeight = (curAspect: number) =>
        Math.max(geometry.boundingRadius * 1.05, 3.2, 2.85 / Math.max(curAspect, 0.5));

      const initialOrthoHalfH = computeEffectiveOrthoHalfHeight(aspect);
      const orthoCamera = new THREE.OrthographicCamera(
        -initialOrthoHalfH * aspect,
        initialOrthoHalfH * aspect,
        initialOrthoHalfH,
        -initialOrthoHalfH,
        0.1,
        100,
      );

      let activeCamera: THREE.Camera = perspCamera;
      let isOrthographic = false;

      // Exact base ABCD orthonormal frame strictly from single-source-of-truth vertexMap
      const ptA = geometry.vertexMap.get('A')!.position;
      const ptB = geometry.vertexMap.get('B')!.position;
      const ptC = geometry.vertexMap.get('C')!.position;
      const ptD = geometry.vertexMap.get('D')!.position;
      const ptS = geometry.vertexMap.get('S')!.position;

      const baseCenter = new THREE.Vector3()
        .add(ptA)
        .add(ptB)
        .add(ptC)
        .add(ptD)
        .multiplyScalar(0.25);
      const baseNormal = new THREE.Vector3().crossVectors(
        new THREE.Vector3().subVectors(ptB, ptA),
        new THREE.Vector3().subVectors(ptD, ptA),
      );
      if (baseNormal.lengthSq() > 1e-8) {
        baseNormal.normalize();
        if (baseNormal.dot(new THREE.Vector3().subVectors(ptS, baseCenter)) < 0) {
          baseNormal.negate();
        }
      } else {
        baseNormal.set(0, 1, 0);
      }

      const abDir = new THREE.Vector3().subVectors(ptB, ptA).normalize();
      const baseUpDir = new THREE.Vector3().crossVectors(baseNormal, abDir).normalize();
      if (baseUpDir.z > 0) baseUpDir.negate();

      const controls = new OrbitControls(perspCamera as THREE.Camera, renderer.domElement);
      controls.target.copy(geometry.defaultCameraTarget);
      controls.enableDamping = !isSoftwareGl;
      controls.dampingFactor = 0.08;
      controls.enablePan = true;
      controls.autoRotate = autoRotateRef.current && !isSoftwareGl;
      controls.autoRotateSpeed = 1.4;
      controls.minDistance = Math.max(geometry.boundingRadius * 0.65, 1.6);
      controls.maxDistance = geometry.boundingRadius * 6;
      controls.rotateSpeed = 0.85;
      controls.zoomSpeed = 0.9;
      controls.update();

      const rig: PyramidSceneRig = buildPyramidScene(geometry);
      rig.setResolution(width, height);
      scene.add(rig.root);

      function applyPropsToRig() {
        rig.baseGroup.visible = showBaseRef.current;
        rig.setBaseOpacity(baseOpacityRef.current);
        rig.sectionGroup.visible =
          showSectionRef.current && progressiveStepRef.current >= 3;
        rig.setSectionOpacity(sectionOpacityRef.current);
        rig.setSectionDisplayMode(sectionDisplayModeRef.current);
        rig.gridHelper.visible = showGridRef.current;
        rig.setHiddenLinesVisible(showHiddenEdgesRef.current);
        rig.setHighlightState({
          selectedMidpoint: selectedMidpointRef.current,
          highlightPair: highlightPairRef.current,
          comparisonMode: comparisonModeRef.current,
          mnNpDrawProgress: mnNpDrawProgressRef.current,
          wowActivePair: wowActivePairRef.current,
        });
        rig.setDesignerState(designerStateRef.current);
      }

      applyPropsToRig();

      if (!isSoftwareGl) {
        renderer.compile(scene, perspCamera);
      }

      const lastSolvedCamPos = new THREE.Vector3(Infinity, Infinity, Infinity);
      let lastSolvedOrthoFlag = false;
      let forceSolveVisibility = true;
      let isTransitioningCamera = false;
      const targetCamPos = new THREE.Vector3().copy(geometry.defaultCameraPosition);
      const targetLookAt = new THREE.Vector3().copy(geometry.defaultCameraTarget);
      let lastFrameTime = performance.now();

      const labelCoords: Array<{
        id: string;
        text: string;
        role: string;
        x: number;
        y: number;
        visible: boolean;
      }> = geometry.vertices.map((v) => ({
        id: v.id,
        text: v.label,
        role: v.role,
        x: -9999,
        y: -9999,
        visible: false,
      }));

      function placePlaneLabel(
        el: HTMLDivElement | null,
        anchor: THREE.Vector3,
        visible: boolean,
        cw: number,
        ch: number,
        preferDown: boolean,
      ) {
        if (!el) return;
        if (!visible || xrActive) {
          el.style.opacity = '0';
          el.style.transform = 'translate3d(-9999px, -9999px, 0)';
          return;
        }
        _projVec.copy(anchor).project(activeCamera);
        if (_projVec.z > 1 || _projVec.z < -1) {
          el.style.opacity = '0';
          el.style.transform = 'translate3d(-9999px, -9999px, 0)';
          return;
        }
        let px = THREE.MathUtils.clamp(((_projVec.x + 1) * 0.5) * cw, 74, Math.max(74, cw - 74));
        let py = THREE.MathUtils.clamp(((-_projVec.y + 1) * 0.5) * ch, 22, Math.max(22, ch - 22));

        // Repel away from every visible vertex badge so vertex labels are never covered
        for (const slot of labelCoords) {
          if (!slot.visible) continue;
          const dx = px - slot.x;
          const dy = py - slot.y;
          if (Math.abs(dx) < 62 && Math.abs(dy) < 26) {
            py = THREE.MathUtils.clamp(
              py + (preferDown ? 28 : -28),
              22,
              Math.max(22, ch - 22),
            );
            px = THREE.MathUtils.clamp(px, 74, Math.max(74, cw - 74));
          }
        }

        el.style.opacity = '1';
        el.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0) translate(-50%, -50%)`;
      }

      function computeProjectedLabels() {
        const cw = container?.clientWidth ?? 0;
        const ch = container?.clientHeight ?? 0;

        for (let i = 0; i < geometry.vertices.length; i++) {
          const vertex = geometry.vertices[i];
          const slot = labelCoords[i];

          if (!showLabelsRef.current || xrActive) {
            slot.visible = false;
            continue;
          }

          _offsetDir.subVectors(vertex.position, geometry.center);
          if (_offsetDir.lengthSq() > 1e-5) {
            _offsetDir.normalize().multiplyScalar(0.28);
          } else {
            _offsetDir.set(0, 0.28, 0);
          }
          _projVec.copy(vertex.position).add(_offsetDir).project(activeCamera);

          if (_projVec.z > 1 || _projVec.z < -1) {
            slot.visible = false;
            continue;
          }

          slot.x = THREE.MathUtils.clamp(((_projVec.x + 1) * 0.5) * cw, 24, Math.max(24, cw - 24));
          slot.y = THREE.MathUtils.clamp(((-_projVec.y + 1) * 0.5) * ch, 22, Math.max(22, ch - 22));
          slot.visible = true;
        }

        const minDist = 30;
        for (let pass = 0; pass < 2; pass++) {
          for (let i = 0; i < labelCoords.length; i++) {
            const a = labelCoords[i];
            if (!a.visible) continue;
            for (let j = i + 1; j < labelCoords.length; j++) {
              const b = labelCoords[j];
              if (!b.visible) continue;
              const dx = b.x - a.x;
              const dy = b.y - a.y;
              const dSq = dx * dx + dy * dy;
              if (dSq < minDist * minDist) {
                const d = Math.sqrt(dSq) || 0.01;
                const push = (minDist - d) * 0.5;
                const nx = dSq < 0.01 ? 0.707 : dx / d;
                const ny = dSq < 0.01 ? 0.707 : dy / d;
                a.x -= nx * push;
                a.y -= ny * push;
                b.x += nx * push;
                b.y += ny * push;
              }
            }
          }
        }

        for (let i = 0; i < labelCoords.length; i++) {
          const slot = labelCoords[i];
          const el = labelRefs.current[slot.id];
          if (!el) continue;

          if (!slot.visible) {
            el.style.opacity = '0';
            el.style.transform = 'translate3d(-9999px, -9999px, 0)';
          } else {
            el.style.opacity = '1';
            el.style.transform = `translate3d(${slot.x.toFixed(1)}px, ${slot.y.toFixed(1)}px, 0) translate(-50%, -50%)`;
          }
        }

        const shouldShowBasePlaneLabel =
          showBaseRef.current &&
          (showPlaneLabelsRef.current || comparisonModeRef.current);
        const shouldShowMnpPlaneLabel =
          showSectionRef.current &&
          progressiveStepRef.current >= 3 &&
          (showPlaneLabelsRef.current ||
            comparisonModeRef.current ||
            sectionDisplayModeRef.current === 'plane');

        placePlaneLabel(
          basePlaneLabelRef.current,
          geometry.basePlaneLabelAnchor,
          shouldShowBasePlaneLabel,
          cw,
          ch,
          true,
        );
        placePlaneLabel(
          mnpPlaneLabelRef.current,
          geometry.mnpPlaneLabelAnchor,
          shouldShowMnpPlaneLabel,
          cw,
          ch,
          false,
        );
      }

      let frameId = 0;
      let renderBusy = false;
      let renderDirty = false;
      let disposed = false;
      let xrActive = false;

      function afterDraw(cb: () => void) {
        const gl = renderer.getContext() as WebGL2RenderingContext;
        if (typeof gl.fenceSync !== 'function') {
          frameId = window.setTimeout(cb, 80);
          return;
        }
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (disposed) {
            if (sync) gl.deleteSync(sync);
            return;
          }
          const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      }

      function requestRender() {
        if (disposed || xrActive) return;
        if (renderBusy) {
          renderDirty = true;
          return;
        }
        renderBusy = true;
        frameId = requestAnimationFrame((now) => {
          if (disposed || xrActive) {
            renderBusy = false;
            return;
          }
          renderDirty = false;

          const dt = Math.min((now - lastFrameTime) / 1000, 0.1);
          lastFrameTime = now;

          let needsContinue = false;
          if (isTransitioningCamera && !isOrthographic) {
            const lambda = 10;
            perspCamera.position.x = THREE.MathUtils.damp(perspCamera.position.x, targetCamPos.x, lambda, dt);
            perspCamera.position.y = THREE.MathUtils.damp(perspCamera.position.y, targetCamPos.y, lambda, dt);
            perspCamera.position.z = THREE.MathUtils.damp(perspCamera.position.z, targetCamPos.z, lambda, dt);
            controls.target.x = THREE.MathUtils.damp(controls.target.x, targetLookAt.x, lambda, dt);
            controls.target.y = THREE.MathUtils.damp(controls.target.y, targetLookAt.y, lambda, dt);
            controls.target.z = THREE.MathUtils.damp(controls.target.z, targetLookAt.z, lambda, dt);

            const posDist = perspCamera.position.distanceToSquared(targetCamPos);
            const tgtDist = controls.target.distanceToSquared(targetLookAt);
            if (posDist < 1e-4 && tgtDist < 1e-4) {
              perspCamera.position.copy(targetCamPos);
              controls.target.copy(targetLookAt);
              isTransitioningCamera = false;
            } else {
              needsContinue = true;
            }
          }

          const controlsChanged = controls.update();
          if (controlsChanged || (autoRotateRef.current && !isSoftwareGl && !isOrthographic)) {
            needsContinue = true;
          }

          if (
            forceSolveVisibility ||
            lastSolvedOrthoFlag !== isOrthographic ||
            activeCamera.position.distanceToSquared(lastSolvedCamPos) > 1e-7
          ) {
            activeCamera.getWorldDirection(_viewForward);
            rig.updateVisibility(activeCamera.position, {
              autoHiddenLines: autoHiddenLinesRef.current,
              progressiveSectionStep: progressiveStepRef.current,
              isOrthographic,
              viewForward: _viewForward,
            });
            lastSolvedCamPos.copy(activeCamera.position);
            lastSolvedOrthoFlag = isOrthographic;
            forceSolveVisibility = false;
          }

          computeProjectedLabels();
          renderer.render(scene, activeCamera);

          const done = () => {
            renderBusy = false;
            if (renderDirty || needsContinue) {
              requestRender();
            }
          };

          if (isSoftwareGl) {
            afterDraw(done);
          } else {
            done();
          }
        });
      }

      // Pointer click raycasting for interactive vertices & edges
      let pointerDownX = 0;
      let pointerDownY = 0;

      const handlePointerDown = (e: PointerEvent) => {
        pointerDownX = e.clientX;
        pointerDownY = e.clientY;
      };

      const handlePointerUp = (e: PointerEvent) => {
        const dx = e.clientX - pointerDownX;
        const dy = e.clientY - pointerDownY;
        if (dx * dx + dy * dy > 36) return; // Dragged to orbit, ignore click

        const rect = renderer.domElement.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;

        _pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        _pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(_pointerNDC, activeCamera);

        // In Designer mode prioritize edge clicking
        if (designerStateRef.current.mode !== 'off' && onEdgeClickRef.current) {
          const edgeHits = raycaster.intersectObjects(rig.edgeHitMeshes, false);
          if (edgeHits.length > 0) {
            const edgeId = edgeHits[0].object.userData?.edgeId;
            if (typeof edgeId === 'string') {
              onEdgeClickRef.current(edgeId);
              return;
            }
          }
        }

        if (onVertexClickRef.current) {
          const vHits = raycaster.intersectObjects(rig.vertexHitMeshes, false);
          if (vHits.length > 0) {
            const vertexId = vHits[0].object.userData?.vertexId;
            if (typeof vertexId === 'string') {
              onVertexClickRef.current(vertexId);
              return;
            }
          }
        }
      };

      renderer.domElement.addEventListener('pointerdown', handlePointerDown);
      renderer.domElement.addEventListener('pointerup', handlePointerUp);

      const handleControlsStart = () => {
        isTransitioningCamera = false;
      };
      const handleControlsChange = () => {
        requestRender();
      };
      controls.addEventListener('start', handleControlsStart);
      controls.addEventListener('change', handleControlsChange);

      const handleContextLost = (e: Event) => {
        e.preventDefault();
        setContextLost(true);
      };
      const handleContextRestored = () => {
        setContextLost(false);
        forceSolveVisibility = true;
        requestRender();
      };
      renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

      const resizeObserver = new ResizeObserver(() => {
        if (!container || disposed || xrActive) return;
        const w = Math.max(container.clientWidth, 1);
        const h = Math.max(container.clientHeight, 1);
        const newAspect = w / h;

        perspCamera.aspect = newAspect;
        perspCamera.updateProjectionMatrix();

        const effHalfH = computeEffectiveOrthoHalfHeight(newAspect);
        orthoCamera.left = -effHalfH * newAspect;
        orthoCamera.right = effHalfH * newAspect;
        orthoCamera.top = effHalfH;
        orthoCamera.bottom = -effHalfH;
        orthoCamera.updateProjectionMatrix();

        renderer.setSize(w, h);
        rig.setResolution(w, h);
        requestRender();
      });
      resizeObserver.observe(container);

      let currentXRSession: XRSession | null = null;
      let arExportGroup: { group: THREE.Group; dispose: () => void } | null = null;
      let arReticle: THREE.Mesh | null = null;
      let arReticleMat: THREE.MeshBasicMaterial | null = null;
      let arReticleGeo: THREE.RingGeometry | null = null;
      let hitTestSource: XRHitTestSource | null = null;
      let hitTestRequested = false;
      let arPlaced = false;
      const baseArScale = 0.075;
      const arAnchorPos = new THREE.Vector3(0, -0.25, -0.85);

      function cleanupXRObjects() {
        if (arExportGroup) {
          scene.remove(arExportGroup.group);
          arExportGroup.dispose();
          arExportGroup = null;
        }
        if (arReticle) {
          scene.remove(arReticle);
          arReticle = null;
        }
        arReticleGeo?.dispose();
        arReticleGeo = null;
        arReticleMat?.dispose();
        arReticleMat = null;
        hitTestSource?.cancel();
        hitTestSource = null;
        hitTestRequested = false;
        arPlaced = false;
      }

      async function stopWebXR() {
        if (currentXRSession) {
          try {
            await currentXRSession.end();
          } catch {
            // Session already ended
          }
        }
      }

      function setARTransform(scaleMultiplier: number, rotationYDeg: number) {
        if (!arExportGroup) return;
        const s = baseArScale * scaleMultiplier;
        arExportGroup.group.scale.setScalar(s);
        arExportGroup.group.rotation.y = THREE.MathUtils.degToRad(rotationYDeg);
        arExportGroup.group.position.set(
          arAnchorPos.x - geometry.center.x * s,
          arAnchorPos.y,
          arAnchorPos.z - geometry.center.z * s,
        );
      }

      async function startWebXR(overlayElement: HTMLElement) {
        if (!('xr' in navigator) || !navigator.xr) {
          onWebXRStateChangeRef.current(false, 'Trình duyệt không hỗ trợ WebXR.');
          return;
        }

        try {
          const session = await navigator.xr.requestSession('immersive-ar', {
            optionalFeatures: ['hit-test', 'dom-overlay'],
            domOverlay: { root: overlayElement },
          });

          currentXRSession = session;
          xrActive = true;
          isTransitioningCamera = false;
          controls.enabled = false;
          rig.root.visible = false;
          renderer.xr.enabled = true;
          renderer.xr.setReferenceSpaceType('local');

          arExportGroup = buildExportablePyramidGroup(geometry, {
            showBase: showBaseRef.current,
            showSection: showSectionRef.current,
            targetScaleMeters: baseArScale,
          });
          arAnchorPos.set(0, -0.25, -0.85);
          arExportGroup.group.position.set(
            arAnchorPos.x - geometry.center.x * baseArScale,
            arAnchorPos.y,
            arAnchorPos.z - geometry.center.z * baseArScale,
          );
          scene.add(arExportGroup.group);

          arReticleGeo = new THREE.RingGeometry(0.055, 0.075, 28).rotateX(-Math.PI / 2);
          arReticleMat = new THREE.MeshBasicMaterial({ color: 0x00cfc8 });
          arReticle = new THREE.Mesh(arReticleGeo, arReticleMat);
          arReticle.matrixAutoUpdate = false;
          arReticle.visible = false;
          scene.add(arReticle);

          const onSelect = () => {
            if (arReticle && arReticle.visible && arExportGroup) {
              arAnchorPos.setFromMatrixPosition(arReticle.matrix);
              const curScale = arExportGroup.group.scale.x;
              arExportGroup.group.position.set(
                arAnchorPos.x - geometry.center.x * curScale,
                arAnchorPos.y,
                arAnchorPos.z - geometry.center.z * curScale,
              );
              arPlaced = true;
            }
          };
          session.addEventListener('select', onSelect);

          const onSessionEnd = () => {
            session.removeEventListener('select', onSelect);
            session.removeEventListener('end', onSessionEnd);
            renderer.setAnimationLoop(null);
            renderer.xr.enabled = false;
            currentXRSession = null;
            xrActive = false;
            cleanupXRObjects();

            rig.root.visible = true;
            controls.enabled = true;
            forceSolveVisibility = true;
            onWebXRStateChangeRef.current(false, null);
            requestRender();
          };
          session.addEventListener('end', onSessionEnd);

          await renderer.xr.setSession(session);
          onWebXRStateChangeRef.current(true, null);

          renderer.setAnimationLoop((_time, frame) => {
            if (frame && !arPlaced) {
              const referenceSpace = renderer.xr.getReferenceSpace();
              if (referenceSpace) {
                if (!hitTestRequested) {
                  hitTestRequested = true;
                  session
                    .requestReferenceSpace('viewer')
                    .then((viewerSpace) =>
                      session.requestHitTestSource?.({ space: viewerSpace }),
                    )
                    .then((source) => {
                      if (source) hitTestSource = source;
                    })
                    .catch(() => {});
                }

                if (hitTestSource && arReticle) {
                  const hitResults = frame.getHitTestResults(hitTestSource);
                  if (hitResults.length > 0) {
                    const pose = hitResults[0].getPose(referenceSpace);
                    if (pose) {
                      arReticle.visible = true;
                      arReticle.matrix.fromArray(pose.transform.matrix);
                    }
                  } else {
                    arReticle.visible = false;
                  }
                }
              }
            }
            renderer.render(scene, perspCamera);
          });
        } catch (err) {
          xrActive = false;
          renderer.xr.enabled = false;
          cleanupXRObjects();
          rig.root.visible = true;
          controls.enabled = true;
          const message =
            err instanceof Error
              ? `Không thể mở WebXR AR: ${err.message}`
              : 'Không thể khởi chạy phiên WebXR AR trên thiết bị này.';
          onWebXRStateChangeRef.current(false, message);
          requestRender();
        }
      }

      function setCameraPreset(preset: CameraPreset) {
        if (preset === 'ortho_base') {
          isOrthographic = true;
          isTransitioningCamera = false;
          activeCamera = orthoCamera;

          const curW = Math.max(container?.clientWidth ?? 1, 1);
          const curH = Math.max(container?.clientHeight ?? 1, 1);
          const curAspect = curW / curH;

          const effHalfH = computeEffectiveOrthoHalfHeight(curAspect);
          orthoCamera.left = -effHalfH * curAspect;
          orthoCamera.right = effHalfH * curAspect;
          orthoCamera.top = effHalfH;
          orthoCamera.bottom = -effHalfH;
          orthoCamera.zoom = 1;
          orthoCamera.position.copy(baseCenter).addScaledVector(baseNormal, 14);
          orthoCamera.up.copy(baseUpDir);
          orthoCamera.lookAt(baseCenter);
          orthoCamera.updateProjectionMatrix();

          controls.object = orthoCamera;
          controls.target.copy(baseCenter);
          controls.autoRotate = false;
          controls.update();

          forceSolveVisibility = true;
          requestRender();
          return;
        }

        if (isOrthographic) {
          isOrthographic = false;
          activeCamera = perspCamera;
          perspCamera.up.set(0, 1, 0);
          controls.object = perspCamera;
          controls.autoRotate = autoRotateRef.current && !isSoftwareGl;
        }

        const dist = geometry.defaultCameraPosition.distanceTo(geometry.defaultCameraTarget);
        targetLookAt.copy(geometry.defaultCameraTarget);

        if (preset === 'top') {
          targetCamPos.set(targetLookAt.x, targetLookAt.y + dist * 1.15, targetLookAt.z + 0.01);
        } else if (preset === 'front') {
          targetCamPos.set(targetLookAt.x, targetLookAt.y + dist * 0.16, targetLookAt.z + dist);
        } else if (preset === 'side') {
          targetCamPos.set(targetLookAt.x + dist * 0.98, targetLookAt.y + dist * 0.14, targetLookAt.z + dist * 0.28);
        } else {
          targetCamPos.copy(geometry.defaultCameraPosition);
        }

        if (isSoftwareGl) {
          perspCamera.position.copy(targetCamPos);
          controls.target.copy(targetLookAt);
          controls.update();
          forceSolveVisibility = true;
          requestRender();
        } else {
          isTransitioningCamera = true;
          lastFrameTime = performance.now();
          requestRender();
        }
      }

      function analyzeCurrentOcclusion(): Record<string, EdgeOcclusionDetail> {
        activeCamera.getWorldDirection(_viewForward);
        return rig.analyzeAllEdges(activeCamera.position, {
          isOrthographic,
          viewForward: _viewForward,
        });
      }

      function captureSnapshot() {
        activeCamera.getWorldDirection(_viewForward);
        rig.updateVisibility(activeCamera.position, {
          autoHiddenLines: autoHiddenLinesRef.current,
          progressiveSectionStep: progressiveStepRef.current,
          isOrthographic,
          viewForward: _viewForward,
        });
        computeProjectedLabels();
        renderer.render(scene, activeCamera);

        const webglCanvas = renderer.domElement;
        const outCanvas = document.createElement('canvas');
        outCanvas.width = webglCanvas.width;
        outCanvas.height = webglCanvas.height;
        const ctx = outCanvas.getContext('2d');
        if (!ctx) return;

        const grad = ctx.createRadialGradient(
          outCanvas.width * 0.5,
          outCanvas.height * 0.38,
          outCanvas.width * 0.05,
          outCanvas.width * 0.5,
          outCanvas.height * 0.45,
          outCanvas.width * 0.75,
        );
        grad.addColorStop(0, '#FFFFFF');
        grad.addColorStop(0.58, '#F3FAFC');
        grad.addColorStop(1, '#DFF6F3');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, outCanvas.width, outCanvas.height);

        ctx.drawImage(webglCanvas, 0, 0);

        const dprX = outCanvas.width / Math.max(container?.clientWidth ?? 1, 1);
        const dprY = outCanvas.height / Math.max(container?.clientHeight ?? 1, 1);

        if (showLabelsRef.current) {
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const fontSize = Math.round(14 * dprX);
          ctx.font = `700 ${fontSize}px "JetBrains Mono", monospace`;

          for (const slot of labelCoords) {
            if (!slot.visible) continue;
            const px = slot.x * dprX;
            const py = slot.y * dprY;
            const boxW = Math.round(24 * dprX);
            const boxH = Math.round(22 * dprY);

            ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
            ctx.strokeStyle =
              slot.role === 'apex'
                ? '#CA8A04'
                : slot.role === 'midpoint'
                  ? '#EA580C'
                  : '#2563EB';
            ctx.lineWidth = Math.max(1.5, 1.5 * dprX);

            ctx.beginPath();
            ctx.roundRect(px - boxW / 2, py - boxH / 2, boxW, boxH, 6 * dprX);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle =
              slot.role === 'apex'
                ? '#854D0E'
                : slot.role === 'midpoint'
                  ? '#C2410C'
                  : '#1E3A8A';
            ctx.fillText(slot.text, px, py + 1);
          }
        }

        const pad = Math.round(16 * dprX);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.font = `600 ${Math.round(13 * dprX)}px "Plus Jakarta Sans", sans-serif`;
        ctx.fillStyle = '#064E3B';
        ctx.fillText(
          'Bài 13. Hai mặt phẳng song song (MNP) // (ABCD) — Phát triển bởi Phan Thị Ngọc Thái',
          pad,
          outCanvas.height - pad,
        );

        const url = outCanvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = url;
        link.download = 'Hinh_chop_SABCD_MNP_3D.png';
        document.body.appendChild(link);
        link.click();
        link.remove();
      }

      sceneApiRef.current = {
        setCameraPreset,
        syncState: (recomputeVisibility: boolean) => {
          applyPropsToRig();
          controls.autoRotate = autoRotateRef.current && !isSoftwareGl && !isOrthographic;
          if (recomputeVisibility) {
            forceSolveVisibility = true;
          }
          requestRender();
        },
        captureSnapshot,
        startWebXR,
        stopWebXR,
        setARTransform,
        analyzeCurrentOcclusion,
      };

      requestRender();

      return () => {
        disposed = true;
        cancelAnimationFrame(frameId);
        clearTimeout(frameId);
        resizeObserver.disconnect();
        renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
        renderer.domElement.removeEventListener('pointerup', handlePointerUp);
        controls.removeEventListener('start', handleControlsStart);
        controls.removeEventListener('change', handleControlsChange);
        controls.dispose();
        renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
        renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
        renderer.setAnimationLoop(null);
        if (currentXRSession) {
          void currentXRSession.end().catch(() => {});
        }
        cleanupXRObjects();
        rig.dispose();
        envTexture.dispose();
        renderer.dispose();
        if (renderer.domElement.parentNode === container) {
          container.removeChild(renderer.domElement);
        }
        sceneApiRef.current = null;
      };
    }, [geometry, webglSupported]);

    if (!webglSupported) {
      return (
        <div className="stage-gradient flex h-full w-full items-center justify-center p-6">
          <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            <h2 className="text-base font-bold text-[#064E3B]">
              Thiết bị chưa hỗ trợ WebGL
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Trình duyệt hiện tại không thể khởi tạo ngữ cảnh đồ họa 3D WebGL. Vui lòng bật tăng tốc phần cứng hoặc mở trên Chrome / Safari phiên bản mới hơn.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="stage-gradient relative h-full w-full overflow-hidden touch-none select-none">
        <div
          ref={containerRef}
          className="h-full w-full touch-none"
          aria-label="Khung nhìn mô hình hình chóp 3D"
        />

        <div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          aria-hidden={!showLabels}
        >
          {geometry.vertices.map((v) => {
            const isSelectedMid = selectedMidpoint === v.id;
            const roleClass = isSelectedMid
              ? 'border-[#EA580C] bg-[#FACC15] text-[#064E3B] ring-2 ring-[#EA580C]/40'
              : v.role === 'apex'
                ? 'border-[#CA8A04] text-[#854D0E] bg-[#FEF9C3]/95'
                : v.role === 'midpoint'
                  ? 'border-[#EA580C] text-[#C2410C] bg-white/95'
                  : 'border-[#2563EB] text-[#1E3A8A] bg-white/95 font-extrabold';
            return (
              <div
                key={v.id}
                ref={(el) => {
                  labelRefs.current[v.id] = el;
                }}
                className={`vertex-label border ${roleClass}`}
              >
                {v.label}
              </div>
            );
          })}

          {/* Non-overlapping Plane Labels */}
          <div
            ref={basePlaneLabelRef}
            className="vertex-label border border-[#00CFC8] bg-[#F0FDFA]/95 text-[11px] font-extrabold text-[#064E3B]"
          >
            MẶT PHẲNG (ABCD)
          </div>
          <div
            ref={mnpPlaneLabelRef}
            className="vertex-label border border-[#FFB347] bg-[#FFFBEB]/95 text-[11px] font-extrabold text-[#9A3412]"
          >
            MẶT PHẲNG (MNP)
          </div>
        </div>

        {contextLost && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-100/90 p-6">
            <div className="max-w-sm rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-md">
              <p className="text-sm font-semibold text-slate-900">
                Ngữ cảnh đồ họa WebGL tạm gián đoạn
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Đang chờ trình duyệt khôi phục lại bộ dựng hình 3D...
              </p>
            </div>
          </div>
        )}
      </div>
    );
  },
);
