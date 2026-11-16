import { CheckCircle2, Eye, PencilRuler, RotateCcw, ShieldAlert } from 'lucide-react';
import type { ParsedEdge } from '../geometry/parseGeometry';
import type {
  EdgeOcclusionDetail,
  EdgeVisibilityClassification,
} from '../geometry/visibility';
import type { CameraPreset } from './GeometryViewer';

export interface DesignerChallengePanelProps {
  active: boolean;
  checked: boolean;
  edges: ParsedEdge[];
  predictions: Record<string, EdgeVisibilityClassification>;
  occlusionResults: Record<string, EdgeOcclusionDetail> | null;
  onStartChallenge: () => void;
  onExitChallenge: () => void;
  onCycleEdgePrediction: (edgeId: string) => void;
  onSetEdgePrediction: (edgeId: string, cls: EdgeVisibilityClassification) => void;
  onCheckPredictions: () => void;
  onResetPredictions: () => void;
  onSelectPreset: (preset: CameraPreset) => void;
}

const LABEL_BY_CLASS: Record<EdgeVisibilityClassification, string> = {
  visible: 'Nét liền (Thấy)',
  hidden: 'Nét đứt (Khuất)',
  partial: 'Khuất một phần',
};

const SHORT_BY_CLASS: Record<EdgeVisibilityClassification, string> = {
  visible: 'Liền',
  hidden: 'Đứt',
  partial: 'Nửa đứt',
};

