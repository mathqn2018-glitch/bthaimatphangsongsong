import { CheckCircle2, RotateCcw, SkipForward, Sparkles, X } from 'lucide-react';

export interface WowAnimationBarProps {
  active: boolean;
  stage: number; // 1..7
  conclusionRevealed: boolean;
  onSkipToQuestion: () => void;
  onReplay: () => void;
  onRevealConclusion: () => void;
  onClose: () => void;
}

const STAGE_TITLES: Record<number, string> = {
  1: 'Bước 1/6: Hiện mặt phẳng đáy ABCD màu xanh ngọc (#00CFC8)',
  2: 'Bước 2/6: Đánh dấu trung điểm M, N, P trên SA, SB, SC',
  3: 'Bước 3/6: Nối MN và NP bằng hiệu ứng chiếu sáng',
  4: 'Bước 4/6: Tô sáng cặp cạnh đáy tương ứng AB và BC',
  5: 'Bước 5/6: Hiện miền đại diện mặt phẳng (MNP) màu cam vàng',
  6: 'Bước 6/6: Chuyển sang góc nhìn bên quan sát hai mặt phẳng',
  7: 'Hoàn tất hoạt hình — Hãy rút ra nhận xét và bấm Hiện kết luận',
};

export function WowAnimationBar({
  active,
  stage,
  conclusionRevealed,
  onSkipToQuestion,
  onReplay,
  onRevealConclusion,
  onClose,
}: WowAnimationBarProps) {
  if (!active) return null;

  const progressPct = Math.min(100, Math.round((Math.min(stage, 6) / 6) * 100));

  return (
    <div className="pointer-events-none absolute inset-x-0 top-2.5 z-20 flex justify-center px-3">
      <div className="pointer-events-auto w-full max-w-xl rounded-2xl border border-[#FACC15]/70 bg-[#064E3B]/95 p-3 text-white shadow-xl">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0 text-[#FACC15]" aria-hidden="true" />
            <div>
              <p className="text-[11px] font-extrabold tracking-wide text-[#FACC15]">
                HOẠT HÌNH KHÁM PHÁ ĐỊNH LÍ
              </p>
              <p className="text-xs font-semibold text-white">
                {STAGE_TITLES[stage] ?? STAGE_TITLES[1]}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng hoạt hình khám phá"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#00CFC8] to-[#FACC15] transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {stage < 7 && (
              <button
                type="button"
                onClick={onSkipToQuestion}
                className="inline-flex min-h-[32px] items-center gap-1 rounded-lg bg-white/15 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-white/25"
              >
                <SkipForward className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Bỏ qua</span>
              </button>
            )}
            <button
              type="button"
              onClick={onReplay}
              className="inline-flex min-h-[32px] items-center gap-1 rounded-lg bg-white/15 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-white/25"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Xem lại</span>
            </button>
          </div>

          {stage >= 7 && !conclusionRevealed && (
            <button
              type="button"
              onClick={onRevealConclusion}
              className="inline-flex min-h-[34px] items-center gap-1.5 rounded-xl bg-[#FACC15] px-3.5 py-1.5 text-xs font-extrabold text-[#064E3B] shadow-sm hover:bg-yellow-300"
            >
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Hiện kết luận</span>
            </button>
          )}
        </div>

        {stage >= 7 && conclusionRevealed && (
          <div className="mt-2.5 rounded-xl border border-[#00CFC8]/60 bg-white px-3 py-2 text-slate-900">
            <p className="font-math text-sm font-extrabold text-[#064E3B]">
              KẾT LUẬN: (MNP) // (ABCD)
            </p>
            <p className="mt-0.5 text-[11px] text-slate-700">
              Vì <span className="font-math font-bold text-[#0284C7]">MN // AB</span> và{' '}
              <span className="font-math font-bold text-[#059669]">NP // BC</span>, hai đường thẳng{' '}
              <span className="font-math">MN, NP</span> cắt nhau tại <span className="font-math">N</span> trong{' '}
              <span className="font-math">(MNP)</span> cùng song song với <span className="font-math">(ABCD)</span>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
