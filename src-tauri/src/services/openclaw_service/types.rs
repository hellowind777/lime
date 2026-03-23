use super::*;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BinaryInstallStatus {
    pub installed: bool,
    pub path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BinaryAvailabilityStatus {
    pub available: bool,
    pub path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeCheckResult {
    pub status: String,
    pub version: Option<String>,
    pub path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActionResult {
    pub success: bool,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DependencyStatus {
    pub status: String,
    pub version: Option<String>,
    pub path: Option<String>,
    pub message: String,
    pub auto_install_supported: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvironmentStatus {
    pub node: DependencyStatus,
    pub git: DependencyStatus,
    pub openclaw: DependencyStatus,
    pub recommended_action: String,
    pub summary: String,
    #[serde(default)]
    pub diagnostics: EnvironmentDiagnostics,
    #[serde(default)]
    pub temp_artifacts: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct EnvironmentDiagnostics {
    pub npm_path: Option<String>,
    pub npm_global_prefix: Option<String>,
    pub openclaw_package_path: Option<String>,
    #[serde(default)]
    pub where_candidates: Vec<String>,
    #[serde(default)]
    pub supplemental_search_dirs: Vec<String>,
    #[serde(default)]
    pub supplemental_command_candidates: Vec<String>,
    #[serde(default)]
    pub git_where_candidates: Vec<String>,
    #[serde(default)]
    pub git_supplemental_search_dirs: Vec<String>,
    #[serde(default)]
    pub git_supplemental_command_candidates: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandPreview {
    pub title: String,
    pub command: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GatewayStatusInfo {
    pub status: GatewayStatus,
    pub port: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum GatewayStatus {
    Stopped,
    Starting,
    Running,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthInfo {
    pub status: String,
    pub gateway_port: u16,
    pub uptime: Option<u64>,
    pub version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    pub has_update: bool,
    pub current_version: Option<String>,
    pub latest_version: Option<String>,
    pub channel: Option<String>,
    pub install_kind: Option<String>,
    pub package_manager: Option<String>,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenClawRuntimeCandidate {
    pub id: String,
    pub source: String,
    pub bin_dir: String,
    pub node_path: String,
    pub node_version: Option<String>,
    pub npm_path: Option<String>,
    pub npm_global_prefix: Option<String>,
    pub openclaw_path: Option<String>,
    pub openclaw_version: Option<String>,
    pub openclaw_package_path: Option<String>,
    pub is_active: bool,
    pub is_preferred: bool,
}

#[derive(Debug, Default, Clone)]
pub(crate) struct OpenClawUpdateExecutionContext {
    pub(crate) root: Option<PathBuf>,
    pub(crate) install_kind: Option<String>,
    pub(crate) package_manager: Option<String>,
}

#[derive(Debug, Clone)]
pub(crate) struct OpenClawDirectUpgradePlan {
    pub(crate) runtime_source: String,
    pub(crate) runtime_bin_dir: PathBuf,
    pub(crate) package_manager: String,
    pub(crate) package_spec: String,
    pub(crate) command_line: String,
}

#[derive(Debug, Clone)]
pub(crate) struct OpenClawDirectUpgradeResult {
    pub(crate) runtime_source: String,
    pub(crate) runtime_bin_dir: PathBuf,
    pub(crate) package_manager: String,
    pub(crate) package_spec: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum ResolvedOpenClawCommand {
    Binary {
        binary_path: PathBuf,
    },
    NodeCli {
        node_path: PathBuf,
        cli_path: PathBuf,
        package_version: Option<String>,
    },
}

impl ResolvedOpenClawCommand {
    pub(crate) fn build_command_with_args<I, S>(&self, args: I) -> Command
    where
        I: IntoIterator<Item = S>,
        S: AsRef<std::ffi::OsStr>,
    {
        let command_path = self.command_path();
        let command_path_string = command_path.to_string_lossy().to_string();
        let mut command = Command::new(command_path);
        apply_binary_runtime_path(&mut command, &command_path_string);

        if let Self::NodeCli { cli_path, .. } = self {
            command.arg(cli_path);
        }

        command.args(args);

        command
    }

    pub(crate) fn command_path(&self) -> &Path {
        match self {
            Self::Binary { binary_path } => binary_path.as_path(),
            Self::NodeCli { node_path, .. } => node_path.as_path(),
        }
    }

    pub(crate) fn install_path_display(&self) -> String {
        match self {
            Self::Binary { binary_path } => binary_path.display().to_string(),
            Self::NodeCli { cli_path, .. } => cli_path.display().to_string(),
        }
    }

    pub(crate) fn invocation_display(&self) -> String {
        match self {
            Self::Binary { binary_path } => binary_path.display().to_string(),
            Self::NodeCli {
                node_path,
                cli_path,
                ..
            } => {
                format!("{} {}", node_path.display(), cli_path.display())
            }
        }
    }

    pub(crate) fn preview_invocation(&self) -> String {
        match self {
            Self::Binary { binary_path } => shell_escape(binary_path.to_string_lossy().as_ref()),
            Self::NodeCli {
                node_path,
                cli_path,
                ..
            } => format!(
                "{} {}",
                shell_escape(node_path.to_string_lossy().as_ref()),
                shell_escape(cli_path.to_string_lossy().as_ref())
            ),
        }
    }

    pub(crate) fn fallback_version(&self) -> Option<String> {
        match self {
            Self::Binary { .. } => None,
            Self::NodeCli {
                package_version, ..
            } => package_version.clone(),
        }
    }

    pub(crate) fn dedupe_key(&self) -> String {
        match self {
            Self::Binary { binary_path } => format!("binary:{}", binary_path.display()),
            Self::NodeCli {
                node_path,
                cli_path,
                ..
            } => format!("node:{}:{}", node_path.display(), cli_path.display()),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChannelInfo {
    pub id: String,
    pub name: String,
    pub channel_type: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallProgressEvent {
    pub message: String,
    pub level: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncModelEntry {
    pub id: String,
    pub name: String,
    pub context_window: Option<u64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum DependencyKind {
    Node,
    Git,
}

impl DependencyKind {
    pub(crate) fn label(self) -> &'static str {
        match self {
            Self::Node => "Node.js",
            Self::Git => "Git",
        }
    }
}

#[derive(Debug, Clone)]
pub(crate) struct InstallerAsset {
    pub(crate) filename: String,
    pub(crate) download_url: String,
}
