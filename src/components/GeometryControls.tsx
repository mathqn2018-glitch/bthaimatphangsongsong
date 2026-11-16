import { useState } from 'react';
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Compass,
  Eye,
  EyeOff,
  Grid3X3,
  Layers,
  Maximize2,
  Minimize2,
  Pause,
  RotateCcw,
  RotateCw,
  ScanEye,
  Smartphone,
  Sparkles,
  Tag,
} from 'lucide-react';
import type { CameraPreset } from './GeometryViewer';

export interface GeometryControlsProps {
  showBase: boolean;
  showSection: boolean;
  showLabels: boolean;
  showGrid: boolean;
  autoRotate: boolean;
  autoHiddenLines: boolean;
  showHiddenEdges: boolean;
  isOrthoBaseActive: boolean;
  isFullscreen: boolean;
  wowActive: boolean;
  onToggleBase: () => void;
  onToggleSection: () => void;
  onToggleLabels: () => void;
  onToggleGrid: () => void;
  onToggleAutoRotate: () => void;
  onToggleAutoHiddenLines: () => void;
  onToggleHiddenEdges: () => void;
  onToggleOrthoBase: () => void;
  onSelectPreset: (preset: CameraPreset) => void;
  onStartWowAnimation: () => void;
  onCaptureSnapshot: () => void;
  onToggleFullscreen: () => void;
  onOpenAR: () => void;
}

