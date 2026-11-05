import React, { useState, useEffect } from 'react';
import { 
  X, 
  Hammer, 
  RotateCw, 
  CheckCircle2, 
  AlertTriangle, 
  ExternalLink, 
  Package, 
  Folder, 
  FileCode, 
  Coffee, 
  Flame, 
  Cloud, 
  Cpu, 
  Check, 
  Terminal
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

interface ToolchainsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectPath: string;
  onShowToast?: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

interface DetectedToolchain {
  id: string;
  name: string;
  category: 'System' | 'Language' | 'DevOps';
  version?: string;
  executable: string;
  detected: boolean;
  icon: any;
  buildFiles: string[];
  desc: string;
}

export const ToolchainsModal: React.FC<ToolchainsModalProps> = ({
  isOpen,
  onClose,
  projectPath,
  onShowToast,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [toolchains, setToolchains] = useState<DetectedToolchain[]>([
    {
      id: 'rust',
      name: 'Rust & Cargo Toolchain',
      category: 'Language',
      executable: 'cargo / rustc',
      detected: true,
      version: 'rustc 1.83.0 / cargo 1.83.0',
      icon: Cpu,
      buildFiles: ['Cargo.toml', 'Cargo.lock'],
      desc: 'Compiles native Tauri desktop application and Rust crates'
    },
    {
      id: 'node',
      name: 'Node.js & npm / Vite',
      category: 'Language',
      executable: 'node / npm',
      detected: true,
      version: 'v22.17.0',
      icon: Package,
      buildFiles: ['package.json', 'vite.config.ts', 'tsconfig.json'],
      desc: 'Compiles frontend React, TypeScript, and Monaco editor'
    },
    {
      id: 'java',
      name: 'Java Development Kit (JDK)',
      category: 'Language',
      executable: 'javac / java',
      detected: false,
      icon: Coffee,
      buildFiles: ['pom.xml', 'build.gradle'],
      desc: 'Compiles Spring Boot, Maven, and Gradle applications'
    },
    {
      id: 'python',
      name: 'Python Environment',
      category: 'Language',
      executable: 'python / pip',
      detected: false,
      icon: Terminal,
      buildFiles: ['requirements.txt', 'pyproject.toml'],
      desc: 'Runs Python scripts, virtualenvs, and data science workloads'
    },
    {
      id: 'git',
      name: 'Git Version Control',
      category: 'System',
      executable: 'git',
      detected: true,
      version: 'git version 2.45.0',
      icon: FileCode,
      buildFiles: ['.git'],
      desc: 'Source control versioning, branches, commits, and diff inspection'
    },
    {
      id: 'docker',
      name: 'Docker Engine & Compose',
      category: 'DevOps',
      executable: 'docker',
      detected: false,
      icon: Cloud,
      buildFiles: ['Dockerfile', 'docker-compose.yml'],
      desc: 'Builds, runs and debugs multi-container service configurations'
    }
  ]);

  const fetchToolchains = async () => {
    setIsLoading(true);
    try {
      const res: any = await invoke('detect_toolchains');
      setToolchains(prev => prev.map(t => {
        if (t.id === 'rust') {
          const v = [res.rust, res.cargo].filter(Boolean).join(' | ');
          return { ...t, detected: Boolean(res.rust || res.cargo), version: v || t.version };
        }
        if (t.id === 'node') {
          return { ...t, detected: Boolean(res.node), version: res.node || t.version };
        }
        if (t.id === 'java') {
          return { ...t, detected: Boolean(res.java), version: res.java || undefined };
        }
        if (t.id === 'python') {
          return { ...t, detected: Boolean(res.python), version: res.python || undefined };
        }
        return t;
      }));
      onShowToast?.('Toolchains Refreshed', 'Successfully scanned system SDKs and compilers', 'success');
    } catch (e) {
      console.warn('Failed to detect toolchains:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchToolchains();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const detectedCount = toolchains.filter(t => t.detected).length;

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-50 select-none animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div 
        className="w-[720px] max-h-[580px] bg-[#2B2D30] border border-[#393B40] rounded-lg shadow-2xl flex flex-col overflow-hidden text-[#DFE1E5]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-10 bg-[#212226] border-b border-[#393B40] px-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <Hammer size={16} className="text-[#3574F0]" />
            <span className="text-sm font-semibold text-white">Project SDKs & Build Toolchains</span>
            <span className="text-[10px] bg-[#3574F0]/20 text-[#3574F0] px-2 py-0.5 rounded font-mono font-medium">
              {detectedCount} Active
            </span>
          </div>
          <button 
            onClick={onClose}
            className="text-[#868A91] hover:text-white p-1 rounded hover:bg-[#35373B] transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Action Header Banner */}
        <div className="px-4 py-3 bg-[#26282B] border-b border-[#393B40] flex items-center justify-between flex-shrink-0">
          <div>
            <div className="text-xs font-medium text-white">
              Project Root: <span className="text-[#868A91] font-mono">{projectPath || 'D:\\IDE'}</span>
            </div>
            <p className="text-[11px] text-[#868A91]">
              IntelliJ automatically detects compilers, package managers, and build manifests to configure Run/Debug configurations.
            </p>
          </div>
          <button
            onClick={fetchToolchains}
            disabled={isLoading}
            className="px-2.5 py-1 text-xs bg-[#35373B] hover:bg-[#43454A] text-[#DFE1E5] rounded flex items-center gap-1.5 transition-colors font-medium flex-shrink-0"
          >
            <RotateCw size={12} className={isLoading ? 'animate-spin' : ''} />
            Scan System
          </button>
        </div>

        {/* Toolchains List */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1">
          {toolchains.map((tool) => {
            const Icon = tool.icon;

            return (
              <div
                key={tool.id}
                className={`p-3.5 rounded-lg border transition-all flex items-start justify-between ${
                  tool.detected
                    ? 'border-[#393B40] bg-[#212226]'
                    : 'border-[#393B40]/60 bg-[#212226]/40 opacity-70'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${tool.detected ? 'bg-[#3574F0]/15 text-[#3574F0]' : 'bg-[#393B40] text-[#868A91]'}`}>
                    <Icon size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-white">{tool.name}</span>
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-white/10 text-[#868A91]">
                        {tool.category}
                      </span>
                    </div>
                    <p className="text-xs text-[#868A91] mb-2">{tool.desc}</p>
                    
                    <div className="flex items-center gap-3 text-[11px] font-mono">
                      <span className="text-[#DFE1E5]">
                        Executable: <code className="text-[#3574F0]">{tool.executable}</code>
                      </span>
                      {tool.version && (
                        <span className="text-[#59A869] font-medium flex items-center gap-1">
                          <CheckCircle2 size={11} />
                          {tool.version}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 mt-2">
                      <span className="text-[10px] text-[#868A91]">Build Files:</span>
                      {tool.buildFiles.map(bf => (
                        <span key={bf} className="text-[10px] bg-[#1E1F22] border border-[#393B40] px-1.5 py-0.2 rounded text-[#DFE1E5] font-mono">
                          {bf}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  {tool.detected ? (
                    <span className="text-[11px] bg-[#59A869]/20 text-[#59A869] px-2 py-0.5 rounded font-mono font-medium flex items-center gap-1">
                      <Check size={12} />
                      Configured
                    </span>
                  ) : (
                    <span className="text-[11px] bg-[#EDA200]/20 text-[#EDA200] px-2 py-0.5 rounded font-mono font-medium flex items-center gap-1">
                      <AlertTriangle size={12} />
                      Not Detected
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="h-12 bg-[#212226] border-t border-[#393B40] px-4 flex items-center justify-between flex-shrink-0">
          <div className="text-xs text-[#868A91]">
            To configure custom SDK paths, update your system <code className="text-white">PATH</code> or IDE environment variables.
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded text-xs bg-[#3574F0] hover:bg-[#3574F0]/90 text-white font-medium shadow-sm transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
