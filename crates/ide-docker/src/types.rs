use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct DockerContainerDto {
    pub id: String,
    pub names: Vec<String>,
    pub image: String,
    pub state: String,       // "running", "exited", "paused", "created"
    pub status: String,      // "Up 3 hours", "Exited (0) 5 minutes ago"
    pub ports: Vec<String>,
    pub created: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct DockerDaemonStatusDto {
    pub is_available: bool,
    pub version: Option<String>,
    pub containers_count: usize,
    pub images_count: usize,
    pub error_message: Option<String>,
}
