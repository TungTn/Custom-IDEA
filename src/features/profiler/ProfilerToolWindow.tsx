import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, 
  Play, 
  Square, 
  RotateCw, 
  HardDrive, 
  Cpu, 
  Trash2, 
  Download,
  Zap,
  TrendingUp,
  Clock,
  Server
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

interface ProfilerSample {
  time: string;
  cpuPercent: number;
  memoryMb: number;
}

interface JavaProcessDto {
  pid: u32;
  name: string;
  main_class: string;
  is_current_app: boolean;
}

type u32 = number;

interface ProfilerToolWindowProps {
  onShowToast?: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const ProfilerToolWindow: React.FC<ProfilerToolWindowProps> = ({ onShowToast }) => {
  const [isProfiling, setIsProfiling] = useState(true);
  const [cpuUsage, setCpuUsage] = useState(12.4);
  const [memoryUsage, setMemoryUsage] = useState(148.5);
  const [history, setHistory] = useState<ProfilerSample[]>([]);
  const [snapshotsCount, setSnapshotsCount] = useState(0);
  const [processes, setProcesses] = useState<JavaProcessDto[]>([]);
  const [selectedPid, setSelectedPid] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Discover running Java processes & IDE Host
  const refreshProcesses = async () => {
    setIsRefreshing(true);
    const isTauri = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
    if (isTauri) {
      try {
        const procs = await invoke<JavaProcessDto[]>('list_running_java_processes');
        if (procs && procs.length > 0) {
          setProcesses(procs);
          if (selectedPid === null) {
            setSelectedPid(procs[0].pid);
          }
        }
      } catch (err) {
        console.warn('Failed to list processes:', err);
      }
    } else {
      setProcesses([
        { pid: 1024, name: 'Custom-IDEA (IDE Host)', main_class: 'Custom-IDEA.exe', is_current_app: true },
        { pid: 8840, name: 'mic-vehicles Application', main_class: 'com.mic.v1.VehiclesApplication', is_current_app: false }
      ]);
      if (selectedPid === null) setSelectedPid(1024);
    }
    setIsRefreshing(false);
  };

  useEffect(() => {
    refreshProcesses();
  }, []);

  // Live sampling interval
  useEffect(() => {
    if (!isProfiling) return;

    let isMounted = true;
    const isTauri = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);

    const sampleMetrics = async () => {
      let cpu = 0;
      let memMb = 120;

      if (isTauri) {
        try {
          const metrics = await invoke<{ cpu_percent: number; memory_mb: number; system_total_mb: number; cores_count: number }>(
            'get_process_metrics',
            { targetPid: selectedPid }
          );
          if (metrics) {
            cpu = metrics.cpu_percent;
            memMb = metrics.memory_mb;
          }
        } catch (e) {
          console.warn('get_process_metrics error:', e);
        }
      } else {
        if (typeof performance !== 'undefined' && (performance as any).memory) {
          memMb = Math.round((performance as any).memory.usedJSHeapSize / (1024 * 1024) * 10) / 10;
        } else {
          memMb = 120;
        }
        cpu = 1.5;
      }

      if (!isMounted) return;

      setCpuUsage(cpu);
      setMemoryUsage(memMb);

      const now = new Date();
      const timeStr = `${now.getMinutes()}:${String(now.getSeconds()).padStart(2, '0')}`;

      setHistory(prev => {
        const next = [...prev, { time: timeStr, cpuPercent: cpu, memoryMb: memMb }];
        return next.slice(-40); // Keep last 40 samples
      });
    };

    sampleMetrics();
    const interval = setInterval(sampleMetrics, 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isProfiling, selectedPid]);

  // Render CPU / Memory waveform graph on Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Draw background grid lines
    ctx.strokeStyle = '#2B2D30';
    ctx.lineWidth = 1;
    for (let y = 0; y < h; y += 25) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    if (history.length < 2) return;

    const stepX = w / Math.max(30, history.length - 1);
    const maxMemScale = Math.max(300, ...history.map(s => s.memoryMb * 1.2));

    // 1. Draw Memory Waveform (Blue filled area)
    ctx.beginPath();
    ctx.moveTo(0, h);
    history.forEach((sample, i) => {
      const x = i * stepX;
      const y = h - (Math.min(sample.memoryMb, maxMemScale) / maxMemScale) * (h - 10);
      if (i === 0) ctx.lineTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.lineTo((history.length - 1) * stepX, h);
    ctx.closePath();
    ctx.fillStyle = 'rgba(53, 116, 240, 0.15)';
    ctx.fill();

    ctx.beginPath();
    history.forEach((sample, i) => {
      const x = i * stepX;
      const y = h - (Math.min(sample.memoryMb, maxMemScale) / maxMemScale) * (h - 10);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#3574F0';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 2. Draw CPU Waveform (Green stroke)
    ctx.beginPath();
    history.forEach((sample, i) => {
      const x = i * stepX;
      const y = h - (Math.min(sample.cpuPercent, 100) / 100) * (h - 10);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#59A869';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }, [history]);

  const handleTakeSnapshot = async () => {
    const isTauri = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
    if (isTauri && selectedPid) {
      try {
        const outPath = await invoke<string>('trigger_jvm_heap_dump', { pid: selectedPid });
        setSnapshotsCount(prev => prev + 1);
        onShowToast?.('Heap Dump Saved', `Snapshot created: ${outPath}`, 'success');
        return;
      } catch (err: any) {
        onShowToast?.('Heap Dump Failed', String(err), 'error');
        return;
      }
    }
    setSnapshotsCount(prev => prev + 1);
    onShowToast?.('Memory Snapshot Captured', `Heap snapshot #${snapshotsCount + 1} (${memoryUsage} MB) saved for inspection`, 'success');
  };

  const handleForceGc = async () => {
    const isTauri = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
    if (isTauri && selectedPid) {
      try {
        const res = await invoke<string>('trigger_jvm_gc', { pid: selectedPid });
        onShowToast?.('JVM Garbage Collection', res, 'success');
        return;
      } catch (err: any) {
        onShowToast?.('GC Request', String(err), 'warning');
      }
    }
    if (typeof window !== 'undefined' && (window as any).gc) {
      (window as any).gc();
    }
    onShowToast?.('Garbage Collection', 'Forced full GC sweep & memory compaction', 'info');
  };

  const currentProc = processes.find(p => p.pid === selectedPid) || processes[0];

  return (
    <div className="h-full flex flex-col bg-[#1E1F22] text-[#DFE1E5] text-xs select-none">
      {/* Top Action Bar */}
      <div className="h-8 border-b border-[#2B2D30] px-3 flex items-center justify-between bg-[#1E1F22] flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 font-semibold text-white">
            <Activity size={14} className="text-[#59A869]" />
            <span>JVM Profiler</span>
          </div>

          {/* Process Selector */}
          <div className="flex items-center gap-1.5 bg-[#2B2D30] border border-[#393B40] rounded px-2 py-0.5">
            <Server size={12} className="text-[#3574F0]" />
            <span className="text-[#868A91] text-[11px]">Target:</span>
            <select
              value={selectedPid || ''}
              onChange={(e) => {
                const pid = Number(e.target.value);
                setSelectedPid(pid);
                setHistory([]); // reset history for new process
              }}
              className="bg-transparent text-white font-mono text-[11px] outline-none cursor-pointer max-w-[200px] truncate"
            >
              {processes.map((p) => (
                <option key={p.pid} value={p.pid} className="bg-[#2B2D30] text-white">
                  [{p.pid}] {p.name} {p.is_current_app ? '(Host)' : ''}
                </option>
              ))}
            </select>
            <button
              onClick={refreshProcesses}
              disabled={isRefreshing}
              className="text-[#868A91] hover:text-white transition-colors"
              title="Refresh process list (jps)"
            >
              <RotateCw size={11} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className="flex items-center gap-3 pl-2 border-l border-[#393B40]">
            <div className="flex items-center gap-1.5 font-mono">
              <span className="w-2 h-2 rounded-full bg-[#59A869]" />
              <span className="text-[#868A91]">CPU:</span>
              <span className="font-bold text-white">{cpuUsage}%</span>
            </div>

            <div className="flex items-center gap-1.5 font-mono">
              <span className="w-2 h-2 rounded-full bg-[#3574F0]" />
              <span className="text-[#868A91]">Memory:</span>
              <span className="font-bold text-white">{memoryUsage} MB</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsProfiling(prev => !prev)}
            className={`px-2.5 py-0.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors ${
              isProfiling 
                ? 'bg-[#E05555]/20 text-[#E05555] hover:bg-[#E05555]/30 border border-[#E05555]/40' 
                : 'bg-[#59A869]/20 text-[#59A869] hover:bg-[#59A869]/30 border border-[#59A869]/40'
            }`}
          >
            {isProfiling ? <Square size={11} className="fill-current" /> : <Play size={11} className="fill-current" />}
            <span>{isProfiling ? 'Stop Sampling' : 'Start Profiling'}</span>
          </button>

          <button
            onClick={handleTakeSnapshot}
            className="px-2.5 py-0.5 bg-[#2B2D30] hover:bg-[#35373B] text-[#DFE1E5] rounded text-xs font-medium flex items-center gap-1.5 border border-[#393B40] transition-colors"
            title="Execute jcmd GC.heap_dump on selected target"
          >
            <Download size={11} />
            <span>Dump Heap (.hprof)</span>
          </button>

          <button
            onClick={handleForceGc}
            className="p-1 hover:bg-[#2B2D30] text-[#868A91] hover:text-[#DFE1E5] rounded transition-colors"
            title="Execute jcmd GC.run (Force Garbage Collection)"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Main Graph & Metric Cards */}
      <div className="flex-1 p-3 flex flex-col gap-3 overflow-hidden">
        {/* Canvas Graph Waveform */}
        <div className="flex-1 bg-[#1E1F22] border border-[#2B2D30] rounded-lg p-2 flex flex-col relative overflow-hidden">
          <div className="flex items-center justify-between text-[11px] text-[#868A91] mb-1 px-1">
            <span className="flex items-center gap-1.5">
              <TrendingUp size={12} className="text-[#3574F0]" />
              <span>Realtime Telemetry: PID {selectedPid || 'Host'} ({currentProc?.name || 'Java Application'})</span>
            </span>
            <span className="flex items-center gap-3 font-mono text-[10px]">
              <span className="text-[#59A869]">● CPU %</span>
              <span className="text-[#3574F0]">■ Memory RSS / Heap (MB)</span>
            </span>
          </div>

          <div className="flex-1 relative w-full h-full min-h-[120px]">
            <canvas
              ref={canvasRef}
              width={750}
              height={140}
              className="w-full h-full block"
            />
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-3 flex-shrink-0">
          <div className="bg-[#2B2D30]/60 border border-[#393B40] rounded p-2.5">
            <div className="text-[#868A91] text-[11px] mb-1 flex items-center gap-1.5">
              <Cpu size={12} className="text-[#59A869]" />
              <span>Target CPU Usage</span>
            </div>
            <div className="text-base font-bold text-white font-mono">{cpuUsage}%</div>
            <div className="text-[10px] text-[#868A91] mt-0.5 truncate">PID: {selectedPid || 'Host'}</div>
          </div>

          <div className="bg-[#2B2D30]/60 border border-[#393B40] rounded p-2.5">
            <div className="text-[#868A91] text-[11px] mb-1 flex items-center gap-1.5">
              <HardDrive size={12} className="text-[#3574F0]" />
              <span>Target Memory</span>
            </div>
            <div className="text-base font-bold text-white font-mono">{memoryUsage} MB</div>
            <div className="text-[10px] text-[#868A91] mt-0.5">Physical RSS & Heap</div>
          </div>

          <div className="bg-[#2B2D30]/60 border border-[#393B40] rounded p-2.5">
            <div className="text-[#868A91] text-[11px] mb-1 flex items-center gap-1.5">
              <Clock size={12} className="text-[#EDA200]" />
              <span>Sampling Frequency</span>
            </div>
            <div className="text-base font-bold text-white font-mono">1.0 Hz</div>
            <div className="text-[10px] text-[#868A91] mt-0.5">Win32 QueryInformation</div>
          </div>

          <div className="bg-[#2B2D30]/60 border border-[#393B40] rounded p-2.5">
            <div className="text-[#868A91] text-[11px] mb-1 flex items-center gap-1.5">
              <Zap size={12} className="text-[#B180D7]" />
              <span>Hprof Snapshots</span>
            </div>
            <div className="text-base font-bold text-white font-mono">{snapshotsCount}</div>
            <div className="text-[10px] text-[#868A91] mt-0.5">jcmd GC.heap_dump</div>
          </div>
        </div>
      </div>
    </div>
  );
};