export function GeometryControls({
  showBase,
  showSection,
  showLabels,
  showGrid,
  autoRotate,
  autoHiddenLines,
  showHiddenEdges,
  isOrthoBaseActive,
  isFullscreen,
  wowActive,
  onToggleBase,
  onToggleSection,
  onToggleLabels,
  onToggleGrid,
  onToggleAutoRotate,
  onToggleAutoHiddenLines,
  onToggleHiddenEdges,
  onToggleOrthoBase,
  onSelectPreset,
  onStartWowAnimation,
  onCaptureSnapshot,
  onToggleFullscreen,
  onOpenAR,
}: GeometryControlsProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center px-2.5 pb-[max(10px,env(safe-area-inset-bottom))]">
      <div className="pointer-events-auto flex max-w-full flex-col items-center">
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          aria-expanded={!collapsed}
          title={collapsed ? 'Mở bảng điều khiển 3D' : 'Thu gọn bảng điều khiển'}
          className="mb-1 inline-flex min-h-[30px] items-center gap-1.5 rounded-t-xl rounded-b-md border border-[#064E3B]/20 bg-white px-3 py-1 text-xs font-semibold text-[#064E3B] shadow-sm transition-colors hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-[#064E3B]"
        >
          {collapsed ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Bảng điều khiển 3D</span>
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Thu gọn thanh công cụ</span>
            </>
          )}
        </button>

        {!collapsed && (
          <div
            className="flex max-w-full flex-col gap-1.5 rounded-2xl border border-[#064E3B]/15 bg-white/95 p-2 shadow-lg backdrop-blur-xs"
            role="toolbar"
            aria-label="Bảng điều khiển góc nhìn thông minh và lớp hiển thị"
          >
            {/* Row 1: 4 Smart Views + Reset + WOW Animation + Capture + Fullscreen + AR */}
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
              <button
                type="button"
                onClick={() => onSelectPreset('default')}
                title="Góc nhìn ban đầu"
                className="inline-flex min-h-[36px] shrink-0 items-center gap-1 rounded-xl bg-slate-50 px-2.5 py-1.5 text-xs font-bold whitespace-nowrap text-slate-800 ring-1 ring-slate-200 transition-colors hover:bg-slate-100"
              >
                <RotateCcw className="h-3.5 w-3.5 shrink-0 text-[#064E3B]" aria-hidden="true" />
                <span>Góc nhìn ban đầu</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectPreset('top')}
                title="Nhìn từ trên xuống"
                className="inline-flex min-h-[36px] shrink-0 items-center rounded-xl bg-slate-50 px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap text-slate-700 transition-colors hover:bg-slate-100"
              >
                Nhìn từ trên
              </button>

              <button
                type="button"
                onClick={() => onSelectPreset('side')}
                title="Nhìn từ bên để quan sát (MNP) và (ABCD)"
                className="inline-flex min-h-[36px] shrink-0 items-center rounded-xl bg-slate-50 px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap text-slate-700 transition-colors hover:bg-slate-100"
              >
                Nhìn từ bên
              </button>

              <button
                type="button"
                onClick={onToggleOrthoBase}
                aria-pressed={isOrthoBaseActive}
                title="Chuyển phép chiếu trực giao nhìn vuông góc mặt đáy ABCD không biến dạng phối cảnh"
                className={`inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold whitespace-nowrap transition-colors ${
                  isOrthoBaseActive
                    ? 'bg-[#2563EB] text-white shadow-xs'
                    : 'bg-blue-50 text-[#1D4ED8] ring-1 ring-blue-200 hover:bg-blue-100'
                }`}
              >
                <Compass className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>
                  {isOrthoBaseActive ? 'Trở lại góc nhìn 3D' : 'Nhìn vuông góc đáy ABCD'}
                </span>
              </button>

              <button
                type="button"
                onClick={onStartWowAnimation}
                aria-pressed={wowActive}
                title="Chạy hoạt hình 16 giây khám phá định lí (MNP) // (ABCD)"
                className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#064E3B] to-[#0B6B52] px-3 py-1.5 text-xs font-extrabold whitespace-nowrap text-[#FACC15] shadow-xs transition-opacity hover:opacity-95"
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>Khám phá điều kỳ diệu</span>
              </button>

              <div className="mx-0.5 h-5 w-px shrink-0 bg-slate-200" aria-hidden="true" />

              <button
                type="button"
                onClick={onToggleAutoRotate}
                aria-pressed={autoRotate}
                title="Bật hoặc tắt tự động xoay 3D"
                className={`inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                  autoRotate
                    ? 'bg-[#064E3B] text-white'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {autoRotate ? (
                  <Pause className="h-3.5 w-3.5 shrink-0 text-[#FACC15]" aria-hidden="true" />
                ) : (
                  <RotateCw className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                )}
                <span>Xoay 3D</span>
              </button>

              <button
                type="button"
                onClick={onCaptureSnapshot}
                title="Chụp ảnh mô hình 3D kèm nhãn đỉnh"
                className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-xl bg-slate-50 px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap text-slate-700 transition-colors hover:bg-slate-100"
              >
                <Camera className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>Chụp ảnh</span>
              </button>

              <button
                type="button"
                onClick={onToggleFullscreen}
                title={isFullscreen ? 'Thu nhỏ màn hình' : 'Xem toàn màn hình'}
                className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-xl bg-slate-50 px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap text-slate-700 transition-colors hover:bg-slate-100"
              >
                {isFullscreen ? (
                  <Minimize2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                ) : (
                  <Maximize2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                )}
                <span>{isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}</span>
              </button>

              <button
                type="button"
                onClick={onOpenAR}
                title="Mở chế độ Thực tế tăng cường (AR) trên điện thoại"
                className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-xl bg-[#FACC15] px-3 py-1.5 text-xs font-extrabold whitespace-nowrap text-[#064E3B] transition-colors hover:bg-yellow-300"
              >
                <Smartphone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>Xem AR</span>
              </button>
            </div>

            {/* Row 2: Layer & Edge Visibility Toggles */}
            <div className="flex items-center gap-1 overflow-x-auto border-t border-slate-100 pt-1.5">
              <button
                type="button"
                onClick={onToggleBase}
                aria-pressed={showBase}
                title="Bật hoặc tắt mặt đáy ABCD (#00CFC8)"
                className={`inline-flex min-h-[34px] shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-colors ${
                  showBase
                    ? 'bg-[#00CFC8]/25 text-[#064E3B] ring-1 ring-[#00CFC8]'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Layers className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>Mặt đáy ABCD</span>
              </button>

              <button
                type="button"
                onClick={onToggleSection}
                aria-pressed={showSection}
                title="Bật hoặc tắt mặt phẳng (MNP)"
                className={`inline-flex min-h-[34px] shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-colors ${
                  showSection
                    ? 'bg-[#FFB347]/30 text-[#9A3412] ring-1 ring-[#EA580C]'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {showSection ? (
                  <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                ) : (
                  <EyeOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                )}
                <span>Mặt phẳng (MNP)</span>
              </button>

              <button
                type="button"
                onClick={onToggleLabels}
                aria-pressed={showLabels}
                title="Hiện hoặc ẩn nhãn các đỉnh S, A, B, C, D, M, N, P"
                className={`inline-flex min-h-[34px] shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-colors ${
                  showLabels
                    ? 'bg-[#2563EB] text-white'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Tag className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>Nhãn đỉnh</span>
              </button>

              <button
                type="button"
                onClick={onToggleAutoHiddenLines}
                aria-pressed={autoHiddenLines}
                title="Tự động nét thấy – nét khuất theo góc nhìn"
                className={`inline-flex min-h-[34px] shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-colors ${
                  autoHiddenLines
                    ? 'bg-[#064E3B] text-white'
                    : 'bg-amber-100 text-amber-900 ring-1 ring-amber-300'
                }`}
              >
                <ScanEye className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>
                  {autoHiddenLines ? 'Nét thấy – khuất: Tự động' : 'Nét thấy – khuất: Tắt'}
                </span>
              </button>

              {autoHiddenLines && (
                <button
                  type="button"
                  onClick={onToggleHiddenEdges}
                  aria-pressed={showHiddenEdges}
                  title="Hiện hoặc ẩn các nét đứt bị khuất"
                  className={`inline-flex min-h-[34px] shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-colors ${
                    showHiddenEdges
                      ? 'bg-blue-50 text-[#2563EB] ring-1 ring-blue-200'
                      : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  <span>{showHiddenEdges ? 'Nét khuất: Hiện' : 'Nét khuất: Ẩn'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={onToggleGrid}
                aria-pressed={showGrid}
                title="Bật hoặc tắt lưới tham chiếu"
                className={`inline-flex min-h-[34px] shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-colors ${
                  showGrid
                    ? 'bg-emerald-50 text-[#064E3B] ring-1 ring-emerald-200'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Grid3X3 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>Lưới</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
