import React from 'react';
import { 
  X, 
  RotateCw, 
  CheckCircle2, 
  AlertTriangle, 
  Download, 
  Sparkles, 
  ExternalLink, 
  ShieldCheck,
  Clock,
  HardDrive
} from 'lucide-react';
import { VersionMetadata, UpdateProgress, UpdateCheckStatus } from '../../types/updater';
import { DEFAULT_GITLAB_HOST } from '../../services/updaterService';

export interface UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: UpdateCheckStatus;
  metadata: VersionMetadata | null;
  currentVersion: string;
  progress: UpdateProgress | null;
  errorMessage: string | null;
  onCheckAgain: () => void;
  onStartDownload: () => void;
  onCancelDownload: () => void;
  onApplyRestart: () => void;
  onIgnoreVersion: (version: string) => void;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({
  isOpen,
  onClose,
  status,
  metadata,
  currentVersion,
  progress,
  errorMessage,
  onCheckAgain,
  onStartDownload,
  onCancelDownload,
  onApplyRestart,
  onIgnoreVersion,
}) => {
  if (!isOpen) return null;

  const isForceUpdate = Boolean(metadata?.forceUpdate);

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes === 0) return '0 MB';
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatSpeed = (bytesPerSec?: number) => {
    if (!bytesPerSec || bytesPerSec === 0) return '';
    return `${(bytesPerSec / (1024 * 1024)).toFixed(2)} MB/s`;
  };

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (_) {
      return isoStr;
    }
  };

  // Render markdown đơn giản cho release notes (bullets, bold, headings)
  const renderReleaseNotes = (notesText?: string) => {
    if (!notesText) {
      return <p className="text-xs text-[#868A91] italic">Không có ghi chú phát hành chi tiết.</p>;
    }

    const lines = notesText.split('\n');
    return (
      <div className="space-y-1.5 text-xs text-[#DFE1E5] font-sans leading-relaxed">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) return <div key={idx} className="h-1" />;
          if (trimmed.startsWith('#')) {
            const headingText = trimmed.replace(/^#+\s*/, '');
            return (
              <h4 key={idx} className="font-semibold text-white pt-1 text-xs tracking-wide">
                {headingText}
              </h4>
            );
          }
          if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*')) {
            const itemText = trimmed.replace(/^[•\-*]\s*/, '');
            return (
              <div key={idx} className="flex items-start gap-2 pl-1">
                <span className="text-[#3574F0] mt-0.5">•</span>
                <span className="flex-1">{itemText}</span>
              </div>
            );
          }
          return <p key={idx}>{trimmed}</p>;
        })}
      </div>
    );
  };

  return (
    <div 
      className="fixed inset-0 bg-black/65 backdrop-blur-[2px] flex items-center justify-center z-[60] select-none animate-in fade-in duration-100"
      onClick={() => {
        if (!isForceUpdate) onClose();
      }}
    >
      <div 
        className="w-[560px] bg-[#2B2D30] border border-[#43454A] rounded-lg shadow-2xl flex flex-col overflow-hidden text-[#DFE1E5]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title Bar */}
        <div className="h-9 bg-[#26282B] border-b border-[#393B40] flex items-center justify-between px-3.5 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-[#3574F0] flex items-center justify-center text-[10px] font-bold text-white">
              IJ
            </div>
            <span className="text-[12.5px] font-medium text-[#DFE1E5]">
              {isForceUpdate ? 'Mandatory Update - Custom IDEA' : 'Custom IDEA Updates'}
            </span>
          </div>

          {!isForceUpdate && status !== 'downloading' && (
            <button 
              onClick={onClose} 
              className="p-1 hover:bg-[#35373B] rounded text-[#868A91] hover:text-[#DFE1E5] transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Mandatory Update Warning Banner */}
        {isForceUpdate && (
          <div className="bg-[#592B2B]/80 border-b border-[#E05252]/40 px-3.5 py-1.5 flex items-center gap-2 text-xs text-[#F28B82]">
            <AlertTriangle size={14} className="shrink-0 text-[#E05252]" />
            <span className="font-medium">
              Bản cập nhật bắt buộc: Vui lòng cập nhật để tiếp tục sử dụng Custom IDEA.
            </span>
          </div>
        )}

        {/* Modal Body Content */}
        <div className="p-5 flex-1 overflow-y-auto">
          {/* STATE 1: CHECKING */}
          {status === 'checking' && (
            <div className="py-8 flex flex-col items-center justify-center gap-3 text-center">
              <RotateCw size={28} className="text-[#3574F0] animate-spin" />
              <div>
                <p className="text-sm font-medium text-white">Đang kiểm tra bản cập nhật...</p>
                <p className="text-xs text-[#868A91] mt-1">Đang kết nối tới máy chủ cập nhật ({DEFAULT_GITLAB_HOST})</p>
              </div>
            </div>
          )}

          {/* STATE 2: UP TO DATE */}
          {status === 'upToDate' && (
            <div className="py-6 flex flex-col items-center justify-center gap-3 text-center">
              <div className="w-10 h-10 rounded-full bg-[#2E462E] flex items-center justify-center text-[#62B543]">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Bạn đang sử dụng phiên bản mới nhất!</p>
                <p className="text-xs text-[#868A91] mt-1">
                  Custom IDEA phiên bản <span className="text-[#DFE1E5] font-mono font-medium">v{currentVersion}</span>
                </p>
                <p className="text-[11px] text-[#5A5D63] mt-2">
                  Máy chủ: {DEFAULT_GITLAB_HOST} • Kiểm tra lúc: {new Date().toLocaleTimeString('vi-VN')}
                </p>
              </div>
            </div>
          )}

          {/* STATE 3: UPDATE AVAILABLE */}
          {status === 'available' && metadata && (
            <div className="space-y-4">
              {/* Header Box */}
              <div className="flex items-start justify-between bg-[#1E1F22] border border-[#393B40] rounded-md p-3.5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">
                      Custom IDEA v{metadata.version}
                    </span>
                    <span className="px-1.5 py-0.2 bg-[#3574F0]/20 text-[#85B1F8] border border-[#3574F0]/40 rounded text-[10px] font-mono">
                      Latest
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-[#868A91]">
                    <span>Phiên bản hiện tại: <span className="font-mono text-[#DFE1E5]">v{currentVersion}</span></span>
                    {metadata.size && (
                      <span className="flex items-center gap-1">
                        <HardDrive size={11} />
                        {formatBytes(metadata.size)}
                      </span>
                    )}
                    {metadata.releaseDate && (
                      <span className="flex items-center gap-1">
                        <Clock size={11} />
                        {formatDate(metadata.releaseDate)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="w-8 h-8 rounded bg-[#3574F0]/15 flex items-center justify-center text-[#3574F0] shrink-0">
                  <Sparkles size={16} />
                </div>
              </div>

              {/* Release Notes View */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-[#868A91] uppercase tracking-wider">
                    Ghi chú bản cập nhật (Release Notes)
                  </span>
                  <div className="flex items-center gap-1 text-[11px] text-[#62B543]">
                    <ShieldCheck size={12} />
                    <span>Xác thực SHA-256</span>
                  </div>
                </div>

                <div className="bg-[#1E1F22] border border-[#393B40] rounded-md p-3 max-h-48 overflow-y-auto">
                  {renderReleaseNotes(metadata.notes)}
                </div>
              </div>
            </div>
          )}

          {/* STATE 4: DOWNLOADING */}
          {status === 'downloading' && (
            <div className="py-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white flex items-center gap-2">
                    <Download size={15} className="text-[#3574F0] animate-bounce" />
                    Đang tải bản cập nhật...
                  </p>
                  <p className="text-xs text-[#868A91] mt-0.5">
                    Tải về từ GitLab Generic Package Registry
                  </p>
                </div>
                {progress?.speedBytesPerSec ? (
                  <span className="text-xs font-mono text-[#85B1F8]">
                    {formatSpeed(progress.speedBytesPerSec)}
                  </span>
                ) : null}
              </div>

              {/* Progress Bar Container */}
              <div className="space-y-1.5">
                <div className="w-full bg-[#1E1F22] border border-[#393B40] rounded-full h-2.5 overflow-hidden p-0.5">
                  <div 
                    className="bg-gradient-to-r from-[#3574F0] to-[#5990F7] h-full rounded-full transition-all duration-150"
                    style={{ width: `${Math.min(100, Math.max(2, progress?.percent || 0))}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-[11px] text-[#868A91] font-mono">
                  <span>{progress?.percent || 0}% hoàn thành</span>
                  <span>
                    {formatBytes(progress?.receivedBytes)} / {formatBytes(progress?.totalBytes || metadata?.size)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* STATE 5: READY TO RESTART */}
          {status === 'readyRestart' && (
            <div className="py-6 flex flex-col items-center justify-center gap-3 text-center">
              <div className="w-10 h-10 rounded-full bg-[#2E462E] flex items-center justify-center text-[#62B543]">
                <ShieldCheck size={24} />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Đã tải và xác thực SHA-256 hoàn tất!</p>
                <p className="text-xs text-[#868A91] mt-1 max-w-sm">
                  Bản vá <span className="text-[#DFE1E5] font-mono">v{metadata?.version}</span> đã sẵn sàng. Khởi động lại Custom IDEA để áp dụng bản cập nhật ngay lập tức.
                </p>
              </div>
            </div>
          )}

          {/* STATE 6: ERROR */}
          {status === 'error' && (
            <div className="py-4 space-y-3">
              <div className="flex items-start gap-3 bg-[#592B2B]/40 border border-[#E05252]/40 rounded-md p-3">
                <AlertTriangle size={18} className="text-[#E05252] shrink-0 mt-0.5" />
                <div className="text-xs text-[#DFE1E5]">
                  <p className="font-semibold text-[#F28B82]">Cập nhật không thành công</p>
                  <p className="text-[#868A91] mt-1 leading-relaxed">
                    {errorMessage || 'Không thể kết nối hoặc xác thực tệp từ máy chủ cập nhật. Vui lòng kiểm tra lại kết nối mạng.'}
                  </p>
                </div>
              </div>

              {metadata?.downloadUrl && (
                <div className="text-right">
                  <a 
                    href={metadata.downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-[#4B9FD5] hover:underline"
                  >
                    <span>Tải tệp cài đặt thủ công qua trình duyệt</span>
                    <ExternalLink size={11} />
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="h-12 bg-[#26282B] border-t border-[#393B40] px-4 flex items-center justify-between flex-shrink-0">
          <div>
            {status === 'available' && !isForceUpdate && (
              <button
                onClick={() => {
                  if (metadata) onIgnoreVersion(metadata.version);
                  onClose();
                }}
                className="text-xs text-[#868A91] hover:text-[#DFE1E5] transition-colors"
              >
                Bỏ qua phiên bản này
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Action buttons based on state */}
            {status === 'upToDate' && (
              <button
                onClick={onClose}
                className="px-3.5 py-1.5 bg-[#3574F0] hover:bg-[#437EEB] text-white text-xs font-medium rounded transition-colors"
              >
                Đóng
              </button>
            )}

            {status === 'available' && (
              <>
                {!isForceUpdate && (
                  <button
                    onClick={onClose}
                    className="px-3 py-1.5 bg-[#35373B] hover:bg-[#3E4044] text-[#DFE1E5] text-xs font-medium rounded transition-colors"
                  >
                    Để sau
                  </button>
                )}
                <button
                  onClick={onStartDownload}
                  className="px-4 py-1.5 bg-[#3574F0] hover:bg-[#437EEB] text-white text-xs font-medium rounded transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <Download size={13} />
                  <span>Cập nhật ngay</span>
                </button>
              </>
            )}

            {status === 'downloading' && (
              <button
                onClick={onCancelDownload}
                className="px-3.5 py-1.5 bg-[#35373B] hover:bg-[#3E4044] text-[#DFE1E5] text-xs font-medium rounded transition-colors"
              >
                Hủy tải
              </button>
            )}

            {status === 'readyRestart' && (
              <>
                {!isForceUpdate && (
                  <button
                    onClick={onClose}
                    className="px-3 py-1.5 bg-[#35373B] hover:bg-[#3E4044] text-[#DFE1E5] text-xs font-medium rounded transition-colors"
                  >
                    Khởi động lại sau
                  </button>
                )}
                <button
                  onClick={onApplyRestart}
                  className="px-4 py-1.5 bg-[#62B543] hover:bg-[#529E37] text-white text-xs font-semibold rounded transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <RotateCw size={13} />
                  <span>Khởi động lại ngay</span>
                </button>
              </>
            )}

            {status === 'error' && (
              <>
                {!isForceUpdate && (
                  <button
                    onClick={onClose}
                    className="px-3 py-1.5 bg-[#35373B] hover:bg-[#3E4044] text-[#DFE1E5] text-xs font-medium rounded transition-colors"
                  >
                    Đóng
                  </button>
                )}
                <button
                  onClick={onCheckAgain}
                  className="px-3.5 py-1.5 bg-[#3574F0] hover:bg-[#437EEB] text-white text-xs font-medium rounded transition-colors"
                >
                  Thử lại
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
