import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Compass,
  Eye,
  EyeOff,
  GraduationCap,
  HelpCircle,
  Layers,
  Lightbulb,
  Maximize2,
  PencilRuler,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import type { HighlightPairMode, SectionDisplayMode } from '../geometry/buildPyramid';
import {
  computeParallelogramCheck,
  type MathVerificationReport,
  type ParallelogramCheckResult,
  type ParsedEdge,
  type ParsedGeometry,
} from '../geometry/parseGeometry';
import type {
  EdgeOcclusionDetail,
  EdgeVisibilityClassification,
} from '../geometry/visibility';
import { DesignerChallengePanel } from './DesignerChallengePanel';
import type { CameraPreset } from './GeometryViewer';
import { PlaneExplorer } from './PlaneExplorer';

export type StudioMode = 'student' | 'teacher';
export type LabTab = 'discovery' | 'planes' | 'designer';

export interface ChallengePanelProps {
  mode: StudioMode;
  activeTab: LabTab;
  onModeChange: (mode: StudioMode) => void;
  onTabChange: (tab: LabTab) => void;
  progressiveSectionStep: number;
  onProgressiveStepChange: (step: number) => void;
  onResetView: () => void;
  onToggleOrthoBase: () => void;
  onToggleFullscreen: () => void;
  onSelectPreset: (preset: CameraPreset) => void;
  onStartWowAnimation: () => void;
  geometry: ParsedGeometry | null;
  mathReport: MathVerificationReport;

  // Step 2 & Step 3 3D highlights
  selectedMidpoint: 'M' | 'N' | 'P' | null;
  onSelectMidpoint: (id: 'M' | 'N' | 'P' | null) => void;
  highlightPair: HighlightPairMode;
  onChangeHighlightPair: (pair: HighlightPairMode) => void;

  // Plane Explorer props
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
  onToggleSection: () => void;
  onChangeSectionOpacity: (val: number) => void;
  onOnlySection: () => void;
  onChangeSectionDisplayMode: (mode: SectionDisplayMode) => void;
  onToggleComparisonMode: () => void;
  onTogglePlaneLabels: () => void;

  // Designer Challenge props
  designerActive: boolean;
  designerChecked: boolean;
  edges: ParsedEdge[];
  designerPredictions: Record<string, EdgeVisibilityClassification>;
  designerOcclusionResults: Record<string, EdgeOcclusionDetail> | null;
  onStartDesigner: () => void;
  onExitDesigner: () => void;
  onCycleEdgePrediction: (edgeId: string) => void;
  onSetEdgePrediction: (edgeId: string, cls: EdgeVisibilityClassification) => void;
  onCheckDesigner: () => void;
  onResetDesigner: () => void;
}

const MIDPOINT_INFO: Record<'M' | 'N' | 'P', { edge: string; detail: string }> = {
  M: { edge: 'SA', detail: 'M = (S + A)/2 là trung điểm của cạnh bên SA.' },
  N: { edge: 'SB', detail: 'N = (S + B)/2 là trung điểm của cạnh bên SB.' },
  P: { edge: 'SC', detail: 'P = (S + C)/2 là trung điểm của cạnh bên SC.' },
};

function normalizeSegmentInput(val: string): string {
  return val.trim().toUpperCase().replace(/[^A-Z]/g, '');
}

