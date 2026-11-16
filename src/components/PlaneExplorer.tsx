import { Compass, Eye, EyeOff, Layers, SplitSquareHorizontal, Tag } from 'lucide-react';
import type { SectionDisplayMode } from '../geometry/buildPyramid';
import type { CameraPreset } from './GeometryViewer';

export interface PlaneExplorerProps {
  showBase: boolean;
  baseOpacity: number;
  showSection: boolean;
  sectionOpacity: number;
  sectionDisplayMode: SectionDisplayMode;
  comparisonMode: boolean;
  showPlaneLabels: boolean;
  isOrthoBaseActive: boolean;
  onToggleBase: () => void;
  onChangeBaseOpacity: (val: number) => void;
  onOnlyBase: () => void;
  onToggleOrthoBase: () => void;
  onToggleSection: () => void;
  onChangeSectionOpacity: (val: number) => void;
  onOnlySection: () => void;
  onChangeSectionDisplayMode: (mode: SectionDisplayMode) => void;
  onToggleComparisonMode: () => void;
  onTogglePlaneLabels: () => void;
  onSelectPreset: (preset: CameraPreset) => void;
}

export function PlaneExplorer({
  showBase,
  baseOpacity,
  showSection,
  sectionOpacity,
  sectionDisplayMode,
  comparisonMode,
  showPlaneLabels,
  isOrthoBaseActive,
  onToggleBase,
  onChangeBaseOpacity,
  onOnlyBase,
  onToggleOrthoBase,
  onToggleSection,
  onChangeSectionOpacity,
  onOnlySection,
  onChangeSectionDisplayMode,
  onToggleComparisonMode,
  onTogglePlaneLabels,
  onSelectPreset,
}: PlaneExplorerProps) {
  return (
    <div className="space-y-3" aria-label="Bảng điều khiển Khám phá hai mặt phẳng">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-[#064E3B]" aria-hidden="true" />
          <h2 className="text-sm font-extrabold text-[#064E3B]">KHÁM PHÁ HAI MẶT PHẲNG</h2>
        </div>

        <button
          type="button"
          onClick={onTogglePlaneLabels}
          aria-pressed={showPlaneLabels}
          className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition-colors ${
            showPlaneLabels
              ? 'bg-[#064E3B] text-[#FACC15]'
              : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Tag className="h-3 w-3" aria-hidden="true" />
          <span>Nhãn mặt phẳng</span>
        </button>
      </div>

      {/* 1. Mặt phẳng (ABCD) */}
      <section className="rounded-2xl border border-[#00CFC8]/60 bg-[#F0FDFA]/70 p-3.5 shadow-2xs">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className="h-3.5 w-3.5 rounded border border-[#2563EB] bg-[#00CFC8]"
              aria-hidden="true"
            />
            <h3 className="text-xs font-extrabold text-[#064E3B]">
              1. MẶT PHẲNG <span className="font-math">(ABCD)</span>
            </h3>
          </div>
          <button
            type="button"
            onClick={onToggleBase}
            aria-pressed={showBase}
            className={`inline-flex min-h-[32px] items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
              showBase
                ? 'bg-[#064E3B] text-white'
                : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {showBase ? <Eye className="h-3.5 w-3.5" aria-hidden="true" /> : <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />}
            <span>{showBase ? 'Đang bật' : 'Đang tắt'}</span>
          </button>
        </div>

        <label className="mt-2.5 flex flex-col gap-1 text-[11px] font-semibold text-slate-700">
          <div className="flex items-center justify-between">
            <span>Độ mờ mặt đáy (#00CFC8 · viền xanh dương)</span>
            <span className="font-math font-bold text-[#064E3B]">{Math.round(baseOpacity * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.05"
            max="0.85"
            step="0.05"
            value={baseOpacity}
            onChange={(e) => onChangeBaseOpacity(Number(e.target.value))}
            className="accent-[#00CFC8]"
          />
        </label>

        <div className="mt-2.5 grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={onOnlyBase}
            className="min-h-[36px] rounded-xl border border-[#2563EB]/30 bg-white px-2.5 py-1.5 text-[11px] font-bold text-[#1D4ED8] transition-colors hover:bg-blue-50"
          >
            Chỉ xem mặt đáy
          </button>
          <button
            type="button"
            onClick={onToggleOrthoBase}
            aria-pressed={isOrthoBaseActive}
            className={`inline-flex min-h-[36px] items-center justify-center gap-1 rounded-xl px-2.5 py-1.5 text-[11px] font-bold transition-colors ${
              isOrthoBaseActive
                ? 'bg-[#2563EB] text-white'
                : 'border border-[#064E3B]/25 bg-white text-[#064E3B] hover:bg-emerald-50'
            }`}
          >
            <Compass className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{isOrthoBaseActive ? 'Trở lại góc nhìn 3D' : 'Nhìn vuông góc đáy ABCD'}</span>
          </button>
        </div>
      </section>

      {/* 2. Mặt phẳng (MNP) */}
      <section className="rounded-2xl border border-[#FFB347]/70 bg-[#FFFBEB]/80 p-3.5 shadow-2xs">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className="h-3.5 w-3.5 rounded border border-[#EA580C] bg-[#FFB347]"
              aria-hidden="true"
            />
            <h3 className="text-xs font-extrabold text-[#9A3412]">
              2. MẶT PHẲNG <span className="font-math">(MNP)</span>
            </h3>
          </div>
          <button
            type="button"
            onClick={onToggleSection}
            aria-pressed={showSection}
            className={`inline-flex min-h-[32px] items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
              showSection
                ? 'bg-[#EA580C] text-white'
                : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {showSection ? <Eye className="h-3.5 w-3.5" aria-hidden="true" /> : <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />}
            <span>{showSection ? 'Đang bật' : 'Đang tắt'}</span>
          </button>
        </div>

        <div className="mt-2.5 grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => onChangeSectionDisplayMode('triangle')}
            aria-pressed={sectionDisplayMode === 'triangle'}
            className={`min-h-[36px] rounded-xl px-2 py-1.5 text-[11px] font-bold transition-colors ${
              sectionDisplayMode === 'triangle'
                ? 'bg-[#EA580C] text-white shadow-2xs'
                : 'border border-amber-300 bg-white text-amber-950 hover:bg-amber-50'
            }`}
          >
            A. Tam giác MNP
          </button>
          <button
            type="button"
            onClick={() => onChangeSectionDisplayMode('plane')}
            aria-pressed={sectionDisplayMode === 'plane'}
            className={`min-h-[36px] rounded-xl px-2 py-1.5 text-[11px] font-bold transition-colors ${
              sectionDisplayMode === 'plane'
                ? 'bg-[#EA580C] text-white shadow-2xs'
                : 'border border-amber-300 bg-white text-amber-950 hover:bg-amber-50'
            }`}
          >
            B. Mặt phẳng (MNP)
          </button>
        </div>

        <p className="mt-1.5 text-[11px] leading-relaxed text-amber-950/90">
          {sectionDisplayMode === 'triangle'
            ? 'Đang tô đúng miền tam giác MNP — chỉ là một phần nằm trong mặt phẳng (MNP).'
            : 'Đang mở rộng miền tứ giác đại diện trong mặt phẳng qua M, N, P để quan sát rõ quan hệ với đáy.'}
        </p>

        <label className="mt-2 flex flex-col gap-1 text-[11px] font-semibold text-slate-700">
          <div className="flex items-center justify-between">
            <span>Độ mờ (#FFB347 · viền cam đậm)</span>
            <span className="font-math font-bold text-[#9A3412]">{Math.round(sectionOpacity * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.05"
            max="0.85"
            step="0.05"
            value={sectionOpacity}
            onChange={(e) => onChangeSectionOpacity(Number(e.target.value))}
            className="accent-[#EA580C]"
          />
        </label>

        <button
          type="button"
          onClick={onOnlySection}
          className="mt-2 min-h-[36px] w-full rounded-xl border border-[#EA580C]/35 bg-white px-2.5 py-1.5 text-[11px] font-bold text-[#C2410C] transition-colors hover:bg-orange-50"
        >
          Chỉ xem mặt phẳng MNP
        </button>
      </section>

      {/* 3. Chế độ so sánh hai mặt phẳng */}
      <section className="rounded-2xl border border-[#064E3B]/20 bg-white p-3.5 shadow-2xs">
        <button
          type="button"
          onClick={onToggleComparisonMode}
          aria-pressed={comparisonMode}
          className={`inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-extrabold transition-colors ${
            comparisonMode
              ? 'bg-[#064E3B] text-[#FACC15] shadow-sm'
              : 'bg-[#064E3B]/10 text-[#064E3B] hover:bg-[#064E3B]/15'
          }`}
        >
          <SplitSquareHorizontal className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{comparisonMode ? 'ĐANG BẬT: SO SÁNH HAI MẶT PHẲNG' : 'SO SÁNH HAI MẶT PHẲNG'}</span>
        </button>

        {comparisonMode && (
          <div className="mt-2.5 space-y-2 rounded-xl bg-[#F3FAFC] p-2.5 text-[11px] text-slate-700">
            <p className="leading-relaxed">
              Hai mặt phẳng <strong className="text-[#064E3B]">(ABCD)</strong> (xanh ngọc) và{' '}
              <strong className="text-[#9A3412]">(MNP)</strong> (cam vàng) cùng hiển thị kèm các cặp đoạn tương ứng{' '}
              <span className="font-math font-bold text-[#0284C7]">MN ↔ AB</span> và{' '}
              <span className="font-math font-bold text-[#059669]">NP ↔ BC</span>.
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => onSelectPreset('side')}
                className="min-h-[32px] rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
              >
                Nhìn từ bên
              </button>
              <button
                type="button"
                onClick={() => onSelectPreset('top')}
                className="min-h-[32px] rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
              >
                Nhìn từ trên
              </button>
              <button
                type="button"
                onClick={() => onSelectPreset('default')}
                className="min-h-[32px] rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
              >
                Góc xiên 3D
              </button>
            </div>
            <p className="text-[11px] italic text-slate-600">
              Hãy tự xoay mô hình để nhận xét vị trí tương đối giữa hai mặt phẳng trước khi xem kết luận ở tab Khám phá.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
