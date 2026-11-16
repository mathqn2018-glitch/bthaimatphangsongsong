import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Download,
  Smartphone,
  X,
} from 'lucide-react';
import type { ParsedGeometry } from '../geometry/parseGeometry';
import { buildExportablePyramidGroup } from '../geometry/buildPyramid';

export interface ARSupportState {
  checked: boolean;
  isSecureContext: boolean;
  webxrSupported: boolean;
  quickLookSupported: boolean;
  isIOS: boolean;
  reason: string | null;
}

export interface ARViewerProps {
  isOpen: boolean;
  isWebXRActive: boolean;
  geometry: ParsedGeometry;
  showBase: boolean;
  showSection: boolean;
  onClose: () => void;
  onStartWebXR: (overlayElement: HTMLElement) => Promise<void>;
  onStopWebXR: () => Promise<void>;
  onUpdateARTransform: (scaleMultiplier: number, rotationYDeg: number) => void;
  arError: string | null;
}

function createQuickLookThumbnailDataUrl(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#F3FAFC';
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = '#2563EB';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(64, 20);
    ctx.lineTo(24, 92);
    ctx.lineTo(86, 102);
    ctx.lineTo(106, 76);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(64, 20);
    ctx.lineTo(86, 102);
    ctx.moveTo(64, 20);
    ctx.lineTo(106, 76);
    ctx.stroke();
  }
  return canvas.toDataURL('image/png');
}