export function ChallengePanel({
  mode,
  activeTab,
  onModeChange,
  onTabChange,
  progressiveSectionStep,
  onProgressiveStepChange,
  onResetView,
  onToggleOrthoBase,
  onToggleFullscreen,
  onSelectPreset,
  onStartWowAnimation,
  geometry,
  mathReport,
  selectedMidpoint,
  onSelectMidpoint,
  highlightPair,
  onChangeHighlightPair,
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
  onToggleSection,
  onChangeSectionOpacity,
  onOnlySection,
  onChangeSectionDisplayMode,
  onToggleComparisonMode,
  onTogglePlaneLabels,
  designerActive,
  designerChecked,
  edges,
  designerPredictions,
  designerOcclusionResults,
  onStartDesigner,
  onExitDesigner,
  onCycleEdgePrediction,
  onSetEdgePrediction,
  onCheckDesigner,
  onResetDesigner,
}: ChallengePanelProps) {
  // Step 1: Quan sát đáy ABCD
  const [baseShapeChoice, setBaseShapeChoice] = useState<string | null>(null);

  // Step 3: Tìm căn cứ song song
  const [answerMN, setAnswerMN] = useState('');
  const [answerNP, setAnswerNP] = useState('');
  const [step3Submitted, setStep3Submitted] = useState(false);

  // Step 4: 3 questions + Kết luận (only revealed after clicking "Xem lời giải")
  const [qIntersect, setQIntersect] = useState<'yes' | 'no' | null>(null);
  const [qPlane, setQPlane] = useState<'MNP' | 'ABCD' | null>(null);
  const [qParallelBase, setQParallelBase] = useState<'yes' | 'no' | null>(null);
  const [step4Checked, setStep4Checked] = useState(false);
  const [revealedHints, setRevealedHints] = useState<number>(0);
  const [showSolution, setShowSolution] = useState(false);

  // Teacher mode & automated 10-check readout
  const [teacherShowAnswers, setTeacherShowAnswers] = useState(false);
  const [showMathCheck, setShowMathCheck] = useState(false);
  const [parallelogramCheck, setParallelogramCheck] = useState<ParallelogramCheckResult | null>(null);
  const [parallelogramCheckMissingError, setParallelogramCheckMissingError] = useState(false);

  const handleRunParallelogramCheck = () => {
    if (!geometry) {
      setParallelogramCheck(null);
      setParallelogramCheckMissingError(true);
      return;
    }
    setParallelogramCheckMissingError(false);
    setParallelogramCheck(computeParallelogramCheck(geometry));
  };

  const normMN = normalizeSegmentInput(answerMN);
  const normNP = normalizeSegmentInput(answerNP);
  const isMNCorrect = normMN === 'AB' || normMN === 'BA';
  const isNPCorrect = normNP === 'BC' || normNP === 'CB';

  const isStep4QuestionsCorrect =
    qIntersect === 'yes' && qPlane === 'MNP' && qParallelBase === 'yes';

  const effectiveShowAnswers = mode === 'teacher' ? teacherShowAnswers : showSolution;

  const hints = [
    'Trong ΔSAB, M và N là trung điểm của SA, SB nên MN là đường trung bình ⇒ MN // AB.',
    'Trong ΔSBC, N và P là trung điểm của SB, SC nên NP là đường trung bình ⇒ NP // BC.',
    'Trong mặt phẳng (MNP), hai đường thẳng MN và NP cắt nhau tại N.',
    'Vì MN // (ABCD) và NP // (ABCD), suy ra (MNP) // (ABCD).',
  ];

  return (
    <aside
      className="flex flex-col gap-3 bg-white p-4 sm:p-5 lg:h-full lg:overflow-y-auto lg:border-l lg:border-[#064E3B]/15"
      aria-label="Phòng thí nghiệm hình học không gian tương tác"
    >
      {/* Mode Switcher: Học sinh / Giáo viên */}
      <div className="rounded-2xl border border-[#064E3B]/15 bg-[#F3FAFC] p-1">
        <div className="grid grid-cols-2 gap-1" role="tablist" aria-label="Chọn vai trò sử dụng">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'student'}
            onClick={() => onModeChange('student')}
            className={`inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold transition-colors ${
              mode === 'student'
                ? 'bg-[#064E3B] text-white shadow-xs'
                : 'text-slate-700 hover:bg-white/70'
            }`}
          >
            <UserCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Học sinh</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={mode === 'teacher'}
            onClick={() => onModeChange('teacher')}
            className={`inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold transition-colors ${
              mode === 'teacher'
                ? 'bg-[#064E3B] text-[#FACC15] shadow-xs'
                : 'text-slate-700 hover:bg-white/70'
            }`}
          >
            <GraduationCap className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Giáo viên</span>
          </button>
        </div>
      </div>

      {/* 3-Tab Lab Navigation */}
      <div className="grid grid-cols-3 gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1">
        <button
          type="button"
          onClick={() => onTabChange('discovery')}
          className={`inline-flex min-h-[36px] items-center justify-center gap-1 rounded-xl px-2 py-1.5 text-[11px] font-bold transition-colors ${
            activeTab === 'discovery'
              ? 'bg-[#2563EB] text-white shadow-xs'
              : 'text-slate-700 hover:bg-white'
          }`}
        >
          <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Khám phá</span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange('planes')}
          className={`inline-flex min-h-[36px] items-center justify-center gap-1 rounded-xl px-2 py-1.5 text-[11px] font-bold transition-colors ${
            activeTab === 'planes'
              ? 'bg-[#064E3B] text-[#FACC15] shadow-xs'
              : 'text-slate-700 hover:bg-white'
          }`}
        >
          <Layers className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Hai mặt phẳng</span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange('designer')}
          className={`inline-flex min-h-[36px] items-center justify-center gap-1 rounded-xl px-2 py-1.5 text-[11px] font-bold transition-colors ${
            activeTab === 'designer'
              ? 'bg-[#EA580C] text-white shadow-xs'
              : 'text-slate-700 hover:bg-white'
          }`}
        >
          <PencilRuler className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Thiết kế nét</span>
        </button>
      </div>

      {/* Teacher Mode Classroom Presentation Card */}
      {mode === 'teacher' && (
        <section
          className="rounded-2xl border border-[#064E3B]/25 bg-gradient-to-br from-[#064E3B] to-[#08634B] p-3.5 text-white shadow-sm"
          aria-label="Bảng điều khiển giảng dạy"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-bold text-[#FACC15]">Điều khiển giảng dạy lớp học</h2>
            <button
              type="button"
              onClick={() => setTeacherShowAnswers((prev) => !prev)}
              className="inline-flex items-center gap-1 rounded-lg bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-white/25"
            >
              {teacherShowAnswers ? (
                <>
                  <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Ẩn đáp án</span>
                </>
              ) : (
                <>
                  <Eye className="h-3.5 w-3.5 text-[#FACC15]" aria-hidden="true" />
                  <span>Hiện đáp án</span>
                </>
              )}
            </button>
          </div>

          <div className="mt-2.5">
            <p className="text-[11px] font-medium text-emerald-100">
              Hiển thị từng đoạn của <span className="font-math">(MNP)</span>:
            </p>
            <div className="mt-1.5 grid grid-cols-4 gap-1">
              {[
                { step: 0, label: 'Chưa nối' },
                { step: 1, label: 'Đoạn MN' },
                { step: 2, label: 'MN, NP' },
                { step: 3, label: 'Đủ MNP' },
              ].map((item) => (
                <button
                  key={item.step}
                  type="button"
                  onClick={() => onProgressiveStepChange(item.step)}
                  className={`min-h-[32px] rounded-lg px-1.5 py-1 text-[11px] font-bold transition-colors ${
                    progressiveSectionStep === item.step
                      ? 'bg-[#FACC15] text-[#064E3B]'
                      : 'bg-white/10 text-emerald-50 hover:bg-white/20'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-2.5 flex gap-1.5 border-t border-white/15 pt-2.5">
            <button
              type="button"
              onClick={onStartWowAnimation}
              className="inline-flex min-h-[34px] flex-1 items-center justify-center gap-1 rounded-xl bg-[#FACC15] px-2.5 py-1 text-[11px] font-extrabold text-[#064E3B] hover:bg-yellow-300"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Hoạt hình định lí</span>
            </button>
            <button
              type="button"
              onClick={onToggleFullscreen}
              className="inline-flex min-h-[34px] items-center justify-center gap-1 rounded-xl bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-white/25"
            >
              <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Chiếu</span>
            </button>
            <button
              type="button"
              onClick={onResetView}
              className="inline-flex min-h-[34px] items-center justify-center gap-1 rounded-xl bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-white/25"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </section>
      )}

      {/* TAB 1: 4-STEP DISCOVERY */}
      {activeTab === 'discovery' && (
        <section
          className="rounded-2xl border border-slate-200 bg-[#F3FAFC]/65 p-3.5"
          aria-labelledby="challenge-heading"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 id="challenge-heading" className="text-sm font-extrabold tracking-tight text-[#064E3B]">
              KHÁM PHÁ TỪNG BƯỚC
            </h2>
            <span className="font-math text-[11px] font-semibold text-[#2563EB]">
              Bài 13 · Toán 11
            </span>
          </div>

          <p className="mt-1.5 text-xs leading-relaxed text-slate-700">
            Cho hình chóp <span className="font-math font-semibold">S.ABCD</span> có đáy{' '}
            <span className="font-math font-semibold">ABCD</span> là hình bình hành;{' '}
            <span className="font-math font-semibold text-[#EA580C]">M, N, P</span> lần lượt là trung điểm của{' '}
            <span className="font-math font-semibold">SA, SB, SC</span>. Chứng minh{' '}
            <span className="font-math font-semibold text-[#9A3412]">(MNP) // (ABCD)</span>.
          </p>

          {/* BƯỚC 1: QUAN SÁT */}
          <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-extrabold text-[#064E3B]">BƯỚC 1: QUAN SÁT</span>
              <button
                type="button"
                onClick={onToggleOrthoBase}
                aria-pressed={isOrthoBaseActive}
                className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition-colors ${
                  isOrthoBaseActive
                    ? 'bg-[#2563EB] text-white'
                    : 'bg-blue-50 text-[#1D4ED8] hover:bg-blue-100'
                }`}
              >
                <Compass className="h-3 w-3" aria-hidden="true" />
                <span>{isOrthoBaseActive ? 'Trở lại góc nhìn 3D' : 'Nhìn vuông góc đáy ABCD'}</span>
              </button>
            </div>
            <p className="mt-1.5 text-xs font-semibold text-slate-800">
              “Em nhận xét gì về hình dạng của đáy ABCD?”
            </p>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {[
                { id: 'trapezoid', label: 'Hình thang' },
                { id: 'parallelogram', label: 'Hình bình hành' },
                { id: 'triangle', label: 'Tam giác' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setBaseShapeChoice(opt.id)}
                  className={`min-h-[34px] rounded-xl px-2 py-1 text-[11px] font-bold transition-colors ${
                    baseShapeChoice === opt.id
                      ? opt.id === 'parallelogram'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-red-600 text-white'
                      : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {baseShapeChoice && (
              <p
                className={`mt-2 text-[11px] font-semibold ${
                  baseShapeChoice === 'parallelogram' ? 'text-emerald-700' : 'text-red-700'
                }`}
              >
                {baseShapeChoice === 'parallelogram'
                  ? '✓ Chính xác! Nhìn vuông góc đáy ABCD cho thấy AB // CD, AD // BC và đáy ABCD là hình bình hành.'
                  : '✕ Hãy bấm "Nhìn vuông góc đáy ABCD" để kiểm tra các cặp cạnh đối AB, CD và AD, BC.'}
              </p>
            )}

            {/* Live Parallelogram Geometry Verification Button & Dynamic Output */}
            <div className="mt-2.5 border-t border-slate-100 pt-2.5">
              <button
                type="button"
                onClick={handleRunParallelogramCheck}
                className="inline-flex min-h-[34px] w-full items-center justify-center gap-1.5 rounded-xl border border-[#064E3B]/25 bg-emerald-50 px-3 py-1.5 text-[11px] font-extrabold text-[#064E3B] transition-colors hover:bg-emerald-100"
              >
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>KIỂM TRA ĐÁY ABCD</span>
              </button>

              {parallelogramCheckMissingError && (
                <div
                  role="alert"
                  className="mt-2 flex items-start gap-1.5 rounded-xl border border-red-200 bg-red-50 px-2.5 py-2 text-[11px] font-semibold text-red-700"
                >
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>SAI: Chưa có dữ liệu đỉnh hình học đang hiển thị để kiểm tra đáy ABCD.</span>
                </div>
              )}

              {parallelogramCheck && (
                <div
                  className={`mt-2 space-y-1.5 rounded-xl border p-2.5 text-[11px] ${
                    parallelogramCheck.isValid
                      ? 'border-emerald-200 bg-emerald-50/70 text-slate-800'
                      : 'border-red-300 bg-red-50 text-red-900'
                  }`}
                >
                  <div className="flex items-center justify-between font-extrabold">
                    <span className="text-[#064E3B]">Kết quả đo trực tiếp từ dữ liệu 3D:</span>
                    <span className={parallelogramCheck.isValid ? 'text-emerald-700' : 'text-red-700'}>
                      {parallelogramCheck.isValid ? 'ĐẠT HÌNH BÌNH HÀNH' : 'SAI HÌNH BÌNH HÀNH'}
                    </span>
                  </div>

                  <div className="font-math grid grid-cols-2 gap-x-2 gap-y-1">
                    <div>
                      AB // CD:{' '}
                      <strong className={parallelogramCheck.isParallelABtoCD ? 'text-emerald-700' : 'text-red-700'}>
                        {parallelogramCheck.isParallelABtoCD ? 'ĐÚNG' : 'SAI'}
                      </strong>
                    </div>
                    <div>
                      AD // BC:{' '}
                      <strong className={parallelogramCheck.isParallelADtoBC ? 'text-emerald-700' : 'text-red-700'}>
                        {parallelogramCheck.isParallelADtoBC ? 'ĐÚNG' : 'SAI'}
                      </strong>
                    </div>
                    <div>
                      AB = CD:{' '}
                      <strong
                        className={
                          parallelogramCheck.isEqualLengthABtoCD && parallelogramCheck.isVectorABEqualsDC
                            ? 'text-emerald-700'
                            : 'text-red-700'
                        }
                      >
                        {parallelogramCheck.isEqualLengthABtoCD && parallelogramCheck.isVectorABEqualsDC
                          ? 'ĐÚNG'
                          : 'SAI'}
                      </strong>
                    </div>
                    <div>
                      AD = BC:{' '}
                      <strong
                        className={
                          parallelogramCheck.isEqualLengthADtoBC && parallelogramCheck.isVectorADEqualsBC
                            ? 'text-emerald-700'
                            : 'text-red-700'
                        }
                      >
                        {parallelogramCheck.isEqualLengthADtoBC && parallelogramCheck.isVectorADEqualsBC
                          ? 'ĐÚNG'
                          : 'SAI'}
                      </strong>
                    </div>
                    <div>
                      Đồng phẳng:{' '}
                      <strong className={parallelogramCheck.isBaseCoplanar ? 'text-emerald-700' : 'text-red-700'}>
                        {parallelogramCheck.isBaseCoplanar ? 'ĐÚNG' : 'SAI'}
                      </strong>
                    </div>
                    <div>
                      Không suy biến:{' '}
                      <strong className={parallelogramCheck.isBaseNonDegenerate ? 'text-emerald-700' : 'text-red-700'}>
                        {parallelogramCheck.isBaseNonDegenerate ? 'ĐÚNG' : 'SAI'}
                      </strong>
                    </div>
                  </div>

                  <div className="font-math border-t border-slate-200/80 pt-1.5 text-[10.5px] leading-relaxed text-slate-700">
                    <div>
                      |AB| = {parallelogramCheck.lengthAB.toFixed(4)} · |CD| = {parallelogramCheck.lengthCD.toFixed(4)}
                    </div>
                    <div>
                      |AD| = {parallelogramCheck.lengthAD.toFixed(4)} · |BC| = {parallelogramCheck.lengthBC.toFixed(4)}
                    </div>
                    <div>
                      C = B + D − A = ({parallelogramCheck.coordsC.map((n) => n.toFixed(2)).join(', ')})
                    </div>
                  </div>

                  {!parallelogramCheck.isValid && (
                    <div
                      role="alert"
                      className="rounded-lg border border-red-200 bg-white/80 px-2 py-1.5 text-[11px] font-bold text-red-700"
                    >
                      Cảnh báo: {parallelogramCheck.failures.join(' ')}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* BƯỚC 2: XÁC ĐỊNH TRUNG ĐIỂM */}
          <div className="mt-2.5 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs">
            <span className="text-xs font-extrabold text-[#064E3B]">BƯỚC 2: XÁC ĐỊNH TRUNG ĐIỂM</span>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
              Nhấn trực tiếp lên điểm <span className="font-math font-bold text-[#EA580C]">M, N, P</span> trên mô hình 3D (hoặc chọn nút dưới đây) để tô sáng cạnh chứa trung điểm đó:
            </p>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {(['M', 'N', 'P'] as const).map((pt) => (
                <button
                  key={pt}
                  type="button"
                  onClick={() => onSelectMidpoint(selectedMidpoint === pt ? null : pt)}
                  aria-pressed={selectedMidpoint === pt}
                  className={`min-h-[34px] rounded-xl px-2 py-1 text-xs font-extrabold transition-colors ${
                    selectedMidpoint === pt
                      ? 'bg-[#EA580C] text-white shadow-xs'
                      : 'border border-amber-200 bg-amber-50 text-[#C2410C] hover:bg-amber-100'
                  }`}
                >
                  Điểm {pt}
                </button>
              ))}
            </div>
            {selectedMidpoint && (
              <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] font-semibold text-amber-950">
                <span className="font-math font-extrabold text-[#C2410C]">
                  {MIDPOINT_INFO[selectedMidpoint].edge}
                </span>
                : {MIDPOINT_INFO[selectedMidpoint].detail}
              </div>
            )}
          </div>

          {/* BƯỚC 3: TÌM CĂN CỨ SONG SONG */}
          <div className="mt-2.5 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs">
            <span className="text-xs font-extrabold text-[#064E3B]">BƯỚC 3: TÌM CĂN CỨ SONG SONG</span>
            <p className="mt-1 text-[11px] text-slate-600">
              Tô sáng hai cặp đoạn bằng hai màu khác nhau rồi điền cạnh đáy tương ứng:
            </p>

            <div className="mt-2 grid grid-cols-3 gap-1">
              <button
                type="button"
                onClick={() => onChangeHighlightPair(highlightPair === 'MN_AB' ? 'none' : 'MN_AB')}
                aria-pressed={highlightPair === 'MN_AB'}
                className={`min-h-[32px] rounded-lg px-2 py-1 text-[11px] font-bold transition-colors ${
                  highlightPair === 'MN_AB'
                    ? 'bg-[#0284C7] text-white'
                    : 'border border-sky-200 bg-sky-50 text-[#0284C7] hover:bg-sky-100'
                }`}
              >
                MN &amp; AB
              </button>
              <button
                type="button"
                onClick={() => onChangeHighlightPair(highlightPair === 'NP_BC' ? 'none' : 'NP_BC')}
                aria-pressed={highlightPair === 'NP_BC'}
                className={`min-h-[32px] rounded-lg px-2 py-1 text-[11px] font-bold transition-colors ${
                  highlightPair === 'NP_BC'
                    ? 'bg-[#059669] text-white'
                    : 'border border-emerald-200 bg-emerald-50 text-[#059669] hover:bg-emerald-100'
                }`}
              >
                NP &amp; BC
              </button>
              <button
                type="button"
                onClick={() => onChangeHighlightPair(highlightPair === 'BOTH' ? 'none' : 'BOTH')}
                aria-pressed={highlightPair === 'BOTH'}
                className={`min-h-[32px] rounded-lg px-2 py-1 text-[11px] font-bold transition-colors ${
                  highlightPair === 'BOTH'
                    ? 'bg-[#064E3B] text-[#FACC15]'
                    : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Cả 2 cặp
              </button>
            </div>

            <div className="mt-2.5 space-y-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                <span className="font-math w-16 shrink-0 font-bold text-[#0284C7]">MN //</span>
                <input
                  type="text"
                  maxLength={6}
                  value={answerMN}
                  onChange={(e) => {
                    setAnswerMN(e.target.value);
                    setStep3Submitted(false);
                  }}
                  placeholder="Nhập cạnh đáy..."
                  className="font-math min-h-[34px] w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-1 text-xs uppercase text-slate-900 focus:border-[#0284C7] focus:bg-white focus:outline-none"
                />
              </label>

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                <span className="font-math w-16 shrink-0 font-bold text-[#059669]">NP //</span>
                <input
                  type="text"
                  maxLength={6}
                  value={answerNP}
                  onChange={(e) => {
                    setAnswerNP(e.target.value);
                    setStep3Submitted(false);
                  }}
                  placeholder="Nhập cạnh đáy..."
                  className="font-math min-h-[34px] w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-1 text-xs uppercase text-slate-900 focus:border-[#059669] focus:bg-white focus:outline-none"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={() => setStep3Submitted(true)}
              className="mt-2 inline-flex min-h-[36px] w-full items-center justify-center rounded-xl bg-[#2563EB] px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
            >
              Kiểm tra căn cứ song song
            </button>

            {step3Submitted && (
              <div className="mt-2 space-y-1 rounded-xl border border-slate-200 bg-slate-50 p-2 text-[11px]">
                <p className={isMNCorrect ? 'font-semibold text-emerald-700' : 'font-semibold text-red-700'}>
                  {isMNCorrect
                    ? '✓ Đúng: MN // AB (đường trung bình ΔSAB).'
                    : '✕ Chưa đúng cho MN: hãy tô sáng MN & AB và quan sát ΔSAB.'}
                </p>
                <p className={isNPCorrect ? 'font-semibold text-emerald-700' : 'font-semibold text-red-700'}>
                  {isNPCorrect
                    ? '✓ Đúng: NP // BC (đường trung bình ΔSBC).'
                    : '✕ Chưa đúng cho NP: hãy tô sáng NP & BC và quan sát ΔSBC.'}
                </p>
              </div>
            )}
          </div>

          {/* BƯỚC 4: KẾT LUẬN */}
          <div className="mt-2.5 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-extrabold text-[#064E3B]">BƯỚC 4: KẾT LUẬN</span>
              <button
                type="button"
                onClick={() => setRevealedHints((h) => (h < hints.length ? h + 1 : 0))}
                className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-100"
              >
                <Lightbulb className="h-3 w-3" aria-hidden="true" />
                <span>{revealedHints < hints.length ? `Gợi ý (${revealedHints}/${hints.length})` : 'Ẩn gợi ý'}</span>
              </button>
            </div>

            <div className="mt-2 space-y-2 text-[11px]">
              <div>
                <p className="font-semibold text-slate-800">1. MN và NP có cắt nhau không?</p>
                <div className="mt-1 grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setQIntersect('yes');
                      setStep4Checked(false);
                    }}
                    className={`min-h-[30px] rounded-lg px-2 py-1 font-bold ${
                      qIntersect === 'yes'
                        ? 'bg-[#064E3B] text-white'
                        : 'border border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                  >
                    Có, cắt tại N
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setQIntersect('no');
                      setStep4Checked(false);
                    }}
                    className={`min-h-[30px] rounded-lg px-2 py-1 font-bold ${
                      qIntersect === 'no'
                        ? 'bg-[#064E3B] text-white'
                        : 'border border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                  >
                    Không cắt nhau
                  </button>
                </div>
              </div>

              <div>
                <p className="font-semibold text-slate-800">2. Chúng nằm trong mặt phẳng nào?</p>
                <div className="mt-1 grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setQPlane('MNP');
                      setStep4Checked(false);
                    }}
                    className={`font-math min-h-[30px] rounded-lg px-2 py-1 font-bold ${
                      qPlane === 'MNP'
                        ? 'bg-[#064E3B] text-white'
                        : 'border border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                  >
                    Mặt phẳng (MNP)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setQPlane('ABCD');
                      setStep4Checked(false);
                    }}
                    className={`font-math min-h-[30px] rounded-lg px-2 py-1 font-bold ${
                      qPlane === 'ABCD'
                        ? 'bg-[#064E3B] text-white'
                        : 'border border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                  >
                    Mặt phẳng (ABCD)
                  </button>
                </div>
              </div>

              <div>
                <p className="font-semibold text-slate-800">
                  3. Chúng có song song với mặt phẳng (ABCD) không?
                </p>
                <div className="mt-1 grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setQParallelBase('yes');
                      setStep4Checked(false);
                    }}
                    className={`min-h-[30px] rounded-lg px-2 py-1 font-bold ${
                      qParallelBase === 'yes'
                        ? 'bg-[#064E3B] text-white'
                        : 'border border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                  >
                    Có song song
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setQParallelBase('no');
                      setStep4Checked(false);
                    }}
                    className={`min-h-[30px] rounded-lg px-2 py-1 font-bold ${
                      qParallelBase === 'no'
                        ? 'bg-[#064E3B] text-white'
                        : 'border border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                  >
                    Không song song
                  </button>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setStep4Checked(true)}
              className="mt-2.5 inline-flex min-h-[36px] w-full items-center justify-center rounded-xl border border-[#2563EB]/40 bg-blue-50 px-3 py-1.5 text-xs font-bold text-[#1D4ED8] hover:bg-blue-100"
            >
              Kiểm tra 3 câu trả lời
            </button>

            {step4Checked && (
              <p
                className={`mt-2 text-[11px] font-semibold ${
                  isStep4QuestionsCorrect ? 'text-emerald-700' : 'text-red-700'
                }`}
              >
                {isStep4QuestionsCorrect
                  ? '✓ Tuyệt vời! Cả 3 điều kiện định lí hai mặt phẳng song song đều đúng. Nhấn "Xem lời giải" để xem kết luận chuẩn.'
                  : '✕ Một số ý chưa đúng. Hãy kiểm tra lại điểm chung N, mặt phẳng chứa MN, NP và quan hệ song song với (ABCD).'}
              </p>
            )}

            {revealedHints > 0 && (
              <ol className="mt-2 space-y-1 text-[11px] text-slate-700">
                {hints.slice(0, revealedHints).map((hint, idx) => (
                  <li key={idx} className="flex items-start gap-1.5 rounded-lg bg-slate-50 px-2 py-1.5">
                    <span className="font-math font-bold text-[#2563EB]">{idx + 1}.</span>
                    <span className="leading-relaxed">{hint}</span>
                  </li>
                ))}
              </ol>
            )}

            <button
              type="button"
              onClick={() => {
                if (mode === 'teacher') {
                  setTeacherShowAnswers((prev) => !prev);
                } else {
                  setShowSolution((prev) => !prev);
                }
              }}
              className="mt-2.5 inline-flex min-h-[38px] w-full items-center justify-center gap-1.5 rounded-xl bg-[#064E3B] px-3 py-2 text-xs font-extrabold text-[#FACC15] transition-colors hover:bg-[#053D2E]"
            >
              <HelpCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{effectiveShowAnswers ? 'ẨN LỜI GIẢI' : 'XEM LỜI GIẢI'}</span>
            </button>

            {effectiveShowAnswers && (
              <div className="mt-2.5 space-y-1.5 rounded-xl border border-[#00CFC8]/60 bg-[#F0FDFA] p-3 text-xs leading-relaxed text-slate-800">
                <p className="font-math text-sm font-extrabold text-[#064E3B]">
                  KẾT LUẬN: (MNP) // (ABCD)
                </p>
                <p>
                  • Trong <span className="font-math">ΔSAB</span>, <span className="font-math">M, N</span> là trung điểm của <span className="font-math">SA, SB</span> nên <span className="font-math">MN // AB ⇒ MN // (ABCD)</span>.
                </p>
                <p>
                  • Trong <span className="font-math">ΔSBC</span>, <span className="font-math">N, P</span> là trung điểm của <span className="font-math">SB, SC</span> nên <span className="font-math">NP // BC ⇒ NP // (ABCD)</span>.
                </p>
                <p>
                  • Vì <span className="font-math">MN</span> và <span className="font-math">NP</span> cắt nhau tại <span className="font-math">N</span> trong <span className="font-math">(MNP)</span>, suy ra <span className="font-math font-bold text-[#064E3B]">(MNP) // (ABCD)</span>.
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* TAB 2: KHÁM PHÁ HAI MẶT PHẲNG */}
      {activeTab === 'planes' && (
        <PlaneExplorer
          showBase={showBase}
          baseOpacity={baseOpacity}
          showSection={showSection}
          sectionOpacity={sectionOpacity}
          sectionDisplayMode={sectionDisplayMode}
          comparisonMode={comparisonMode}
          showPlaneLabels={showPlaneLabels}
          isOrthoBaseActive={isOrthoBaseActive}
          onToggleBase={onToggleBase}
          onChangeBaseOpacity={onChangeBaseOpacity}
          onOnlyBase={onOnlyBase}
          onToggleOrthoBase={onToggleOrthoBase}
          onToggleSection={onToggleSection}
          onChangeSectionOpacity={onChangeSectionOpacity}
          onOnlySection={onOnlySection}
          onChangeSectionDisplayMode={onChangeSectionDisplayMode}
          onToggleComparisonMode={onToggleComparisonMode}
          onTogglePlaneLabels={onTogglePlaneLabels}
          onSelectPreset={onSelectPreset}
        />
      )}

      {/* TAB 3: EM LÀ NHÀ THIẾT KẾ HÌNH HỌC */}
      {activeTab === 'designer' && (
        <DesignerChallengePanel
          active={designerActive}
          checked={designerChecked}
          edges={edges}
          predictions={designerPredictions}
          occlusionResults={designerOcclusionResults}
          onStartChallenge={onStartDesigner}
          onExitChallenge={onExitDesigner}
          onCycleEdgePrediction={onCycleEdgePrediction}
          onSetEdgePrediction={onSetEdgePrediction}
          onCheckPredictions={onCheckDesigner}
          onResetPredictions={onResetDesigner}
          onSelectPreset={onSelectPreset}
        />
      )}

      {/* Automated 10-Check Geometric Verification Summary */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <button
          type="button"
          onClick={() => setShowMathCheck((prev) => !prev)}
          className="flex w-full items-center justify-between gap-2 text-left text-xs font-semibold text-[#064E3B]"
        >
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-emerald-700" aria-hidden="true" />
            <span>Kiểm thử hình học tự động (10/10)</span>
          </span>
          <span className="font-math inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            {mathReport.allPassed ? 'ĐẠT 100%' : 'CẦN KIỂM TRA'}
          </span>
        </button>

        {showMathCheck && (
          <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2 text-[11px] text-slate-600">
            <li>1. <span className="font-math">ABCD</span> là hình bình hành: <strong className="text-emerald-700">{mathReport.isParallelogramValid ? 'Đạt' : 'Lỗi'}</strong> (dư <span className="font-math">{mathReport.parallelogramResidual.toExponential(1)}</span>)</li>
            <li>2. <span className="font-math">ABCD</span> &amp; hình chóp không suy biến: <strong className="text-emerald-700">{mathReport.isBaseNonDegenerate ? 'Đạt' : 'Lỗi'}</strong></li>
            <li>3. <span className="font-math">M, N, P</span> trung điểm chính xác: <strong className="text-emerald-700">{mathReport.areMidpointsExact ? 'Đạt' : 'Lỗi'}</strong> (sai số <span className="font-math">{mathReport.midpointMaxError.toExponential(1)}</span>)</li>
            <li>4–6. <span className="font-math">MN // AB, NP // BC, MP // AC</span>: <strong className="text-emerald-700">{mathReport.isParallelMNtoAB && mathReport.isParallelNPtoBC && mathReport.isParallelMPtoAC ? 'Đạt' : 'Lỗi'}</strong></li>
            <li>7. <span className="font-math">MNP</span> xác định mặt phẳng không suy biến: <strong className="text-emerald-700">{mathReport.isMNPNonDegenerate ? 'Đạt' : 'Lỗi'}</strong></li>
            <li>8. <span className="font-math">(MNP) // (ABCD)</span>: <strong className="text-emerald-700">{mathReport.arePlanesParallel ? 'Đạt' : 'Lỗi'}</strong></li>
            <li>9. Mặt tô màu nằm đúng mặt phẳng toán học: <strong className="text-emerald-700">{mathReport.areColoredPlanesCoplanar ? 'Đạt' : 'Lỗi'}</strong> (lệch <span className="font-math">{mathReport.coloredPlaneCoplanarityError.toExponential(1)}</span>)</li>
            <li>10. Tọa độ đỉnh bất biến khi xoay camera: <strong className="text-emerald-700">{mathReport.coordinatesImmutableOnOrbit ? 'Đạt' : 'Lỗi'}</strong></li>
          </ul>
        )}
      </div>
    </aside>
  );
}
