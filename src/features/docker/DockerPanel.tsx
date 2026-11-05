import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Square, 
  RotateCw, 
  Trash2, 
  FileText, 
  RefreshCw, 
  Box, 
  Layers, 
  AlertCircle, 
  CheckCircle2, 
  Terminal,
  Activity,
  Server
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

export interface DockerContainerDto {
  id: string;
  names: string[];
  image: string;
  state: string;
  status: string;
  ports: string[];
  created: number;
}

export interface DockerDaemonStatusDto {
  is_available: boolean;
  version?: string;
  containers_count: number;
  images_count: number;
  error_message?: string;
}

interface DockerPanelProps {
  onShowToast?: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const DockerPanel: React.FC<DockerPanelProps> = ({ onShowToast }) => {
  const [daemonStatus, setDaemonStatus] = useState<DockerDaemonStatusDto | null>(null);
  const [containers, setContainers] = useState<DockerContainerDto[]>([]);
  const [selectedContainerId, setSelectedContainerId] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [activeTab, setActiveTab] = useState<'containers' | 'logs'>('containers');

  const fetchStatusAndContainers = async () => {
    setIsLoading(true);
    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        const status = await invoke<DockerDaemonStatusDto>('docker_get_daemon_status');
        setDaemonStatus(status);

        if (status.is_available) {
          const list = await invoke<DockerContainerDto[]>('docker_list_containers', { all: true });
          setContainers(list);
          if (list.length > 0 && !selectedContainerId) {
            setSelectedContainerId(list[0].id);
          }
        } else {
          setContainers([]);
        }
      } else {
        setDaemonStatus({
          is_available: false,
          version: 'Docker daemon offline',
          containers_count: 0,
          images_count: 0,
        });
        setContainers([]);
        setSelectedContainerId(null);
      }
    } catch (err: any) {
      console.warn('Docker fetch error:', err);
      setDaemonStatus({
        is_available: false,
        containers_count: 0,
        images_count: 0,
        error_message: String(err),
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatusAndContainers();
  }, []);

  const fetchLogs = async (containerId: string) => {
    setIsLoadingLogs(true);
    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        const output = await invoke<string[]>('docker_get_logs', { containerId, tail: 150 });
        setLogs(output);
      } else {
        setLogs([
          'PostgreSQL Database directory appears to be initialized.',
          'Server initialized with LC_COLLATE="en_US.utf8"',
          '2026-11-02 14:00:00.000 UTC [1] LOG: starting PostgreSQL 15.4 on x86_64-pc-linux-musl',
          '2026-11-02 14:00:00.010 UTC [1] LOG: listening on IPv4 address "0.0.0.0", port 5432',
          '2026-11-02 14:00:00.020 UTC [1] LOG: database system is ready to accept connections',
        ]);
      }
    } catch (err: any) {
      setLogs([`Error fetching logs: ${err}`]);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleAction = async (action: 'start' | 'stop' | 'restart' | 'remove', containerId: string) => {
    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        if (action === 'start') await invoke('docker_start_container', { containerId });
        if (action === 'stop') await invoke('docker_stop_container', { containerId });
        if (action === 'restart') await invoke('docker_restart_container', { containerId });
        if (action === 'remove') await invoke('docker_remove_container', { containerId, force: true });
      }
      onShowToast?.('Docker', `Container ${action} successfully`, 'success');
      fetchStatusAndContainers();
      if (action === 'remove' && selectedContainerId === containerId) {
        setSelectedContainerId(null);
        setLogs([]);
      }
    } catch (err: any) {
      onShowToast?.('Docker Error', String(err), 'error');
    }
  };

  const selectedContainer = containers.find(c => c.id === selectedContainerId);

  return (
    <div className="h-full flex flex-col bg-[#1E1F22] text-[#DFE1E5] text-[12px] select-none">
      {/* Top Header */}
      <div className="h-8 border-b border-[#393B40] px-3 flex items-center justify-between shrink-0 bg-[#2B2D30]/50">
        <div className="flex items-center gap-1.5 font-medium text-[12px]">
          <Server size={14} className="text-[#3574F0]" />
          <span>Docker</span>
          {daemonStatus?.is_available ? (
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-green-500/20 text-green-400 border border-green-500/30 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
              Connected
            </span>
          ) : (
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-red-500/20 text-red-400 border border-red-500/30">
              Offline
            </span>
          )}
        </div>

        <button 
          onClick={fetchStatusAndContainers}
          className="p-1 hover:bg-[#35373B] rounded text-[#868A91] hover:text-[#DFE1E5]"
          title="Refresh Docker Containers"
        >
          <RefreshCw size={13} className={isLoading ? "animate-spin text-[#3574F0]" : ""} />
        </button>
      </div>

      {/* Daemon not available banner */}
      {daemonStatus && !daemonStatus.is_available && (
        <div className="p-3 m-2 bg-[#2B2D30] border border-red-500/30 rounded-lg text-left">
          <div className="flex items-center gap-2 text-red-400 font-medium mb-1">
            <AlertCircle size={14} />
            <span>Docker Daemon Not Reachable</span>
          </div>
          <p className="text-[11px] text-[#868A91] leading-relaxed mb-2">
            Please ensure Docker Desktop or dockerd engine is started on your system.
          </p>
          {daemonStatus.error_message && (
            <p className="text-[10px] font-mono bg-[#1E1F22] p-1.5 rounded text-red-300 break-all mb-2">
              {daemonStatus.error_message}
            </p>
          )}
          <button
            onClick={fetchStatusAndContainers}
            className="px-2.5 py-1 text-[11px] font-medium bg-[#3574F0] hover:bg-[#3062D4] text-white rounded transition-colors"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Sub Tabs */}
      <div className="h-7 border-b border-[#393B40] px-2 flex items-center gap-1 bg-[#1E1F22] shrink-0">
        <button
          onClick={() => setActiveTab('containers')}
          className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors ${
            activeTab === 'containers' ? 'bg-[#2B2D30] text-[#DFE1E5]' : 'text-[#868A91] hover:text-[#DFE1E5]'
          }`}
        >
          Containers ({containers.length})
        </button>
        <button
          onClick={() => {
            setActiveTab('logs');
            if (selectedContainerId) fetchLogs(selectedContainerId);
          }}
          disabled={!selectedContainerId}
          className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors flex items-center gap-1.5 ${
            activeTab === 'logs' ? 'bg-[#2B2D30] text-[#DFE1E5]' : 'text-[#868A91] hover:text-[#DFE1E5] disabled:opacity-40'
          }`}
        >
          <Terminal size={12} />
          Logs {selectedContainer && `(${selectedContainer.names[0] || selectedContainer.id.slice(0, 7)})`}
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'containers' ? (
          <div className="flex-1 overflow-y-auto divide-y divide-[#393B40]/50">
            {containers.length === 0 ? (
              <div className="py-12 text-center text-[#868A91] text-[11px]">
                {daemonStatus?.is_available ? 'No containers found' : 'Docker is not running'}
              </div>
            ) : (
              containers.map((container) => {
                const isSelected = container.id === selectedContainerId;
                const isRunning = container.state.toLowerCase() === 'running';

                return (
                  <div
                    key={container.id}
                    onClick={() => {
                      setSelectedContainerId(container.id);
                      fetchLogs(container.id);
                    }}
                    className={`p-2.5 cursor-pointer transition-colors ${
                      isSelected ? 'bg-[#2E436E]/40 border-l-2 border-[#3574F0]' : 'hover:bg-[#2B2D30]/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 font-medium truncate">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${isRunning ? 'bg-green-400' : 'bg-[#868A91]'}`}></span>
                        <span className="truncate text-[#DFE1E5]">
                          {container.names[0]?.replace(/^\//, '') || container.id.slice(0, 10)}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-[#868A91] shrink-0">
                        {container.id.slice(0, 10)}
                      </span>
                    </div>

                    <div className="text-[11px] text-[#868A91] font-mono truncate mb-1">
                      {container.image}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-[#A1A3A8]">
                      <span>{container.status}</span>
                      {container.ports.length > 0 && container.ports[0] && (
                        <span className="font-mono text-[#56A8F5] truncate max-w-[120px]">
                          {container.ports[0]}
                        </span>
                      )}
                    </div>

                    {/* Action Bar for Selected Container */}
                    {isSelected && (
                      <div className="mt-2.5 pt-2 border-t border-[#393B40] flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {isRunning ? (
                          <button
                            onClick={() => handleAction('stop', container.id)}
                            className="px-2 py-0.8 bg-[#35373B] hover:bg-red-500/20 text-[#DFE1E5] hover:text-red-400 border border-[#4E5157] rounded text-[10px] flex items-center gap-1"
                            title="Stop Container"
                          >
                            <Square size={10} /> Stop
                          </button>
                        ) : (
                          <button
                            onClick={() => handleAction('start', container.id)}
                            className="px-2 py-0.8 bg-[#35373B] hover:bg-green-500/20 text-[#DFE1E5] hover:text-green-400 border border-[#4E5157] rounded text-[10px] flex items-center gap-1"
                            title="Start Container"
                          >
                            <Play size={10} /> Start
                          </button>
                        )}
                        <button
                          onClick={() => handleAction('restart', container.id)}
                          className="px-2 py-0.8 bg-[#35373B] hover:bg-[#4E5157] text-[#DFE1E5] border border-[#4E5157] rounded text-[10px] flex items-center gap-1"
                          title="Restart Container"
                        >
                          <RotateCw size={10} /> Restart
                        </button>
                        <button
                          onClick={() => {
                            setActiveTab('logs');
                            fetchLogs(container.id);
                          }}
                          className="px-2 py-0.8 bg-[#35373B] hover:bg-[#4E5157] text-[#DFE1E5] border border-[#4E5157] rounded text-[10px] flex items-center gap-1"
                          title="View Logs"
                        >
                          <FileText size={10} /> Logs
                        </button>
                        <button
                          onClick={() => handleAction('remove', container.id)}
                          className="p-1 hover:bg-red-500/20 text-[#868A91] hover:text-red-400 rounded ml-auto"
                          title="Remove Container"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        ) : (
          /* Logs Viewer */
          <div className="flex-1 flex flex-col bg-[#141517]">
            <div className="h-6 border-b border-[#393B40] px-2 flex items-center justify-between text-[10px] text-[#868A91] bg-[#1E1F22]">
              <span>Logs: {selectedContainer?.names[0] || selectedContainerId}</span>
              <button
                onClick={() => selectedContainerId && fetchLogs(selectedContainerId)}
                className="hover:text-[#DFE1E5] flex items-center gap-1"
              >
                <RefreshCw size={10} className={isLoadingLogs ? "animate-spin" : ""} /> Refresh
              </button>
            </div>
            <div className="flex-1 p-2 font-mono text-[11px] overflow-y-auto space-y-0.5 leading-relaxed text-[#ABB2BF]">
              {logs.length === 0 ? (
                <div className="text-[#5C6370] italic">No logs available</div>
              ) : (
                logs.map((line, idx) => (
                  <div key={idx} className="whitespace-pre-wrap break-all hover:bg-[#2B2D30]/40 px-1 rounded">
                    {line}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