export function DesignerChallengePanel({
  active,
  checked,
  edges,
  predictions,
  occlusionResults,
  onStartChallenge,
  onExitChallenge,
  onCycleEdgePrediction,
  onSetEdgePrediction,
  onCheckPredictions,
  onResetPredictions,
  onSelectPreset,
}: DesignerChallengePanelProps) {
  const correctCount =
    checked && occlusionResults
      ? edges.filter((e) => predictions[e.id] === occlusionResults[e.id]?.classification).length
      : 0;

  return (
    <div className="space-y-3" aria-label="Chế độ Em là nhà thiết kế hình học">
      <div className="rounded-2xl border border-[#2563EB]/25 bg-gradient-to-br from-[#064E3B] to-[#0A624B] p-3.5 text-white shadow-sm">
        <div className="flex items-center gap-2">
          <PencilRuler className="h-4 w-4 shrink-0 text-[#FACC15]" aria-hidden="true" />
          <h2 className="text-xs font-extrabold tracking-wide text-[#FACC15] sm:text-sm">
            EM LÀ NHÀ THIẾT KẾ HÌNH HỌC
          </h2>
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-emerald-100">
          Chọn một góc nhìn bất kỳ, ẩn phân loại nét tự động rồi tự dự đoán cạnh nào vẽ{' '}
          <strong className="text-white">nét liền</strong>, <strong className="text-white">nét đứt</strong> hay{' '}
          <strong className="text-white">khuất một phần</strong>. Hệ thống kiểm tra dựa trên 5 mặt đặc thực tế của hình chóp.
        </p>

        <div className="mt-3 flex gap-2">
          {!active ? (
            <button
              type="button"
              onClick={onStartChallenge}
              className="inline-flex min-h-[38px] w-full items-center justify-center gap-1.5 rounded-xl bg-[#FACC15] px-3 py-2 text-xs font-extrabold text-[#064E3B] hover:bg-yellow-300"
            >
              <PencilRuler className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Bắt đầu thử thách nét thấy – khuất</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onExitChallenge}
              className="inline-flex min-h-[36px] w-full items-center justify-center gap-1.5 rounded-xl border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/20"
            >
              <Eye className="h-3.5 w-3.5 text-[#00CFC8]" aria-hidden="true" />
              <span>Trở lại hiển thị nét tự động</span>
            </button>
          )}
        </div>
      </div>

      {active && (
        <>
          {/* Quick camera picker before checking */}
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <p className="text-[11px] font-bold text-slate-700">
              1. Chọn hoặc xoay góc nhìn muốn thiết kế:
            </p>
            <div className="mt-1.5 grid grid-cols-4 gap-1">
              {[
                { preset: 'default' as CameraPreset, label: 'Ban đầu' },
                { preset: 'side' as CameraPreset, label: 'Từ bên' },
                { preset: 'top' as CameraPreset, label: 'Từ trên' },
                { preset: 'ortho_base' as CameraPreset, label: 'Đáy 90°' },
              ].map((item) => (
                <button
                  key={item.preset}
                  type="button"
                  onClick={() => onSelectPreset(item.preset)}
                  className="min-h-[32px] rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* 11-Edge Predictor List */}
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-bold text-slate-700">
                2. Dự đoán nét vẽ (hoặc chạm cạnh trên hình 3D):
              </p>
              <button
                type="button"
                onClick={onResetPredictions}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800"
              >
                <RotateCcw className="h-3 w-3" aria-hidden="true" />
                <span>Đặt lại</span>
              </button>
            </div>

            <div className="mt-2 space-y-1.5">
              {edges.map((edge) => {
                const pred = predictions[edge.id] ?? 'visible';
                const detail = occlusionResults?.[edge.id];
                const isCorrect = checked && detail ? pred === detail.classification : false;

                return (
                  <div
                    key={edge.id}
                    className={`rounded-xl border p-2 transition-colors ${
                      checked && detail
                        ? isCorrect
                          ? 'border-emerald-300 bg-emerald-50/70'
                          : 'border-red-300 bg-red-50/70'
                        : 'border-slate-200 bg-[#F3FAFC]/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => onCycleEdgePrediction(edge.id)}
                        className="font-math text-xs font-extrabold text-[#064E3B] hover:underline"
                        title="Nhấn để chuyển nhanh giữa Nét liền / Nét đứt / Khuất một phần"
                      >
                        Cạnh {edge.id}
                      </button>

                      <div className="flex items-center gap-1">
                        {(['visible', 'hidden', 'partial'] as const).map((cls) => (
                          <button
                            key={cls}
                            type="button"
                            onClick={() => onSetEdgePrediction(edge.id, cls)}
                            className={`min-h-[28px] rounded-lg px-2 py-0.5 text-[10px] font-bold transition-colors ${
                              pred === cls
                                ? cls === 'visible'
                                  ? 'bg-[#2563EB] text-white'
                                  : cls === 'hidden'
                                    ? 'bg-slate-700 text-white'
                                    : 'bg-[#EA580C] text-white'
                                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {SHORT_BY_CLASS[cls]}
                          </button>
                        ))}
                      </div>
                    </div>

                    {checked && detail && (
                      <div className="mt-1 flex items-center justify-between text-[11px]">
                        <span
                          className={`inline-flex items-center gap-1 font-semibold ${
                            isCorrect ? 'text-emerald-800' : 'text-red-700'
                          }`}
                        >
                          {isCorrect ? (
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          ) : (
                            <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          )}
                          <span>
                            Thực tế: {LABEL_BY_CLASS[detail.classification]}
                            {detail.classification === 'partial'
                              ? ` (${Math.round(detail.hiddenFraction * 100)}% khuất)`
                              : ''}
                          </span>
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={onCheckPredictions}
              className="mt-3 inline-flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-xl bg-[#2563EB] px-3 py-2 text-xs font-extrabold text-white shadow-sm hover:bg-blue-700"
            >
              <span>KIỂM TRA</span>
            </button>

            {checked && occlusionResults && (
              <div className="mt-2.5 rounded-xl border border-[#064E3B]/20 bg-[#F0FDFA] p-2.5 text-xs text-[#064E3B]">
                <p className="font-extrabold">
                  Kết quả tại góc nhìn hiện tại: {correctCount}/{edges.length} cạnh chính xác
                </p>
                <p className="mt-0.5 text-[11px] text-slate-700">
                  Màu xanh lá là cạnh dự đoán đúng, màu đỏ là cạnh cần điều chỉnh. Hãy xoay hình tự do để quan sát vì sao các mặt chóp che khuất cạnh đó!
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
