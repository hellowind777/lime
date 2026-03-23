use crate::app::AppState;
use crate::database::dao::api_key_provider::{ApiKeyProvider, ApiProviderType};
use dirs::{data_dir, home_dir};
use lime_core::openclaw_install::{
    build_openclaw_cleanup_command as core_build_openclaw_cleanup_command,
    build_openclaw_install_command as core_build_openclaw_install_command,
    build_winget_install_command as core_build_winget_install_command,
    command_bin_dir_for as core_command_bin_dir_for,
    resolve_windows_dependency_install_plan as core_resolve_windows_dependency_install_plan,
    select_best_semver_candidate as core_select_best_semver_candidate,
    select_preferred_path_candidate as core_select_preferred_path_candidate,
    shell_command_escape_for as core_shell_command_escape_for,
    shell_command_invocation_prefix_for as core_shell_command_invocation_prefix_for,
    shell_npm_prefix_assignment_for as core_shell_npm_prefix_assignment_for,
    shell_path_assignment_for as core_shell_path_assignment_for,
    windows_manual_install_message as core_windows_manual_install_message,
    OpenClawInstallDependencyKind, ShellPlatform, WindowsDependencyInstallPlan,
};
use rand::{distributions::Alphanumeric, Rng};
use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use std::cmp::Ordering;
use std::collections::{HashSet, VecDeque};
use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::{Arc, Mutex as StdMutex, OnceLock};
use std::time::SystemTime;
use sysinfo::{Pid, Signal, System};
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncBufReadExt, AsyncRead, AsyncReadExt, BufReader};
use tokio::net::TcpStream;
use tokio::process::{Child, Command};
use tokio::sync::Mutex;
use tokio::time::{sleep, timeout, Duration};
#[cfg(target_os = "windows")]
use winapi::shared::minwindef::{DWORD, HKEY};
#[cfg(target_os = "windows")]
use winapi::shared::winerror::ERROR_SUCCESS;
#[cfg(target_os = "windows")]
use winapi::um::winreg::{RegOpenKeyExW, RegQueryValueExW, HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE};

const DEFAULT_GATEWAY_PORT: u16 = 18790;
const OPENCLAW_INSTALL_EVENT: &str = "openclaw:install-progress";
const OPENCLAW_CONFIG_ENV: &str = "OPENCLAW_CONFIG_PATH";

fn shell_escape(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\"'\"'"))
}
const OPENCLAW_CN_PACKAGE: &str = "@qingchencloud/openclaw-zh@latest";
const OPENCLAW_DEFAULT_PACKAGE: &str = "openclaw@latest";
const NPM_MIRROR_CN: &str = "https://registry.npmmirror.com";
const NODE_MIN_VERSION: (u64, u64, u64) = (22, 12, 0);
const OPENCLAW_PROGRESS_LOG_LIMIT: usize = 400;
const OPENCLAW_INSTALLER_USER_AGENT: &str = "Lime-OpenClaw";
#[cfg(not(target_os = "windows"))]
const OPENCLAW_TEMP_CARGO_CHECK_DIR: &str = "/tmp/lime-cargo-check";
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

static OPENCLAW_PREFERRED_RUNTIME_BIN_DIR: OnceLock<StdMutex<Option<PathBuf>>> = OnceLock::new();

mod config;
mod diagnostics;
mod gateway;
mod install;
mod platform;
mod preview;
mod process;
mod progress;
mod runtime;
#[cfg(test)]
mod tests;
mod types;
mod update;

pub(crate) use self::config::*;
pub(crate) use self::diagnostics::*;
pub(crate) use self::gateway::*;
pub(crate) use self::install::*;
pub(crate) use self::platform::*;
pub(crate) use self::process::*;
pub(crate) use self::progress::*;
pub(crate) use self::runtime::*;
pub use self::types::{
    ActionResult, BinaryAvailabilityStatus, BinaryInstallStatus, ChannelInfo, CommandPreview,
    DependencyStatus, EnvironmentDiagnostics, EnvironmentStatus, GatewayStatus, GatewayStatusInfo,
    HealthInfo, InstallProgressEvent, NodeCheckResult, OpenClawRuntimeCandidate, SyncModelEntry,
    UpdateInfo,
};
pub(crate) use self::types::{
    DependencyKind, InstallerAsset, OpenClawDirectUpgradePlan, OpenClawDirectUpgradeResult,
    OpenClawUpdateExecutionContext, ResolvedOpenClawCommand,
};
#[cfg(test)]
pub(crate) use self::update::*;

#[derive(Debug)]
pub struct OpenClawService {
    gateway_process: Option<Child>,
    gateway_status: GatewayStatus,
    gateway_port: u16,
    gateway_auth_token: String,
    gateway_started_at: Option<SystemTime>,
    progress_logs: VecDeque<InstallProgressEvent>,
}

impl Default for OpenClawService {
    fn default() -> Self {
        Self {
            gateway_process: None,
            gateway_status: GatewayStatus::Stopped,
            gateway_port: DEFAULT_GATEWAY_PORT,
            gateway_auth_token: String::new(),
            gateway_started_at: None,
            progress_logs: VecDeque::new(),
        }
    }
}

pub struct OpenClawServiceState(pub std::sync::Arc<Mutex<OpenClawService>>);

impl Default for OpenClawServiceState {
    fn default() -> Self {
        Self(std::sync::Arc::new(Mutex::new(OpenClawService::default())))
    }
}

impl OpenClawService {
    pub fn clear_progress_logs(&mut self) {
        self.progress_logs.clear();
    }

    pub fn get_progress_logs(&self) -> Vec<InstallProgressEvent> {
        self.progress_logs.iter().cloned().collect()
    }

    fn clear_gateway_runtime_state(&mut self) {
        self.gateway_process = None;
        self.gateway_started_at = None;
        self.gateway_status = GatewayStatus::Stopped;
    }
    fn push_progress_log(&mut self, message: String, level: String) {
        if self.progress_logs.len() >= OPENCLAW_PROGRESS_LOG_LIMIT {
            self.progress_logs.pop_front();
        }
        self.progress_logs
            .push_back(InstallProgressEvent { message, level });
    }
}

pub fn openclaw_install_event_name() -> &'static str {
    OPENCLAW_INSTALL_EVENT
}
