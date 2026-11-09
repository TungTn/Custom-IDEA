import React, { useState, useEffect, useMemo } from 'react';
import { 
  Globe, 
  Search, 
  RotateCw, 
  Send, 
  FileCode, 
  ExternalLink, 
  CheckCircle2, 
  Filter,
  Layers,
  Copy,
  Terminal
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

export interface ApiEndpointItem {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'ALL';
  path: string;
  handlerName: string;
  filePath: string;
  line: number;
  framework: 'Spring Boot' | 'Express / Node' | 'FastAPI / Python' | 'Rust Actix/Axum' | 'Go Gin';
}

interface EndpointsPanelProps {
  projectPath: string;
  onOpenFileAtLocation: (filePath: string, line: number, col?: number) => void;
  onShowToast?: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const EndpointsPanel: React.FC<EndpointsPanelProps> = ({
  projectPath,
  onOpenFileAtLocation,
  onShowToast,
}) => {
  const [endpoints, setEndpoints] = useState<ApiEndpointItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('ALL');
  const [isScanning, setIsScanning] = useState(false);

  const scanProjectEndpoints = async () => {
    setIsScanning(true);
    const discovered: ApiEndpointItem[] = [];

    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        // Query Spring annotations, Express router, FastAPI, Axum routes
        const queries = [
          'Mapping(',
          'app.get(',
          'app.post(',
          'router.get(',
          'router.post(',
          '@app.get(',
          '@app.post(',
          '#[get(',
          '#[post(',
        ];

        for (const q of queries) {
          const results = await invoke<any[]>('search_project_text', {
            projectPath,
            query: q,
            caseSensitive: true,
            limit: 60,
          }).catch(() => []);

          if (results && Array.isArray(results)) {
            for (const item of results) {
              const line = item.line_text.trim();
              const p = item.file_path;

              // 1. Spring Framework: @GetMapping("/api/...")
              const springMatch = line.match(/@(Get|Post|Put|Delete|Patch|Request)Mapping\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']/i);
              if (springMatch) {
                const method = springMatch[1].toUpperCase() === 'REQUEST' ? 'ALL' : (springMatch[1].toUpperCase() as any);
                discovered.push({
                  id: `ep-${p}-${item.line_number}`,
                  method,
                  path: springMatch[2],
                  handlerName: item.file_name.replace(/\.[^/.]+$/, ''),
                  filePath: p,
                  line: item.line_number,
                  framework: 'Spring Boot',
                });
                continue;
              }

              // 2. Express / Node.js: app.get('/api/users', ...) or router.post('/login', ...)
              const expressMatch = line.match(/(?:app|router)\.(get|post|put|delete|patch)\s*\(\s*["']([^"']+)["']/i);
              if (expressMatch) {
                discovered.push({
                  id: `ep-${p}-${item.line_number}`,
                  method: expressMatch[1].toUpperCase() as any,
                  path: expressMatch[2],
                  handlerName: item.file_name,
                  filePath: p,
                  line: item.line_number,
                  framework: 'Express / Node',
                });
                continue;
              }

              // 3. FastAPI / Flask: @app.get("/items/{id}")
              const pyMatch = line.match(/@(?:app|router)\.(get|post|put|delete|patch|route)\s*\(\s*["']([^"']+)["']/i);
              if (pyMatch) {
                discovered.push({
                  id: `ep-${p}-${item.line_number}`,
                  method: pyMatch[1].toUpperCase() === 'ROUTE' ? 'GET' : (pyMatch[1].toUpperCase() as any),
                  path: pyMatch[2],
                  handlerName: item.file_name,
                  filePath: p,
                  line: item.line_number,
                  framework: 'FastAPI / Python',
                });
                continue;
              }

              // 4. Rust: #[get("/api/v1/health")]
              const rustMatch = line.match(/#\[(get|post|put|delete|patch)\s*\(\s*["']([^"']+)["']/i);
              if (rustMatch) {
                discovered.push({
                  id: `ep-${p}-${item.line_number}`,
                  method: rustMatch[1].toUpperCase() as any,
                  path: rustMatch[2],
                  handlerName: item.file_name,
                  filePath: p,
                  line: item.line_number,
                  framework: 'Rust Actix/Axum',
                });
              }
            }
          }
        }
      }

      // De-duplicate endpoints by key
      const unique = new Map<string, ApiEndpointItem>();
      discovered.forEach(ep => {
        const key = `${ep.method}:${ep.path}:${ep.filePath}:${ep.line}`;
        if (!unique.has(key)) unique.set(key, ep);
      });

      setEndpoints(Array.from(unique.values()));
    } catch (err: any) {
      console.warn('Endpoints scan error:', err);
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    scanProjectEndpoints();
  }, [projectPath]);

  const filteredEndpoints = useMemo(() => {
    let list = endpoints;
    if (methodFilter !== 'ALL') {
      list = list.filter(e => e.method === methodFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(e => e.path.toLowerCase().includes(q) || e.handlerName.toLowerCase().includes(q));
    }
    return list;
  }, [endpoints, methodFilter, searchQuery]);

  const getMethodBadgeClass = (m: string) => {
    switch (m) {
      case 'GET': return 'bg-[#5BB974]/20 text-[#5BB974] border-[#5BB974]/40';
      case 'POST': return 'bg-[#3574F0]/20 text-[#85B1F8] border-[#3574F0]/40';
      case 'PUT': return 'bg-[#EDA200]/20 text-[#EDA200] border-[#EDA200]/40';
      case 'DELETE': return 'bg-[#E05555]/20 text-[#E05555] border-[#E05555]/40';
      case 'PATCH': return 'bg-[#B180D7]/20 text-[#B180D7] border-[#B180D7]/40';
      default: return 'bg-[#868A91]/20 text-[#868A91] border-[#868A91]/40';
    }
  };

  const handleCopyEndpoint = (ep: ApiEndpointItem) => {
    navigator.clipboard.writeText(`${ep.method} ${ep.path}`);
    onShowToast?.('Copied Endpoint', `${ep.method} ${ep.path}`, 'success');
  };

  return (
    <div className="h-full flex flex-col bg-[#1E1F22] text-[#DFE1E5] text-xs select-none">
      {/* Top Toolbar */}
      <div className="h-8 border-b border-[#2B2D30] px-3 flex items-center justify-between bg-[#1E1F22] flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-semibold text-white">
            <Globe size={14} className="text-[#3574F0]" />
            <span>Endpoints</span>
            <span className="px-1.5 py-0.2 bg-[#2B2D30] text-[#85B1F8] rounded text-[10px] font-mono border border-[#393B40]">
              {filteredEndpoints.length} endpoints
            </span>
          </div>

          <div className="flex items-center gap-1 bg-[#2B2D30] rounded p-0.5 border border-[#393B40]">
            {['ALL', 'GET', 'POST', 'PUT', 'DELETE'].map(m => (
              <button
                key={m}
                onClick={() => setMethodFilter(m)}
                className={`px-1.5 py-0.2 rounded text-[10px] font-semibold transition-colors ${
                  methodFilter === m ? 'bg-[#3574F0] text-white' : 'text-[#868A91] hover:text-[#DFE1E5]'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={12} className="absolute left-2 top-1.5 text-[#868A91]" />
            <input
              type="text"
              placeholder="Filter endpoint URL..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-6 pr-2 py-0.5 bg-[#2B2D30] border border-[#393B40] rounded text-xs text-[#DFE1E5] focus:outline-none focus:border-[#3574F0] w-40"
            />
          </div>

          <button
            onClick={scanProjectEndpoints}
            disabled={isScanning}
            className="p-1 hover:bg-[#2B2D30] text-[#868A91] hover:text-[#DFE1E5] rounded transition-colors"
            title="Rescan project web controllers"
          >
            <RotateCw size={13} className={isScanning ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Content Table */}
      <div className="flex-1 overflow-auto">
        {filteredEndpoints.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center text-[#868A91] space-y-2">
            <Globe size={32} className="text-[#4E5157]" />
            <p className="font-medium text-[#DFE1E5]">No Web API Endpoints Discovered</p>
            <p className="text-xs max-w-sm">
              Endpoints Explorer automatically discovers HTTP routes across Spring Boot (@GetMapping, @PostMapping), Express.js, FastAPI, Axum, and Gin controllers.
            </p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#1E1F22] border-b border-[#2B2D30] text-[#868A91] text-[11px] uppercase sticky top-0">
              <tr>
                <th className="py-1.5 px-3 font-semibold w-20">Method</th>
                <th className="py-1.5 px-3 font-semibold">Path / URL</th>
                <th className="py-1.5 px-3 font-semibold w-36">Framework</th>
                <th className="py-1.5 px-3 font-semibold">Handler / Location</th>
                <th className="py-1.5 px-3 font-semibold w-16 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2B2D30]/40">
              {filteredEndpoints.map((ep) => (
                <tr
                  key={ep.id}
                  onDoubleClick={() => onOpenFileAtLocation(ep.filePath, ep.line, 1)}
                  className="hover:bg-[#2B2D30] cursor-pointer group transition-colors"
                >
                  <td className="py-1.5 px-3">
                    <span className={`px-1.5 py-0.5 rounded border text-[10px] font-mono font-bold ${getMethodBadgeClass(ep.method)}`}>
                      {ep.method}
                    </span>
                  </td>

                  <td className="py-1.5 px-3 font-mono text-xs text-white group-hover:text-[#85B1F8] font-medium">
                    {ep.path}
                  </td>

                  <td className="py-1.5 px-3 text-[#868A91] text-xs">
                    {ep.framework}
                  </td>

                  <td className="py-1.5 px-3 text-[#868A91] text-xs truncate max-w-[280px]">
                    <span className="text-[#DFE1E5] font-medium mr-2">{ep.handlerName}</span>
                    <span className="font-mono text-[11px] text-[#868A91]">
                      {ep.filePath.split(/[/\\]/).pop()}:{ep.line}
                    </span>
                  </td>

                  <td className="py-1.5 px-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyEndpoint(ep);
                      }}
                      className="p-1 text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#35373B] rounded transition-colors opacity-0 group-hover:opacity-100"
                      title="Copy endpoint"
                    >
                      <Copy size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
