import React, { useState, useEffect } from 'react';
import { 
  Layers, 
  X, 
  Play, 
  Plus, 
  Trash2, 
  Copy, 
  Folder, 
  Package, 
  FileCode, 
  Terminal, 
  Check, 
  ChevronRight,
  Flame,
  Coffee,
  Zap
} from 'lucide-react';
import { RunConfiguration, RunConfigType } from '../../types';
import { invoke } from '@tauri-apps/api/core';

interface RunConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  configurations: RunConfiguration[];
  activeConfigId: string | null;
  onSaveConfigurations: (configs: RunConfiguration[], selectedId: string) => void;
  onRunSelected: (config: RunConfiguration) => void;
  projectRootPath: string;
}

const TEMPLATES: { type: RunConfigType; label: string; defaultCmd: string; defaultArgs: string[]; desc: string }[] = [
  {
    type: 'spring-boot',
    label: 'Spring Boot',
    defaultCmd: 'mvn.cmd',
    defaultArgs: ['spring-boot:run'],
    desc: 'Runs a Spring Boot application using the Spring Boot Maven Plugin.',
  },
  {
    type: 'maven',
    label: 'Maven',
    defaultCmd: 'mvn.cmd',
    defaultArgs: ['clean', 'compile'],
    desc: 'Executes standard Maven lifecycle goals and phases.',
  },
  {
    type: 'gradle',
    label: 'Gradle',
    defaultCmd: 'gradlew.bat',
    defaultArgs: ['bootRun'],
    desc: 'Executes Gradle tasks (e.g., bootRun, build, test).',
  },
  {
    type: 'cargo',
    label: 'Cargo',
    defaultCmd: 'cargo',
    defaultArgs: ['run'],
    desc: 'Compiles and runs a Rust binary crate with Cargo.',
  },
  {
    type: 'npm',
    label: 'npm',
    defaultCmd: 'npm',
    defaultArgs: ['run', 'dev'],
    desc: 'Runs npm scripts defined in package.json (e.g., dev, start, build).',
  },
  {
    type: 'python',
    label: 'Python',
    defaultCmd: 'python',
    defaultArgs: ['main.py'],
    desc: 'Executes a Python script in the configured environment.',
  },
  {
    type: 'custom',
    label: 'Shell / Custom Script',
    defaultCmd: 'cmd.exe',
    defaultArgs: ['/c', 'echo "Hello World"'],
    desc: 'Executes an arbitrary shell command or script.',
  },
];

