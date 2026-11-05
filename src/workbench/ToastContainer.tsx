import React from 'react';
import { Info, CheckCircle2, AlertTriangle, XCircle, X } from 'lucide-react';

export interface ToastItem {
  id: string;
  title: string;
  message?: string;
  type?: 'info' | 'success' | 'warning' | 'error';
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-8 right-6 flex flex-col gap-2 z-50 pointer-events-none select-none">
      {toasts.map((toast) => {
        let Icon = Info;
        let iconColor = 'text-[#3574F0]';
        let borderColor = 'border-[#3574F0]/40';

        if (toast.type === 'success') {
          Icon = CheckCircle2;
          iconColor = 'text-[#59A869]';
          borderColor = 'border-[#59A869]/40';
        } else if (toast.type === 'warning') {
          Icon = AlertTriangle;
          iconColor = 'text-[#EDA200]';
          borderColor = 'border-[#EDA200]/40';
        } else if (toast.type === 'error') {
          Icon = XCircle;
          iconColor = 'text-[#E05555]';
          borderColor = 'border-[#E05555]/40';
        }

        return (
          <div
            key={toast.id}
            className={`w-72 bg-[#2B2D30] border ${borderColor} rounded-lg shadow-2xl p-3 flex items-start gap-2.5 pointer-events-auto animate-in slide-in-from-right-5 fade-in duration-150`}
          >
            <Icon size={16} className={`${iconColor} mt-0.5 flex-shrink-0`} />
            <div className="flex-1 text-[12px] min-w-0">
              <div className="font-semibold text-[#DFE1E5] truncate">{toast.title}</div>
              {toast.message && (
                <div className="text-[#868A91] text-[11px] mt-0.5 leading-snug">{toast.message}</div>
              )}
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className="text-[#868A91] hover:text-[#DFE1E5] p-0.5 rounded hover:bg-[#35373B] flex-shrink-0"
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
