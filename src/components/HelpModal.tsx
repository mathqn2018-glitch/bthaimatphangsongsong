import { BookOpen, Hand, Layers, PencilRuler, ScanEye, Smartphone, X } from 'lucide-react';

export interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-modal-title"
    >
      <div className="w-full max-w-lg rounded-2xl border border-[#064E3B]/20 bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-[#064E3B]" aria-hidden="true" />
            <h2 id="help-modal-title" className="text-base font-bold text-[#064E3B]">
              Hướng dẫn Phòng thí nghiệm Hình học 3D
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng hướng dẫn"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4 space-y-2.5 text-xs leading-relaxed text-slate-700">
          <div className="flex items-start gap-2.5 rounded-xl bg-[#F3FAFC] p-3">
            <Hand className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB]" aria-hidden="true" />
            <div>
              <p className="font-bold text-slate-900">Xoay 3D &amp; Góc nhìn thông minh</p>
              <p className="mt-0.5">
                Kéo <strong>1 ngón tay</strong> (hoặc chuột trái) để xoay 360° không làm cuộn trang; bấm{' '}
                <strong>Nhìn vuông góc mặt đáy</strong> (trực giao) để thấy rõ hình bình hành{' '}
                <span className="font-math font-bold">ABCD</span> không bị méo phối cảnh.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 rounded-xl bg-[#F3FAFC] p-3">
            <Layers className="mt-0.5 h-4 w-4 shrink-0 text-[#00CFC8]" aria-hidden="true" />
            <div>
              <p className="font-bold text-slate-900">Hai mặt phẳng &amp; Quy ước màu</p>
              <p className="mt-0.5">
                Đáy <span className="font-math font-bold text-[#064E3B]">(ABCD)</span> tô xanh ngọc{' '}
                <span className="font-math">#00CFC8</span> viền xanh dương;{' '}
                <span className="font-math font-bold text-[#9A3412]">(MNP)</span> tô cam vàng{' '}
                <span className="font-math">#FFB347</span> với 2 chế độ:{' '}
                <strong>Tam giác MNP</strong> và <strong>Mặt phẳng (MNP)</strong> mở rộng.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 rounded-xl bg-[#F3FAFC] p-3">
            <PencilRuler className="mt-0.5 h-4 w-4 shrink-0 text-[#EA580C]" aria-hidden="true" />
            <div>
              <p className="font-bold text-slate-900">Thử thách: Em là nhà thiết kế hình học</p>
              <p className="mt-0.5">
                Ở tab <strong>Thiết kế nét</strong>, tự dự đoán cạnh nét liền, nét đứt hay khuất một phần rồi bấm{' '}
                <strong>KIỂM TRA</strong> để đối chiếu với bộ giải che khuất hình học 3D thực tế.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 rounded-xl bg-[#F3FAFC] p-3">
            <ScanEye className="mt-0.5 h-4 w-4 shrink-0 text-[#064E3B]" aria-hidden="true" />
            <div>
              <p className="font-bold text-slate-900">Hoạt hình khám phá định lí</p>
              <p className="mt-0.5">
                Nhấn <strong>Khám phá điều kỳ diệu</strong> để xem trình tự dựng trung điểm, tô sáng{' '}
                <span className="font-math">MN // AB, NP // BC</span> và tự rút ra kết luận{' '}
                <span className="font-math">(MNP) // (ABCD)</span>.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 rounded-xl bg-[#F3FAFC] p-3">
            <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-[#064E3B]" aria-hidden="true" />
            <div>
              <p className="font-bold text-slate-900">Chia sẻ QR &amp; Xem AR</p>
              <p className="mt-0.5">
                Học sinh quét QR mở thẳng trên điện thoại (HTTPS công khai) và bấm <strong>Xem AR</strong> trên Android WebXR hoặc iPhone Safari Quick Look.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 min-h-[42px] w-full rounded-xl bg-[#064E3B] px-4 py-2 text-xs font-bold text-[#FACC15] hover:bg-[#053D2E]"
        >
          Đã hiểu, bắt đầu thí nghiệm 3D
        </button>
      </div>
    </div>
  );
}
