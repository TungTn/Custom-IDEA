use serde::Serialize;
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Instant;

#[derive(Debug, Serialize, Clone)]
pub struct ProcessMetricsDto {
    pub cpu_percent: f32,
    pub memory_mb: f32,
    pub system_total_mb: f32,
    pub cores_count: u32,
}

#[derive(Debug, Serialize, Clone)]
pub struct JavaProcessDto {
    pub pid: u32,
    pub name: String,
    pub main_class: String,
    pub is_current_app: bool,
}

#[cfg(windows)]
mod win_impl {
    use super::*;

    #[repr(C)]
    #[allow(non_snake_case)]
    struct PROCESS_MEMORY_COUNTERS_EX {
        cb: u32,
        PageFaultCount: u32,
        PeakWorkingSetSize: usize,
        WorkingSetSize: usize,
        QuotaPeakPagedPoolUsage: usize,
        QuotaPagedPoolUsage: usize,
        QuotaPeakNonPagedPoolUsage: usize,
        QuotaNonPagedPoolUsage: usize,
        PagefileUsage: usize,
        PeakPagefileUsage: usize,
        PrivateUsage: usize,
    }

    #[repr(C)]
    #[allow(non_snake_case)]
    struct MEMORYSTATUSEX {
        dwLength: u32,
        dwMemoryLoad: u32,
        ullTotalPhys: u64,
        ullAvailPhys: u64,
        ullTotalPageFile: u64,
        ullAvailPageFile: u64,
        ullTotalVirtual: u64,
        ullAvailVirtual: u64,
        ullAvailExtendedVirtual: u64,
    }

    #[link(name = "psapi")]
    #[link(name = "kernel32")]
    extern "system" {
        fn GetCurrentProcess() -> isize;
        fn GetCurrentProcessId() -> u32;
        fn OpenProcess(dwDesiredAccess: u32, bInheritHandle: i32, dwProcessId: u32) -> isize;
        fn CloseHandle(hObject: isize) -> i32;
        fn GetProcessMemoryInfo(
            hProcess: isize,
            ppsmemCounters: *mut PROCESS_MEMORY_COUNTERS_EX,
            cb: u32,
        ) -> i32;
        fn GetProcessTimes(
            hProcess: isize,
            lpCreationTime: *mut u64,
            lpExitTime: *mut u64,
            lpKernelTime: *mut u64,
            lpUserTime: *mut u64,
        ) -> i32;
        fn GlobalMemoryStatusEx(lpBuffer: *mut MEMORYSTATUSEX) -> i32;
    }

    struct CpuSample {
        last_time: Instant,
        last_cpu_time: u64,
    }

    static CPU_SAMPLES: Mutex<Option<HashMap<u32, CpuSample>>> = Mutex::new(None);
    const MAX_CPU_SAMPLE_ENTRIES: usize = 256;
    const CPU_SAMPLE_TTL_SECS: u64 = 60;

    pub fn sample_metrics(target_pid: Option<u32>) -> (f32, f32, f32) {
        unsafe {
            let current_id = GetCurrentProcessId();
            let pid = target_pid.unwrap_or(current_id);

            let (handle, should_close) = if pid == current_id {
                (GetCurrentProcess(), false)
            } else {
                // PROCESS_QUERY_INFORMATION (0x0400) | PROCESS_VM_READ (0x0010)
                let h = OpenProcess(0x0400 | 0x0010, 0, pid);
                if h == 0 {
                    return (0.0, 0.0, 16384.0);
                }
                (h, true)
            };

            // 1. Process Memory (WorkingSet & PrivateUsage in MB)
            let mut mem_counters: PROCESS_MEMORY_COUNTERS_EX = std::mem::zeroed();
            mem_counters.cb = std::mem::size_of::<PROCESS_MEMORY_COUNTERS_EX>() as u32;
            let mem_mb = if GetProcessMemoryInfo(handle, &mut mem_counters, mem_counters.cb) != 0 {
                let bytes = if mem_counters.PrivateUsage > 0 {
                    mem_counters.PrivateUsage
                } else {
                    mem_counters.WorkingSetSize
                };
                (bytes as f32) / (1024.0 * 1024.0)
            } else {
                0.0
            };

            // 2. System Total Physical Memory in MB
            let mut mem_status: MEMORYSTATUSEX = std::mem::zeroed();
            mem_status.dwLength = std::mem::size_of::<MEMORYSTATUSEX>() as u32;
            let sys_total_mb = if GlobalMemoryStatusEx(&mut mem_status) != 0 {
                (mem_status.ullTotalPhys as f32) / (1024.0 * 1024.0)
            } else {
                16384.0
            };

            // 3. Process CPU Usage %
            let mut ct = 0u64;
            let mut et = 0u64;
            let mut kt = 0u64;
            let mut ut = 0u64;
            let mut cpu_percent = 0.0f32;

            if GetProcessTimes(handle, &mut ct, &mut et, &mut kt, &mut ut) != 0 {
                let total_cpu_100ns = kt.wrapping_add(ut);
                let now = Instant::now();
                let mut guard = CPU_SAMPLES.lock().unwrap_or_else(|e| e.into_inner());
                let map = guard.get_or_insert_with(HashMap::new);
                map.retain(|_, sample| now.duration_since(sample.last_time).as_secs() < CPU_SAMPLE_TTL_SECS);
                if map.len() >= MAX_CPU_SAMPLE_ENTRIES && !map.contains_key(&pid) {
                    if let Some(oldest_pid) = map
                        .iter()
                        .min_by_key(|(_, sample)| sample.last_time)
                        .map(|(k, _)| *k)
                    {
                        map.remove(&oldest_pid);
                    }
                }

                if let Some(prev) = map.get(&pid) {
                    let elapsed_secs = now.duration_since(prev.last_time).as_secs_f32();
                    if elapsed_secs > 0.05 {
                        let delta_cpu_secs = (total_cpu_100ns.saturating_sub(prev.last_cpu_time) as f32) / 10_000_000.0;
                        let cores = std::thread::available_parallelism()
                            .map(|n| n.get())
                            .unwrap_or(1) as f32;
                        cpu_percent = ((delta_cpu_secs / elapsed_secs) * 100.0 / cores).clamp(0.0, 100.0);
                        map.insert(pid, CpuSample {
                            last_time: now,
                            last_cpu_time: total_cpu_100ns,
                        });
                    }
                } else {
                    map.insert(pid, CpuSample {
                        last_time: now,
                        last_cpu_time: total_cpu_100ns,
                    });
                }
            }

            if should_close {
                CloseHandle(handle);
            }

            (
                (cpu_percent * 10.0).round() / 10.0,
                (mem_mb * 10.0).round() / 10.0,
                (sys_total_mb * 10.0).round() / 10.0,
            )
        }
    }

