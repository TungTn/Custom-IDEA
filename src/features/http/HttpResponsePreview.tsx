import React, { useState } from 'react';
import { HttpResponseDto } from '../../bindings';
import { 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Database, 
  Copy, 
  Check, 
  X, 
  Loader2,
  FileText,
  ListFilter
} from 'lucide-react';

interface HttpResponsePreviewProps {
  response: HttpResponseDto | null;
  isLoading: boolean;
  error: string | null;
  onClose?: () => void;
}

export const HttpResponsePreview: React.FC<HttpResponsePreviewProps> = ({
  response,
  isLoading,
  error,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'body' | 'headers'>('body');
  const [copied, setCopied] = useState(false);

  const handleCopyBody = () => {
    if (!response?.body) return;
    navigator.clipboard.writeText(response.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'bg-[#59A869]/20 text-[#59A869] border-[#59A869]/40';
    if (status >= 300 && status < 400) return 'bg-[#3574F0]/20 text-[#3574F0] border-[#3574F0]/40';
    if (status >= 400 && status < 500) return 'bg-[#EDA200]/20 text-[#EDA200] border-[#EDA200]/40';
    return 'bg-[#E06C75]/20 text-[#E06C75] border-[#E06C75]/40';
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formattedBody = React.useMemo(() => {
    if (!response?.body) return '';
    try {
      const parsed = JSON.parse(response.body);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return response.body;
    }
  }, [response?.body]);

  return (
    <div className="h-full flex flex-col bg-[#1E1F22] border-l border-[#2B2D30] select-text">
      {/* ─── Top Header ─── */}
      <div className="h-9 bg-[#2B2D30] border-b border-[#1E1F22] px-3 flex items-center justify-between flex-shrink-0 select-none">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[#DFE1E5]">HTTP Response</span>
          {response && (
            <span
              className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-bold border ${getStatusColor(
                response.status
              )}`}
            >
              {response.status} {response.statusText || 'OK'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {response && (
            <>
              <div className="flex items-center gap-1 text-[11px] text-[#868A91]">
                <Clock size={12} className="text-[#3574F0]" />
                <span>{response.latencyMs.toString()} ms</span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-[#868A91]">
                <Database size={12} className="text-[#59A869]" />
                <span>{formatSize(response.sizeBytes)}</span>
              </div>
            </>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="p-1 hover:bg-[#393B40] text-[#868A91] hover:text-[#DFE1E5] rounded transition-colors"
              title="Close Response Panel"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* ─── Sub-nav: Body vs Headers ─── */}
      {response && !isLoading && !error && (
        <div className="h-8 bg-[#25272B] border-b border-[#2B2D30] px-3 flex items-center justify-between flex-shrink-0 select-none">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('body')}
              className={`px-2.5 py-1 text-xs rounded transition-colors flex items-center gap-1.5 ${
                activeTab === 'body'
                  ? 'bg-[#2B2D30] text-[#DFE1E5] font-medium'
                  : 'text-[#868A91] hover:text-[#DFE1E5]'
              }`}
            >
              <FileText size={12} />
              <span>Response Body</span>
            </button>
            <button
              onClick={() => setActiveTab('headers')}
              className={`px-2.5 py-1 text-xs rounded transition-colors flex items-center gap-1.5 ${
                activeTab === 'headers'
                  ? 'bg-[#2B2D30] text-[#DFE1E5] font-medium'
                  : 'text-[#868A91] hover:text-[#DFE1E5]'
              }`}
            >
              <ListFilter size={12} />
              <span>Headers ({Object.keys(response.headers).length})</span>
            </button>
          </div>

          {activeTab === 'body' && (
            <button
              onClick={handleCopyBody}
              className="px-2 py-0.5 hover:bg-[#323438] text-[#868A91] hover:text-[#DFE1E5] text-[11px] rounded transition-colors flex items-center gap-1"
              title="Copy response body"
            >
              {copied ? <Check size={11} className="text-[#59A869]" /> : <Copy size={11} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          )}
        </div>
      )}

      {/* ─── Content Area ─── */}
      <div className="flex-1 overflow-auto p-3">
        {isLoading && (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-[#868A91]">
            <Loader2 size={24} className="animate-spin text-[#3574F0]" />
            <span className="text-xs">Executing HTTP Request...</span>
          </div>
        )}

        {error && !isLoading && (
          <div className="p-3 bg-[#E06C75]/10 border border-[#E06C75]/30 rounded text-xs text-[#E06C75] flex items-start gap-2">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block mb-0.5">Request Error:</span>
              <p className="font-mono break-all whitespace-pre-wrap">{error}</p>
            </div>
          </div>
        )}

        {!isLoading && !error && !response && (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-[#868A91] text-center p-6 select-none">
            <div className="w-10 h-10 rounded-full bg-[#2B2D30] flex items-center justify-center text-[#3574F0]">
              <FileText size={18} />
            </div>
            <p className="text-xs text-[#DFE1E5] font-medium">No HTTP Response Yet</p>
            <p className="text-[11px] text-[#868A91] max-w-xs">
              Click <strong className="text-[#59A869]">▶ Run</strong> on any HTTP request block in your{' '}
              <code className="text-[#DFE1E5]">.http</code> or <code className="text-[#DFE1E5]">.rest</code> file to
              execute.
            </p>
          </div>
        )}

        {!isLoading && !error && response && activeTab === 'body' && (
          <pre className="font-mono text-xs text-[#BCBEC4] leading-relaxed whitespace-pre-wrap break-all select-text bg-[#141517] p-3 rounded border border-[#2B2D30]">
            {formattedBody}
          </pre>
        )}

        {!isLoading && !error && response && activeTab === 'headers' && (
          <div className="border border-[#2B2D30] rounded overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#25272B] text-[#868A91] border-b border-[#2B2D30] font-medium">
                <tr>
                  <th className="py-1.5 px-3">Header Name</th>
                  <th className="py-1.5 px-3">Header Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2B2D30]/60 font-mono">
                {Object.entries(response.headers).map(([key, val]) => (
                  <tr key={key} className="hover:bg-[#25272B]/40">
                    <td className="py-1.5 px-3 text-[#3574F0] font-medium select-text">{key}</td>
                    <td className="py-1.5 px-3 text-[#DFE1E5] select-text break-all">{val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
