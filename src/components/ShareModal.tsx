import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  Maximize2,
  Minimize2,
  QrCode,
  Share2,
  X,
} from 'lucide-react';
import QRCode from 'qrcode';

export interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function isPublicHttpsUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host.endsWith('.local') ||
      /^192\.168\./.test(host) ||
      /^10\./.test(host) ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)
    ) {
      return false;
    }
    // Google AI Studio internal dev preview requires authentication and is not for student QR
    if (host.startsWith('ais-dev-')) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function ShareModal({ isOpen, onClose }: ShareModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const detectedUrl = typeof window !== 'undefined' ? window.location.href : '';

  const [customUrl, setCustomUrl] = useState<string>(() =>
    isPublicHttpsUrl(detectedUrl) ? detectedUrl : '',
  );
  const [copied, setCopied] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [qrZoomed, setQrZoomed] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);

  const activeUrl = customUrl.trim() || detectedUrl;
  const isValidPublicQR = useMemo(() => isPublicHttpsUrl(activeUrl), [activeUrl]);
  const qrSize = qrZoomed ? 320 : 210;

  useEffect(() => {
    if (!isOpen) return;
    if (isPublicHttpsUrl(detectedUrl) && !customUrl) {
      setCustomUrl(detectedUrl);
    }
  }, [isOpen, detectedUrl, customUrl]);

  useEffect(() => {
    if (!isOpen || !isValidPublicQR || !canvasRef.current) return;
    setQrError(null);
    QRCode.toCanvas(
      canvasRef.current,
      activeUrl,
      {
        width: qrSize,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#064E3B',
          light: '#FFFFFF',
        },
      },
      (err) => {
        if (err) {
          setQrError('Không thể tạo mã QR từ đường dẫn này.');
        }
      },
    );
  }, [isOpen, isValidPublicQR, activeUrl, qrSize]);

  async function handleCopy() {
    if (!activeUrl) return;
    try {
      await navigator.clipboard.writeText(activeUrl);
      setCopied(true);
      setShareFeedback(null);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setShareFeedback('Trình duyệt không cho phép sao chép tự động.');
    }
  }

  async function handleNativeShare() {
    if (!isValidPublicQR) return;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'Khám phá Hình chóp 3D — Bài 13 Toán 11',
          text: 'Quét mã hoặc mở liên kết để xoay mô hình hình chóp S.ABCD và chứng minh (MNP) // (ABCD).',
          url: activeUrl,
        });
        return;
      } catch {
        // User cancelled or native share unsupported; fall back to copy
      }
    }
    await handleCopy();
  }

  function handleDownloadQR() {
    if (!canvasRef.current || !isValidPublicQR) return;
    const pngUrl = canvasRef.current.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = pngUrl;
    a.download = 'QR_Kham_pha_hinh_chop_3D.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
    >
      <div
        className={`w-full rounded-2xl border border-[#064E3B]/20 bg-white p-5 shadow-2xl transition-all ${
          qrZoomed ? 'max-w-lg' : 'max-w-md'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-[#064E3B]" aria-hidden="true" />
            <h2 id="share-modal-title" className="text-base font-bold text-[#064E3B]">
              CHIA SẺ MÔ HÌNH – QUÉT QR
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng hộp thoại chia sẻ"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <p className="mt-2 text-xs leading-relaxed text-slate-600">
          Học sinh dùng điện thoại quét QR để mở trực tiếp mô hình 3D (không cần đăng nhập, tự do xoay và thu phóng).
        </p>

        {/* Editable Public HTTPS URL input (auto-filled when deployed on Vercel) */}
        <div className="mt-3">
          <label className="block text-[11px] font-bold text-slate-700">
            Địa chỉ HTTPS công khai (tự động nhận khi chạy trên Vercel):
          </label>
          <input
            type="url"
            value={customUrl}
            onChange={(e) => {
              setCustomUrl(e.target.value);
              setShareFeedback(null);
            }}
            placeholder="https://ten-du-an.vercel.app"
            className="font-math mt-1 min-h-[38px] w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 focus:border-[#064E3B] focus:bg-white focus:outline-none"
          />
        </div>

        <div className="mt-3.5 flex flex-col items-center rounded-2xl border border-slate-200 bg-[#F3FAFC] p-4">
          {isValidPublicQR ? (
            qrError ? (
              <p className="text-xs text-red-700">{qrError}</p>
            ) : (
              <>
                <canvas
                  ref={canvasRef}
                  className="max-w-full rounded-xl border border-slate-200 bg-white shadow-xs"
                  aria-label="Mã QR truy cập mô hình 3D trên lớp"
                />
                <p className="mt-2 text-center text-[11px] font-medium text-[#064E3B]">
                  Mã QR hợp lệ từ liên kết HTTPS công khai
                </p>
              </>
            )
          ) : (
            <div className="flex flex-col items-center gap-2 py-3 text-center">
              <AlertTriangle className="h-7 w-7 text-amber-600" aria-hidden="true" />
              <p className="text-xs font-bold text-amber-950">
                Vui lòng triển khai ứng dụng lên Vercel để tạo mã QR sử dụng trong lớp học.
              </p>
              <p className="text-[11px] leading-relaxed text-slate-600">
                Hệ thống không tạo mã QR từ địa chỉ localhost hoặc đường dẫn xem trước nội bộ. Sau khi triển khai Vercel, mở lại hoặc dán URL <span className="font-math">https://...vercel.app</span> vào ô phía trên.
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={!isValidPublicQR}
            onClick={() => void handleCopy()}
            className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl bg-[#064E3B] px-3 py-2 text-xs font-bold text-[#FACC15] transition-colors hover:bg-[#053D2E] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Đã sao chép</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Sao chép liên kết</span>
              </>
            )}
          </button>

          <button
            type="button"
            disabled={!isValidPublicQR}
            onClick={handleDownloadQR}
            className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Tải ảnh QR (PNG)</span>
          </button>

          <button
            type="button"
            disabled={!isValidPublicQR}
            onClick={() => setQrZoomed((prev) => !prev)}
            className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {qrZoomed ? (
              <>
                <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Thu nhỏ mã QR</span>
              </>
            ) : (
              <>
                <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Phóng to mã QR</span>
              </>
            )}
          </button>

          <button
            type="button"
            disabled={!isValidPublicQR}
            onClick={() => void handleNativeShare()}
            className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl bg-[#2563EB] px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Chia sẻ liên kết</span>
          </button>
        </div>

        {shareFeedback && (
          <p className="mt-2 text-center text-[11px] text-amber-800">{shareFeedback}</p>
        )}
      </div>
    </div>
  );
}