    pub fn get_current_pid() -> u32 {
        unsafe { GetCurrentProcessId() }
    }
}

#[cfg(not(windows))]
mod win_impl {
    pub fn sample_metrics(_target_pid: Option<u32>) -> (f32, f32, f32) {
        (0.0, 120.0, 8192.0)
    }

    pub fn get_current_pid() -> u32 {
        std::process::id()
    }
}

#[tauri::command]
pub async fn get_process_metrics(target_pid: Option<u32>) -> Result<ProcessMetricsDto, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let (cpu_percent, memory_mb, system_total_mb) = win_impl::sample_metrics(target_pid);
        let cores = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(1) as u32;
        Ok(ProcessMetricsDto {
            cpu_percent,
            memory_mb,
            system_total_mb,
            cores_count: cores,
        })
    })
    .await
    .map_err(|e| format!("Failed to collect process metrics: {}", e))?
}

#[tauri::command]
pub async fn list_running_java_processes() -> Result<Vec<JavaProcessDto>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut list = Vec::new();
        let current_pid = win_impl::get_current_pid();

        // 1. Add Custom-IDEA Host as default process
        list.push(JavaProcessDto {
            pid: current_pid,
            name: "Custom-IDEA (IDE Host)".to_string(),
            main_class: "Custom-IDEA.exe".to_string(),
            is_current_app: true,
        });

        // 2. Discover Java processes via `jps -l`
        let mut cmd = std::process::Command::new("jps");
        cmd.arg("-l");
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }

        if let Ok(output) = cmd.output() {
            if output.status.success() {
                let text = String::from_utf8_lossy(&output.stdout);
                for line in text.lines() {
                    let parts: Vec<&str> = line.trim().split_whitespace().collect();
                    if parts.is_empty() { continue; }
                    if let Ok(pid) = parts[0].parse::<u32>() {
                        let main_class = if parts.len() > 1 { parts[1] } else { "Java Application" };
                        if main_class == "jdk.jcmd/sun.tools.jps.Jps" || main_class == "sun.tools.jps.Jps" {
                            continue;
                        }

                        // Extract clean name from class or jar path
                        let clean_name = if main_class.ends_with(".jar") {
                            std::path::Path::new(main_class)
                                .file_name()
                                .map(|s| s.to_string_lossy().to_string())
                                .unwrap_or_else(|| main_class.to_string())
                        } else if let Some(last) = main_class.split('.').last() {
                            last.to_string()
                        } else {
                            main_class.to_string()
                        };

                        list.push(JavaProcessDto {
                            pid,
                            name: clean_name,
                            main_class: main_class.to_string(),
                            is_current_app: false,
                        });
                    }
                }
            }
        }

        Ok(list)
    })
    .await
    .map_err(|e| format!("Failed to list Java processes: {}", e))?
}

#[tauri::command]
pub async fn trigger_jvm_gc(pid: u32) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut cmd = std::process::Command::new("jcmd");
        cmd.arg(pid.to_string());
        cmd.arg("GC.run");
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000);
        }

        match cmd.output() {
            Ok(out) => {
                let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
                let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
                if out.status.success() {
                    Ok(if stdout.is_empty() { "GC sweep completed successfully.".to_string() } else { stdout })
                } else {
                    Err(if !stderr.is_empty() { stderr } else { stdout })
                }
            }
            Err(e) => Err(format!("Failed to execute jcmd: {}. Ensure JDK bin is in PATH.", e)),
        }
    })
    .await
    .map_err(|e| format!("Failed to execute jcmd: {}", e))?
}

#[tauri::command]
pub async fn trigger_jvm_heap_dump(pid: u32, output_path: Option<String>) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let target_path = output_path.unwrap_or_else(|| {
            let ts = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0);
            let temp_dir = std::env::temp_dir();
            temp_dir.join(format!("heap_dump_{}_{}.hprof", pid, ts)).to_string_lossy().to_string()
        });

        let mut cmd = std::process::Command::new("jcmd");
        cmd.arg(pid.to_string());
        cmd.arg("GC.heap_dump");
        cmd.arg(&target_path);
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000);
        }

        match cmd.output() {
            Ok(out) => {
                let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
                let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
                if out.status.success() {
                    Ok(target_path)
                } else {
                    Err(if !stderr.is_empty() { stderr } else { stdout })
                }
            }
            Err(e) => Err(format!("Failed to execute jcmd heap dump: {}. Ensure JDK bin is in PATH.", e)),
        }
    })
    .await
    .map_err(|e| format!("Failed to execute jcmd heap dump: {}", e))?
}
