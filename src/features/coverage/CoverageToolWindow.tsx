import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldCheck, 
  RotateCw, 
  FolderOpen, 
  FileCode, 
  Search, 
  ChevronRight, 
  ChevronDown, 
  CheckCircle2, 
  AlertCircle,
  BarChart3,
  Filter
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

export interface FileCoverageDto {
  file_path: string;
  lines_found: number;
  lines_hit: number;
  coverage_percent: number;
  lines: Record<number, number>;
}

export interface CoverageSummaryDto {
  report_file: string;
  total_files: number;
  total_lines: number;
  covered_lines: number;
  coverage_percent: number;
}

export interface CoverageToolWindowProps {
  projectPath: string;
  onOpenFileAtLocation: (filePath: string, line: number, col?: number) => void;
  onShowToast?: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const CoverageToolWindow: React.FC<CoverageToolWindowProps> = ({
  projectPath,
  onOpenFileAtLocation,
  onShowToast,
}) => {
  const [summary, setSummary] = useState<CoverageSummaryDto | null>(null);
  const [files, setFiles] = useState<FileCoverageDto[]>([]);
  const [detectedReports, setDetectedReports] = useState<string[]>([]);
  const [selectedReport, setSelectedReport] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const loadReport = async (reportPath: string) => {
    setIsLoading(true);
    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        const sum = await invoke<CoverageSummaryDto>('coverage_load_file', { coverageFilePath: reportPath });
        const allFiles = await invoke<FileCoverageDto[]>('coverage_get_all_files');
        setSummary(sum);
        setFiles(allFiles || []);
        setSelectedReport(reportPath);
        onShowToast?.('Coverage Report Loaded', `${sum.coverage_percent}% lines covered in ${sum.total_files} files`, 'success');
      }
    } catch (err: any) {
      console.warn('Failed to load coverage report:', err);
      onShowToast?.('Coverage Error', String(err), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const detectAndRefresh = async () => {
    setIsLoading(true);
    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        const reports = await invoke<string[]>('coverage_detect_reports', { projectPath });
        setDetectedReports(reports || []);

        const currentSummary = await invoke<CoverageSummaryDto | null>('coverage_get_summary');
        if (currentSummary) {
          setSummary(currentSummary);
          const allFiles = await invoke<FileCoverageDto[]>('coverage_get_all_files');
          setFiles(allFiles || []);
          setSelectedReport(currentSummary.report_file);
        } else if (reports && reports.length > 0) {
          await loadReport(reports[0]);
        }
      }
    } catch (err: any) {
      console.warn('Detect coverage reports error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    detectAndRefresh();
  }, [projectPath]);

  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return files;
    const q = searchQuery.toLowerCase();
    return files.filter(f => f.file_path.toLowerCase().includes(q));
  }, [files, searchQuery]);

  const handleRowClick = (filePath: string) => {
    onOpenFileAtLocation(filePath, 1, 1);
  };

  return (
    <div className="h-full flex flex-col bg-[#1E1F22] text-[#DFE1E5] text-xs select-none">
      {/* Top Action Bar */}
      <div className="h-8 border-b border-[#2B2D30] px-3 flex items-center justify-between bg-[#1E1F22] flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-semibold text-white">
            <ShieldCheck size={14} className="text-[#5BB974]" />
            <span>Coverage</span>
          </div>

          {summary && (
            <div className="flex items-center gap-2 pl-2 border-l border-[#393B40]">
              <span className="font-mono font-bold text-[#5BB974]">{summary.coverage_percent}%</span>
              <span className="text-[#868A91]">
                ({summary.covered_lines}/{summary.total_lines} lines across {summary.total_files} files)
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {detectedReports.length > 1 && (
            <select
              value={selectedReport}
              onChange={(e) => loadReport(e.target.value)}
              className="bg-[#2B2D30] border border-[#393B40] rounded px-2 py-0.5 text-xs text-[#DFE1E5] max-w-[200px] truncate"
            >
              {detectedReports.map((r) => (
                <option key={r} value={r}>
                  {r.split(/[/\\]/).pop()}
                </option>
              ))}
            </select>
          )}

          <div className="relative">
            <Search size={12} className="absolute left-2 top-1.5 text-[#868A91]" />
            <input
              type="text"
              placeholder="Filter file..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-6 pr-2 py-0.5 bg-[#2B2D30] border border-[#393B40] rounded text-xs text-[#DFE1E5] focus:outline-none focus:border-[#3574F0] w-36"
            />
          </div>

          <button
            onClick={detectAndRefresh}
            disabled={isLoading}
            className="p-1 hover:bg-[#2B2D30] text-[#868A91] hover:text-[#DFE1E5] rounded transition-colors"
            title="Rescan project for coverage reports"
          >
            <RotateCw size={13} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto">
        {files.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center text-[#868A91] space-y-3">
            <BarChart3 size={32} className="text-[#4E5157]" />
            <div className="max-w-md">
              <p className="font-medium text-[#DFE1E5] mb-1">No Coverage Data Available</p>
              <p className="text-xs leading-relaxed">
                Run tests with code coverage (e.g., <code className="text-[#85B1F8]">cargo tarpaulin</code>, <code className="text-[#85B1F8]">npm test -- --coverage</code>, or <code className="text-[#85B1F8]">mvn test</code> with JaCoCo). Custom IDEA will automatically detect <code className="text-white">lcov.info</code>, <code className="text-white">jacoco.xml</code>, and highlight covered lines directly in the editor gutter.
              </p>
            </div>
            <button
              onClick={detectAndRefresh}
              className="px-3 py-1 bg-[#3574F0] hover:bg-[#437EEB] text-white rounded text-xs font-medium transition-colors"
            >
              Scan for Reports
            </button>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#1E1F22] border-b border-[#2B2D30] text-[#868A91] text-[11px] uppercase sticky top-0">
              <tr>
                <th className="py-1.5 px-3 font-semibold">Element / File</th>
                <th className="py-1.5 px-3 font-semibold w-48">Line Coverage %</th>
                <th className="py-1.5 px-3 font-semibold w-28 text-right">Lines</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2B2D30]/40">
              {filteredFiles.map((file) => {
                const percent = file.coverage_percent || (file.lines_found > 0 ? Math.round((file.lines_hit / file.lines_found) * 100) : 100);
                const isHigh = percent >= 80;
                const isMedium = percent >= 50 && percent < 80;
                const barColor = isHigh ? 'bg-[#5BB974]' : isMedium ? 'bg-[#E5C07B]' : 'bg-[#E05555]';
                const fileName = file.file_path.split(/[/\\]/).pop() || file.file_path;

                return (
                  <tr
                    key={file.file_path}
                    onDoubleClick={() => handleRowClick(file.file_path)}
                    className="hover:bg-[#2B2D30] cursor-pointer group transition-colors"
                  >
                    <td className="py-1.5 px-3 flex items-center gap-2">
                      <FileCode size={13} className="text-[#868A91] group-hover:text-[#3574F0] flex-shrink-0" />
                      <div className="truncate">
                        <span className="text-[#DFE1E5] font-medium group-hover:text-white">{fileName}</span>
                        <span className="ml-2 text-[11px] text-[#868A91] font-mono">{file.file_path}</span>
                      </div>
                    </td>

                    <td className="py-1.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-[#2B2D30] rounded-full overflow-hidden border border-[#393B40]">
                          <div
                            className={`h-full ${barColor} rounded-full transition-all duration-300`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <span className="font-mono text-xs w-10 text-right">{percent}%</span>
                      </div>
                    </td>

                    <td className="py-1.5 px-3 text-right font-mono text-xs text-[#868A91]">
                      <span className="text-[#DFE1E5]">{file.lines_hit}</span> / {file.lines_found}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
