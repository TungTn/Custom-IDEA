use serde::Serialize;

#[derive(Debug, Serialize, Clone)]
pub struct ProcessMetricsDto {
    pub cpu_percent: f32,
    pub memory_mb: f32,
    pub system_total_mb: f32,
    pub cores_count: u32,
}

#[cfg(windows)]
mod win_impl {
    use std::sync::Mutex;
    use std::time::Instant;

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

    static CPU_SAMPLE: Mutex<Option<CpuSample>> = Mutex::new(None);

    pub fn sample_metrics() -> (f32, f32, f32) {
        unsafe {
            let handle = GetCurrentProcess();

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
                120.0
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
                let mut guard = CPU_SAMPLE.lock().unwrap();

                if let Some(prev) = &*guard {
                    let elapsed_secs = now.duration_since(prev.last_time).as_secs_f32();
                    if elapsed_secs > 0.05 {
                        let delta_cpu_secs = (total_cpu_100ns.saturating_sub(prev.last_cpu_time) as f32) / 10_000_000.0;
                        let cores = std::thread::available_parallelism()
                            .map(|n| n.get())
                            .unwrap_or(1) as f32;
                        cpu_percent = ((delta_cpu_secs / elapsed_secs) * 100.0 / cores).clamp(0.0, 100.0);
                        *guard = Some(CpuSample {
                            last_time: now,
                            last_cpu_time: total_cpu_100ns,
                        });
                    }
                } else {
                    *guard = Some(CpuSample {
                        last_time: now,
                        last_cpu_time: total_cpu_100ns,
                    });
                }
            }

            (
                (cpu_percent * 10.0).round() / 10.0,
                (mem_mb * 10.0).round() / 10.0,
                (sys_total_mb * 10.0).round() / 10.0,
            )
        }
    }
}

#[cfg(not(windows))]
mod win_impl {
    pub fn sample_metrics() -> (f32, f32, f32) {
        (0.0, 120.0, 8192.0)
    }
}

#[tauri::command]
pub fn get_process_metrics() -> Result<ProcessMetricsDto, String> {
    let (cpu_percent, memory_mb, system_total_mb) = win_impl::sample_metrics();
    let cores = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(1) as u32;
    Ok(ProcessMetricsDto {
        cpu_percent,
        memory_mb,
        system_total_mb,
        cores_count: cores,
    })
}