export function ARViewer({
  isOpen,
  isWebXRActive,
  geometry,
  showBase,
  showSection,
  onClose,
  onStartWebXR,
  onStopWebXR,
  onUpdateARTransform,
  arError,
}: ARViewerProps) {
  const [support, setSupport] = useState<ARSupportState>({
    checked: false,
    isSecureContext: typeof window !== 'undefined' ? window.isSecureContext : false,
    webxrSupported: false,
    quickLookSupported: false,
    isIOS: false,
    reason: null,
  });
  const [usdzUrl, setUsdzUrl] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [isStartingXR, setIsStartingXR] = useState(false);

  const [arScale, setArScale] = useState(1);
  const [arRotation, setArRotation] = useState(0);

  const xrOverlayRef = useRef<HTMLDivElement | null>(null);
  const quickLookThumb = useMemo(() => createQuickLookThumbnailDataUrl(), []);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    async function detectCapabilities() {
      const isSecure = window.isSecureContext;
      const ua = navigator.userAgent || '';
      const isIOSDevice =
        /iPad|iPhone|iPod/.test(ua) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

      const anchor = document.createElement('a');
      const quickLook = Boolean(
        isIOSDevice && anchor.relList && anchor.relList.supports && anchor.relList.supports('ar'),
      );

      let webxr = false;
      let reason: string | null = null;

      if (!isSecure) {
        reason =
          'AR yêu cầu kết nối bảo mật HTTPS. Thiết bị hiện tại chưa hỗ trợ AR qua HTTP thường. Bạn vẫn có thể xem và xoay mô hình 3D.';
      } else if (!isIOSDevice && 'xr' in navigator && navigator.xr) {
        try {
          webxr = await navigator.xr.isSessionSupported('immersive-ar');
          if (!webxr) {
            reason =
              'Thiết bị hiện tại chưa hỗ trợ AR. Bạn vẫn có thể xem và xoay mô hình 3D.';
          }
        } catch {
          webxr = false;
          reason =
            'Thiết bị hiện tại chưa hỗ trợ AR. Bạn vẫn có thể xem và xoay mô hình 3D.';
        }
      } else if (isIOSDevice && !quickLook) {
        reason =
          'Trình duyệt iOS hiện tại chưa bật Apple AR Quick Look (hãy mở bằng Safari). Bạn vẫn có thể xem và xoay mô hình 3D.';
      } else if (!quickLook) {
        reason =
          'Thiết bị hiện tại chưa hỗ trợ AR. Bạn vẫn có thể xem và xoay mô hình 3D.';
      }

      if (!cancelled) {
        setSupport({
          checked: true,
          isSecureContext: isSecure,
          webxrSupported: webxr,
          quickLookSupported: quickLook,
          isIOS: isIOSDevice,
          reason,
        });
      }
    }

    detectCapabilities();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !support.quickLookSupported) {
      return;
    }

    let revoked = false;
    let createdUrl: string | null = null;

    async function prepareUSDZ() {
      setIsExporting(true);
      try {
        const { group, dispose } = buildExportablePyramidGroup(geometry, {
          showBase,
          showSection,
          targetScaleMeters: 0.08,
        });
        const { USDZExporter } = await import('three/examples/jsm/exporters/USDZExporter.js');
        const exporter = new USDZExporter();
        const arrayBuffer = await exporter.parseAsync(group);
        dispose();

        if (!revoked) {
          const blob = new Blob([arrayBuffer], { type: 'model/vnd.usdz+zip' });
          createdUrl = URL.createObjectURL(blob);
          setUsdzUrl(createdUrl);
        }
      } catch {
        if (!revoked) {
          setExportMessage('Không tạo được tệp USDZ hợp lệ cho Quick Look trên thiết bị này.');
        }
      } finally {
        if (!revoked) {
          setIsExporting(false);
        }
      }
    }

    prepareUSDZ();

    return () => {
      revoked = true;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
      setUsdzUrl(null);
    };
  }, [isOpen, support.quickLookSupported, geometry, showBase, showSection]);

  async function handleDownloadGLB() {
    setIsExporting(true);
    setExportMessage(null);
    try {
      const { group, dispose } = buildExportablePyramidGroup(geometry, {
        showBase,
        showSection,
        targetScaleMeters: 0.08,
      });
      const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
      const exporter = new GLTFExporter();
      const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        exporter.parse(
          group,
          (result) => {
            if (result instanceof ArrayBuffer) {
              resolve(result);
            } else {
              reject(new Error('GLTFExporter did not return binary GLB.'));
            }
          },
          (err) => reject(err),
          { binary: true },
        );
      });
      dispose();

      const blob = new Blob([buffer], { type: 'model/gltf-binary' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Hinh_chop_SABCD_MNP.glb';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setExportMessage('Đã tải xuống mô hình 3D (.glb).');
    } catch {
      setExportMessage('Không thể xuất tệp .glb từ mô hình hiện tại.');
    } finally {
      setIsExporting(false);
    }
  }

  async function handleLaunchWebXR() {
    if (!xrOverlayRef.current) return;
    setIsStartingXR(true);
    setArScale(1);
    setArRotation(0);
    try {
      await onStartWebXR(xrOverlayRef.current);
    } finally {
      setIsStartingXR(false);
    }
  }

  if (!isOpen && !isWebXRActive) {
    return null;
  }

  return (
    <>
      <div
        ref={xrOverlayRef}
        className={
          isWebXRActive
            ? 'fixed inset-0 z-50 flex flex-col justify-between p-4 pointer-events-none'
            : 'hidden'
        }
      >
        {isWebXRActive && (
          <>
            <div className="pointer-events-auto flex items-center justify-between gap-3 rounded-2xl border border-[#FACC15]/40 bg-[#064E3B]/95 px-4 py-3 text-white shadow-lg">
              <div className="text-xs sm:text-sm">
                <p className="font-bold text-[#FACC15]">Chế độ AR đang hoạt động</p>
                <p className="text-emerald-100">
                  Hướng camera xuống mặt bàn và chạm màn hình để đặt hình chóp.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void onStopWebXR()}
                className="min-h-[40px] shrink-0 rounded-xl bg-[#FACC15] px-3.5 py-2 text-xs font-bold text-[#064E3B] hover:bg-yellow-300"
              >
                Thoát AR
              </button>
            </div>

            <div className="pointer-events-auto mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white/95 p-3.5 shadow-xl">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-xs font-semibold text-slate-700">
                  <span>Kích thước mô hình: {Math.round(arScale * 100)}%</span>
                  <input
                    type="range"
                    min="0.5"
                    max="1.8"
                    step="0.1"
                    value={arScale}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setArScale(val);
                      onUpdateARTransform(val, arRotation);
                    }}
                    className="accent-[#064E3B]"
                  />
                </label>

                <label className="flex flex-col gap-1 text-xs font-semibold text-slate-700">
                  <span>Góc xoay: {arRotation}°</span>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    step="15"
                    value={arRotation}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setArRotation(val);
                      onUpdateARTransform(arScale, val);
                    }}
                    className="accent-[#2563EB]"
                  />
                </label>
              </div>
            </div>
          </>
        )}
      </div>

      {isOpen && !isWebXRActive && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/50 p-3 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ar-dialog-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#064E3B]/20 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="ar-dialog-title" className="text-base font-bold text-[#064E3B] sm:text-lg">
                  Thực tế tăng cường (AR)
                </h2>
                <p className="mt-0.5 text-xs text-slate-600">
                  Đặt mô hình hình chóp <span className="font-math font-semibold">S.ABCD</span> trên mặt bàn bằng camera thiết bị.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Đóng hộp thoại AR"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {!support.checked ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600">
                  Đang kiểm tra khả năng AR của thiết bị và trình duyệt...
                </div>
              ) : (
                <>
                  {support.webxrSupported && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5">
                      <div className="flex items-start gap-2.5">
                        <CheckCircle2
                          className="mt-0.5 h-4 w-4 shrink-0 text-[#064E3B]"
                          aria-hidden="true"
                        />
                        <div className="text-xs text-emerald-950">
                          <p className="font-semibold">Android / WebXR AR sẵn sàng</p>
                          <p className="mt-0.5 text-emerald-800">
                            Cho phép đặt mô hình trên mặt bàn, phóng to/thu nhỏ và xoay trực tiếp trong không gian thực.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={isStartingXR}
                        onClick={() => void handleLaunchWebXR()}
                        className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#064E3B] px-4 py-2.5 text-sm font-semibold text-[#FACC15] transition-colors hover:bg-[#053D2E] disabled:opacity-60"
                      >
                        <Camera className="h-4 w-4" aria-hidden="true" />
                        <span>{isStartingXR ? 'Đang khởi chạy WebXR...' : 'Bắt đầu AR (WebXR)'}</span>
                      </button>
                    </div>
                  )}

                  {support.quickLookSupported && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-3.5">
                      <div className="flex items-start gap-2.5">
                        <Smartphone
                          className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB]"
                          aria-hidden="true"
                        />
                        <div className="text-xs text-blue-950">
                          <p className="font-semibold">iPhone / iPad Apple AR Quick Look</p>
                          <p className="mt-0.5 text-blue-800">
                            Mở tệp USDZ thực tế trên Safari để đặt mô hình <span className="font-math">S.ABCD</span> lên mặt bàn.
                          </p>
                        </div>
                      </div>
                      {usdzUrl ? (
                        <a
                          rel="ar"
                          href={usdzUrl}
                          download="Hinh_chop_SABCD_MNP.usdz"
                          className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                        >
                          <img
                            src={quickLookThumb}
                            alt=""
                            className="h-5 w-5 rounded bg-white object-contain"
                          />
                          <span>Mở AR trên iPhone / iPad</span>
                        </a>
                      ) : (
                        <div className="mt-3 rounded-xl bg-white/80 px-3 py-2 text-center text-xs font-medium text-blue-900">
                          {isExporting ? 'Đang xuất tệp USDZ...' : 'Đang khởi tạo Quick Look...'}
                        </div>
                      )}
                    </div>
                  )}

                  {!support.webxrSupported && !support.quickLookSupported && support.reason && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-950">
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle
                          className="mt-0.5 h-4 w-4 shrink-0 text-amber-700"
                          aria-hidden="true"
                        />
                        <div className="space-y-1">
                          <p className="font-semibold">Thông báo hỗ trợ AR</p>
                          <p className="leading-relaxed text-amber-900">{support.reason}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {arError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-900">
                      {arError}
                    </div>
                  )}

                  <div className="border-t border-slate-100 pt-3">
                    <button
                      type="button"
                      disabled={isExporting}
                      onClick={() => void handleDownloadGLB()}
                      className="inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:opacity-60"
                    >
                      <Download className="h-4 w-4" aria-hidden="true" />
                      <span>Tải tệp mô hình 3D (.GLB)</span>
                    </button>
                    {exportMessage && (
                      <p className="mt-2 text-center text-xs text-slate-600">{exportMessage}</p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