export const RunConfigModal: React.FC<RunConfigModalProps> = ({
  isOpen,
  onClose,
  configurations,
  activeConfigId,
  onSaveConfigurations,
  onRunSelected,
  projectRootPath,
}) => {
  const [configs, setConfigs] = useState<RunConfiguration[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);

  // Form states for selected configuration
  const [name, setName] = useState('');
  const [command, setCommand] = useState('');
  const [argsString, setArgsString] = useState('');
  const [workingDirectory, setWorkingDirectory] = useState('');
  const [envVarsString, setEnvVarsString] = useState('');

  // Sync state when opening
  useEffect(() => {
    if (isOpen) {
      if (configurations.length > 0) {
        setConfigs([...configurations]);
        const initialSelected = activeConfigId || configurations[0].id;
        setSelectedId(initialSelected);
        loadConfigIntoForm(configurations.find(c => c.id === initialSelected) || configurations[0]);
      } else {
        setConfigs([]);
        setSelectedId(null);
      }
    }
  }, [isOpen, configurations, activeConfigId, projectRootPath]);

  const loadConfigIntoForm = (cfg: RunConfiguration) => {
    setName(cfg.name);
    setCommand(cfg.command);
    setArgsString(cfg.args.join(' '));
    setWorkingDirectory(cfg.workingDirectory || projectRootPath || '');
    if (cfg.envVars) {
      const formatted = Object.entries(cfg.envVars)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
      setEnvVarsString(formatted);
    } else {
      setEnvVarsString('');
    }
  };

  const selectedConfig = configs.find(c => c.id === selectedId);

  // Update selected configuration in configs array when form fields change
  const updateCurrentConfig = (overrides: Partial<RunConfiguration>) => {
    if (!selectedId) return;
    setConfigs(prev => prev.map(c => {
      if (c.id === selectedId) {
        return { ...c, ...overrides };
      }
      return c;
    }));
  };

  const handleNameChange = (val: string) => {
    setName(val);
    updateCurrentConfig({ name: val });
  };

  const handleCommandChange = (val: string) => {
    setCommand(val);
    updateCurrentConfig({ command: val });
  };

  const handleArgsChange = (val: string) => {
    setArgsString(val);
    const parsedArgs = val.split(' ').map(s => s.trim()).filter(Boolean);
    updateCurrentConfig({ args: parsedArgs });
  };

  const handleWorkDirChange = (val: string) => {
    setWorkingDirectory(val);
    updateCurrentConfig({ workingDirectory: val });
  };

  const handleEnvVarsChange = (val: string) => {
    setEnvVarsString(val);
    const envObj: Record<string, string> = {};
    // Support both comma (,) and semicolon (;) delimiters
    val.split(/[,;]/).forEach(part => {
      const trimmed = part.trim();
      if (!trimmed) return;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const k = trimmed.slice(0, idx).trim();
        const v = trimmed.slice(idx + 1).trim();
        if (k) envObj[k] = v;
      } else {
        envObj[trimmed] = '';
      }
    });
    updateCurrentConfig({ envVars: envObj });
  };

  const handleSelectConfig = (cfg: RunConfiguration) => {
    setSelectedId(cfg.id);
    loadConfigIntoForm(cfg);
  };

  const handleAddNew = (tmpl: typeof TEMPLATES[0]) => {
    const newCfg: RunConfiguration = {
      id: `cfg-${Date.now()}`,
      name: `${tmpl.label} Application`,
      type: tmpl.type,
      command: tmpl.defaultCmd,
      args: [...tmpl.defaultArgs],
      workingDirectory: projectRootPath || 'D:\\IDE',
      envVars: tmpl.type === 'spring-boot' ? { 'SPRING_PROFILES_ACTIVE': 'dev' } : undefined,
    };
    const nextConfigs = [...configs, newCfg];
    setConfigs(nextConfigs);
    setSelectedId(newCfg.id);
    loadConfigIntoForm(newCfg);
    setIsAddMenuOpen(false);
  };

  const handleDelete = () => {
    if (!selectedId || configs.length <= 1) return;
    const next = configs.filter(c => c.id !== selectedId);
    setConfigs(next);
    setSelectedId(next[0].id);
    loadConfigIntoForm(next[0]);
  };

  const handleDuplicate = () => {
    if (!selectedConfig) return;
    const dup: RunConfiguration = {
      ...selectedConfig,
      id: `cfg-${Date.now()}`,
      name: `${selectedConfig.name} (Copy)`,
    };
    const next = [...configs, dup];
    setConfigs(next);
    setSelectedId(dup.id);
    loadConfigIntoForm(dup);
  };

  const handleBrowseFolder = async () => {
    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        const picked = await invoke<string | null>('select_directory', { defaultPath: workingDirectory });
        if (picked) {
          handleWorkDirChange(picked);
        }
      }
    } catch (e) {
      console.warn('Folder picker failed:', e);
    }
  };

  const handleApply = () => {
    if (selectedId) {
      onSaveConfigurations(configs, selectedId);
    }
  };

  const handleOk = () => {
    handleApply();
    onClose();
  };

  const handleRun = () => {
    handleApply();
    if (selectedConfig) {
      onRunSelected(selectedConfig);
    }
    onClose();
  };

  const getConfigIcon = (type: RunConfigType) => {
    switch (type) {
      case 'spring-boot':
        return <Flame size={14} className="text-[#6DB33F] flex-shrink-0" />;
      case 'maven':
        return <Coffee size={14} className="text-[#C71A36] flex-shrink-0" />;
      case 'gradle':
        return <FileCode size={14} className="text-[#59A869] flex-shrink-0" />;
      case 'cargo':
        return <Package size={14} className="text-[#E5533D] flex-shrink-0" />;
      case 'npm':
        return <Package size={14} className="text-[#CB3837] flex-shrink-0" />;
      case 'python':
        return <Terminal size={14} className="text-[#3574F0] flex-shrink-0" />;
      default:
        return <Play size={14} className="text-[#DFE1E5] flex-shrink-0" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-[2px] flex items-center justify-center z-50 select-none animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div 
        className="w-[820px] h-[540px] bg-[#1E1F22] border border-[#2B2D30] rounded-xl shadow-2xl overflow-hidden flex flex-col font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header (IntelliJ Style) */}
        <div className="h-10 bg-[#1E1F22] border-b border-[#2B2D30] px-4 flex items-center justify-between text-[#DFE1E5]">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <Layers size={15} className="text-[#3574F0]" />
            <span>Run / Debug Configurations</span>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 hover:bg-[#2B2D30] rounded text-[#868A91] hover:text-[#DFE1E5] transition-colors cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>

        {/* Modal Split Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Configurations Tree & Actions (~240px) */}
          <div className="w-60 bg-[#1E1F22] border-r border-[#2B2D30] flex flex-col overflow-hidden">
            {/* Top mini toolbar: Add, Remove, Copy */}
            <div className="h-8 bg-[#1E1F22] border-b border-[#2B2D30] px-2 flex items-center gap-1 relative text-[#868A91]">
              <button
                onClick={() => setIsAddMenuOpen(prev => !prev)}
                title="Add New Configuration (Alt+Insert)"
                className="p-1 hover:bg-[#2B2D30] hover:text-white rounded transition-colors cursor-pointer"
              >
                <Plus size={13} className="text-[#3574F0]" />
              </button>
              <button
                onClick={handleDelete}
                disabled={configs.length <= 1}
                title="Remove Selected Configuration (Delete)"
                className={`p-1 rounded transition-colors ${
                  configs.length <= 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-[#2B2D30] hover:text-[#E05555] cursor-pointer'
                }`}
              >
                <Trash2 size={13} />
              </button>
              <button
                onClick={handleDuplicate}
                title="Duplicate Configuration"
                className="p-1 hover:bg-[#2B2D30] hover:text-white rounded transition-colors cursor-pointer"
              >
                <Copy size={13} />
              </button>

              {/* Add New Configuration Dropdown */}
              {isAddMenuOpen && (
                <div className="absolute left-2 top-full mt-1 w-56 bg-[#222427] border border-[#323438] rounded-lg shadow-2xl py-1 z-50 text-xs">
                  <div className="px-3 py-1 text-[10px] uppercase font-bold text-[#868A91] tracking-wider border-b border-[#323438]">
                    Add New Configuration
                  </div>
                  {TEMPLATES.map(t => (
                    <div
                      key={t.type}
                      onClick={() => handleAddNew(t)}
                      className="px-3 py-2 hover:bg-[#2B2D30] cursor-pointer flex items-center gap-2 text-[#DFE1E5] transition-colors"
                    >
                      {getConfigIcon(t.type)}
                      <span>{t.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* List of configured runs */}
            <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
              {configs.length === 0 ? (
                <div className="py-8 px-2 text-center text-[#868A91] text-[11px]">
                  No configurations added. Click + above to create one.
                </div>
              ) : (
                configs.map(cfg => {
                  const isSelected = cfg.id === selectedId;
                  return (
                    <div
                      key={cfg.id}
                      onClick={() => handleSelectConfig(cfg)}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded cursor-pointer text-xs transition-colors ${
                        isSelected
                          ? 'bg-[#2E436E] text-white font-medium'
                          : 'text-[#DFE1E5] hover:bg-[#2B2D30]'
                      }`}
                    >
                      {getConfigIcon(cfg.type)}
                      <span className="truncate flex-1">{cfg.name}</span>
                      {cfg.isDefault && (
                        <span className="text-[9px] px-1 bg-[#3574F0]/30 text-[#85B1F8] rounded">Default</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Pane: Configuration Details Form */}
          {selectedConfig ? (
            <div className="flex-1 bg-[#1E1F22] p-5 overflow-y-auto space-y-4 text-xs text-[#DFE1E5]">
              {/* Configuration Name */}
              <div>
                <label className="text-[11px] font-medium text-[#868A91] block mb-1">Name:</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full bg-[#222427] border border-[#323438] focus:border-[#3574F0] rounded px-3 py-1.5 text-xs text-[#DFE1E5] outline-none transition-colors"
                  placeholder="e.g. Spring Boot Backend"
                />
              </div>

              {/* Type Badge & Description */}
              <div className="p-2.5 bg-[#222427] border border-[#323438] rounded-lg flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2 font-medium">
                  {getConfigIcon(selectedConfig.type)}
                  <span className="capitalize">{selectedConfig.type} Runner</span>
                </div>
                <span className="text-[#868A91]">
                  {TEMPLATES.find(t => t.type === selectedConfig.type)?.desc}
                </span>
              </div>

              {/* Command */}
              <div>
                <label className="text-[11px] font-medium text-[#868A91] block mb-1">
                  Executable / Command:
                </label>
                <input
                  type="text"
                  value={command}
                  onChange={(e) => handleCommandChange(e.target.value)}
                  className="w-full bg-[#222427] border border-[#323438] focus:border-[#3574F0] rounded px-3 py-1.5 text-xs text-[#DFE1E5] font-mono outline-none transition-colors"
                  placeholder="mvn.cmd / cargo / npm / python"
                />
              </div>

              {/* Arguments */}
              <div>
                <label className="text-[11px] font-medium text-[#868A91] block mb-1">
                  Program Arguments:
                </label>
                <input
                  type="text"
                  value={argsString}
                  onChange={(e) => handleArgsChange(e.target.value)}
                  className="w-full bg-[#222427] border border-[#323438] focus:border-[#3574F0] rounded px-3 py-1.5 text-xs text-[#DFE1E5] font-mono outline-none transition-colors"
                  placeholder="e.g. spring-boot:run, run, dev, test"
                />
                <span className="text-[10px] text-[#868A91] mt-0.5 block">Separate arguments with spaces. Example for Spring Boot: <code className="text-[#59A869]">spring-boot:run</code></span>
              </div>

              {/* Working Directory */}
              <div>
                <label className="text-[11px] font-medium text-[#868A91] block mb-1">
                  Working Directory:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={workingDirectory}
                    onChange={(e) => handleWorkDirChange(e.target.value)}
                    className="flex-1 bg-[#222427] border border-[#323438] focus:border-[#3574F0] rounded px-3 py-1.5 text-xs text-[#DFE1E5] font-mono outline-none transition-colors"
                  />
                  <button
                    onClick={handleBrowseFolder}
                    className="px-2.5 py-1.5 bg-[#222427] hover:bg-[#2B2D30] border border-[#323438] text-[#DFE1E5] rounded text-xs flex items-center gap-1 cursor-pointer transition-colors"
                    title="Browse Folder"
                  >
                    <Folder size={12} className="text-[#E5A83B]" />
                    <span>...</span>
                  </button>
                </div>
              </div>

              {/* Environment Variables */}
              <div>
                <label className="text-[11px] font-medium text-[#868A91] block mb-1">
                  Environment Variables:
                </label>
                <input
                  type="text"
                  value={envVarsString}
                  onChange={(e) => handleEnvVarsChange(e.target.value)}
                  className="w-full bg-[#222427] border border-[#323438] focus:border-[#3574F0] rounded px-3 py-1.5 text-xs text-[#DFE1E5] font-mono outline-none transition-colors"
                  placeholder="SPRING_PROFILES_ACTIVE=dev; PORT=8080"
                />
                <span className="text-[10px] text-[#868A91] mt-0.5 block">Format: <code className="text-[#3574F0]">KEY=VALUE; KEY2=VALUE2</code></span>
              </div>

              {/* JVM Memory & Performance Optimization (for Java / Spring Boot / Maven / Gradle) */}
              {(selectedConfig.type === 'spring-boot' || selectedConfig.type === 'maven' || selectedConfig.type === 'gradle' || command.toLowerCase().includes('java') || command.toLowerCase().includes('mvn')) && (
                <div className="p-3 bg-[#222427]/70 border border-[#3574F0]/30 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-medium text-[#DFE1E5]">
                      <Zap size={13} className="text-[#E5A83B]" />
                      <span>Tối ưu Bộ Nhớ JVM & Tốc Độ Khởi Động</span>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#59A869]/20 text-[#59A869] border border-[#59A869]/30 font-medium">
                      Tiết kiệm ~65% RAM
                    </span>
                  </div>
                  <p className="text-[11px] text-[#868A91] leading-relaxed">
                    Tùy chỉnh mức RAM cho JVM & Maven. Với dự án lớn nhiều file (&gt;500 file như <b className="text-[#DFE1E5]">mic-vehicles 681 files</b>), nên chọn <b className="text-[#71C482]">Tiêu Chuẩn (1024MB)</b> hoặc <b className="text-[#85B1F8]">Dự Án Lớn (1536MB)</b> để trình biên dịch javac không bị lỗi <i>OutOfMemoryError</i>.
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {/* Preset 1024MB (Tiêu Chuẩn) */}
                    <button
                      type="button"
                      onClick={() => {
                        let newEnv = envVarsString;
                        if (newEnv.includes('JAVA_TOOL_OPTIONS')) {
                          newEnv = newEnv.replace(/JAVA_TOOL_OPTIONS=[^;]+/, 'JAVA_TOOL_OPTIONS=-Xms128m -Xmx1024m -Xss512k -XX:TieredStopAtLevel=1 -XX:MaxMetaspaceSize=384m -XX:ReservedCodeCacheSize=128m');
                        } else {
                          newEnv = newEnv ? `${newEnv}; JAVA_TOOL_OPTIONS=-Xms128m -Xmx1024m -Xss512k -XX:TieredStopAtLevel=1 -XX:MaxMetaspaceSize=384m -XX:ReservedCodeCacheSize=128m` : 'JAVA_TOOL_OPTIONS=-Xms128m -Xmx1024m -Xss512k -XX:TieredStopAtLevel=1 -XX:MaxMetaspaceSize=384m -XX:ReservedCodeCacheSize=128m';
                        }
                        if (newEnv.includes('MAVEN_OPTS')) {
                          newEnv = newEnv.replace(/MAVEN_OPTS=[^;]+/, 'MAVEN_OPTS=-Xms64m -Xmx256m');
                        } else {
                          newEnv = `${newEnv}; MAVEN_OPTS=-Xms64m -Xmx256m`;
                        }
                        handleEnvVarsChange(newEnv);
                      }}
                      className="px-2.5 py-1 bg-[#59A869]/20 hover:bg-[#59A869]/30 border border-[#59A869]/40 text-[#71C482] rounded text-[11px] font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
                      title="Mức đề xuất chuẩn cho hầu hết dự án Spring Boot (Compile 500-1000 files mượt mà)"
                    >
                      <Zap size={11} className="text-[#71C482]" />
                      <span>🎯 Tiêu Chuẩn (1024MB)</span>
                    </button>

                    {/* Preset 1536MB (Dự Án Lớn) */}
                    <button
                      type="button"
                      onClick={() => {
                        let newEnv = envVarsString;
                        if (newEnv.includes('JAVA_TOOL_OPTIONS')) {
                          newEnv = newEnv.replace(/JAVA_TOOL_OPTIONS=[^;]+/, 'JAVA_TOOL_OPTIONS=-Xms256m -Xmx1536m -Xss512k -XX:MaxMetaspaceSize=512m -XX:ReservedCodeCacheSize=128m');
                        } else {
                          newEnv = newEnv ? `${newEnv}; JAVA_TOOL_OPTIONS=-Xms256m -Xmx1536m -Xss512k -XX:MaxMetaspaceSize=512m -XX:ReservedCodeCacheSize=128m` : 'JAVA_TOOL_OPTIONS=-Xms256m -Xmx1536m -Xss512k -XX:MaxMetaspaceSize=512m -XX:ReservedCodeCacheSize=128m';
                        }
                        if (newEnv.includes('MAVEN_OPTS')) {
                          newEnv = newEnv.replace(/MAVEN_OPTS=[^;]+/, 'MAVEN_OPTS=-Xms128m -Xmx512m');
                        } else {
                          newEnv = `${newEnv}; MAVEN_OPTS=-Xms128m -Xmx512m`;
                        }
                        handleEnvVarsChange(newEnv);
                      }}
                      className="px-2.5 py-1 bg-[#3574F0]/20 hover:bg-[#3574F0]/30 border border-[#3574F0]/40 text-[#85B1F8] rounded text-[11px] font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
                      title="Dành riêng cho dự án lớn (>500 source files như mic-vehicles) để biên dịch không bị tràn RAM"
                    >
                      <Zap size={11} className="text-[#3574F0]" />
                      <span>🚀 Dự Án Lớn (1536MB)</span>
                    </button>

                    {/* Preset 512MB */}
                    <button
                      type="button"
                      onClick={() => {
                        let newEnv = envVarsString;
                        if (newEnv.includes('JAVA_TOOL_OPTIONS')) {
                          newEnv = newEnv.replace(/JAVA_TOOL_OPTIONS=[^;]+/, 'JAVA_TOOL_OPTIONS=-Xms64m -Xmx512m -XX:+TieredCompilation -XX:TieredStopAtLevel=1');
                        } else {
                          newEnv = newEnv ? `${newEnv}; JAVA_TOOL_OPTIONS=-Xms64m -Xmx512m -XX:+TieredCompilation -XX:TieredStopAtLevel=1` : 'JAVA_TOOL_OPTIONS=-Xms64m -Xmx512m -XX:+TieredCompilation -XX:TieredStopAtLevel=1';
                        }
                        if (newEnv.includes('MAVEN_OPTS')) {
                          newEnv = newEnv.replace(/MAVEN_OPTS=[^;]+/, 'MAVEN_OPTS=-Xms64m -Xmx128m');
                        } else {
                          newEnv = `${newEnv}; MAVEN_OPTS=-Xms64m -Xmx128m`;
                        }
                        handleEnvVarsChange(newEnv);
                      }}
                      className="px-2.5 py-1 bg-[#2B2D30] hover:bg-[#323438] border border-[#4E5157]/40 text-[#DFE1E5] rounded text-[11px] font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
                      title="Tiết kiệm RAM cho dự án vừa & nhỏ"
                    >
                      <span>⚡ Tiết Kiệm (512MB)</span>
                    </button>

                    {/* Reset: Không giới hạn (Mặc định JVM) */}
                    <button
                      type="button"
                      onClick={() => {
                        let newEnv = envVarsString
                          .replace(/JAVA_TOOL_OPTIONS=[^;]+;?/g, '')
                          .replace(/MAVEN_OPTS=[^;]+;?/g, '')
                          .trim()
                          .replace(/^;\s*|;\s*$/g, '');
                        handleEnvVarsChange(newEnv);
                      }}
                      className="px-2.5 py-1 bg-[#2B2D30] hover:bg-[#323438] border border-[#4E5157]/40 text-[#868A91] hover:text-white rounded text-[11px] font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
                      title="Xóa giới hạn để JVM tự phân bổ RAM theo phần cứng máy tính"
                    >
                      <span>Mặc Định Hệ Thống</span>
                    </button>

                    {envVarsString.includes('-Xmx1536m') && (
                      <span className="text-[11px] text-[#85B1F8] font-medium flex items-center gap-1 ml-auto">
                        ✓ Đang chạy Dự Án Lớn (1536MB)
                      </span>
                    )}
                    {envVarsString.includes('-Xmx1024m') && (
                      <span className="text-[11px] text-[#71C482] font-medium flex items-center gap-1 ml-auto">
                        ✓ Đang chạy Tiêu Chuẩn (1024MB)
                      </span>
                    )}
                    {envVarsString.includes('-Xmx512m') && !envVarsString.includes('-Xmx1536m') && (
                      <span className="text-[11px] text-[#DFE1E5] font-medium flex items-center gap-1 ml-auto">
                        ✓ Đang chạy Tiết Kiệm (512MB)
                      </span>
                    )}
                    {envVarsString.includes('-Xmx384m') && (
                      <span className="text-[11px] text-[#E5A83B] font-medium flex items-center gap-1 ml-auto">
                        ⚠ Đang chạy Giới Hạn 384MB (Dễ OOM)
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-[#868A91] text-xs">
              Select or add a run configuration on the left.
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="h-11 bg-[#1E1F22] border-t border-[#2B2D30] px-4 flex items-center justify-between text-xs">
          <div className="text-[11px] text-[#868A91]">
            Press <kbd className="px-1 py-0.5 bg-[#222427] border border-[#323438] rounded text-white">Shift+F10</kbd> to run directly from anywhere.
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded text-xs text-[#DFE1E5] hover:bg-[#2B2D30] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="px-3.5 py-1.5 rounded text-xs text-[#DFE1E5] hover:bg-[#2B2D30] border border-[#323438] transition-colors cursor-pointer"
            >
              Apply
            </button>
            <button
              onClick={handleOk}
              className="px-4 py-1.5 rounded text-xs text-white bg-[#3574F0] hover:bg-[#3069D9] font-medium transition-colors cursor-pointer"
            >
              OK
            </button>
            <button
              onClick={handleRun}
              className="px-4 py-1.5 rounded text-xs text-white bg-[#59A869] hover:bg-[#4E9B5E] font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow"
            >
              <Play size={12} className="fill-white" />
              <span>Run</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
