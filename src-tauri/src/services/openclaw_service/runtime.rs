use super::*;

impl OpenClawService {
    pub async fn list_runtime_candidates(&self) -> Result<Vec<OpenClawRuntimeCandidate>, String> {
        list_openclaw_runtime_candidates().await
    }

    pub async fn set_preferred_runtime(
        &self,
        runtime_id: Option<&str>,
    ) -> Result<ActionResult, String> {
        let normalized = runtime_id
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(PathBuf::from);

        let Some(runtime_bin_dir) = normalized else {
            set_preferred_runtime_bin_dir(None);
            return Ok(ActionResult {
                success: true,
                message: "已切换为自动选择执行环境。".to_string(),
            });
        };

        let candidates = list_openclaw_runtime_candidates().await?;
        let runtime_id = runtime_bin_dir.display().to_string();
        let Some(candidate) = candidates.iter().find(|item| item.id == runtime_id) else {
            return Ok(ActionResult {
                success: false,
                message: "未找到指定的 OpenClaw 执行环境，请重新检测后再试。".to_string(),
            });
        };

        set_preferred_runtime_bin_dir(Some(runtime_bin_dir));
        Ok(ActionResult {
            success: true,
            message: format!(
                "已固定使用执行环境：{}{}。",
                candidate.source,
                candidate
                    .node_version
                    .as_deref()
                    .map(|version| format!(" · Node {version}"))
                    .unwrap_or_default()
            ),
        })
    }
}

pub(crate) fn preferred_runtime_bin_dir_store() -> &'static StdMutex<Option<PathBuf>> {
    OPENCLAW_PREFERRED_RUNTIME_BIN_DIR.get_or_init(|| StdMutex::new(None))
}

pub(crate) fn get_preferred_runtime_bin_dir() -> Option<PathBuf> {
    preferred_runtime_bin_dir_store()
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .clone()
}

pub(crate) fn set_preferred_runtime_bin_dir(next: Option<PathBuf>) {
    let mut guard = preferred_runtime_bin_dir_store()
        .lock()
        .unwrap_or_else(|error| error.into_inner());
    *guard = next.filter(|path| !path.as_os_str().is_empty());
}

pub(crate) fn command_uses_node_runtime(command_name: &str) -> bool {
    matches!(command_name, "node" | "npm" | "npx" | "openclaw")
}

pub(crate) fn find_command_in_bin_dir(command_name: &str, bin_dir: &Path) -> Option<PathBuf> {
    select_preferred_path_candidate(find_all_commands_in_paths(
        command_name,
        &[bin_dir.to_path_buf()],
    ))
}

pub(crate) fn collect_existing_unique_dirs<I>(candidates: I) -> Vec<PathBuf>
where
    I: IntoIterator<Item = PathBuf>,
{
    let mut dirs = Vec::new();
    let mut seen = HashSet::new();

    for dir in candidates {
        if dir.as_os_str().is_empty() || !dir.exists() {
            continue;
        }
        if seen.insert(dir.clone()) {
            dirs.push(dir);
        }
    }

    dirs
}

pub(crate) async fn collect_preferred_runtime_command_dirs(
    command_name: &str,
    preferred_bin_dir: &Path,
) -> Result<Vec<PathBuf>, String> {
    let mut candidate_dirs = vec![preferred_bin_dir.to_path_buf()];

    if command_name == "openclaw" {
        if let Some(npm_path) = find_command_in_bin_dir("npm", preferred_bin_dir)
            .and_then(|path| path.to_str().map(str::to_string))
        {
            if let Some(prefix) = detect_npm_global_prefix(&npm_path).await {
                for dir in npm_global_command_dirs(&prefix) {
                    candidate_dirs.push(dir);
                }
            }
        }
    }

    Ok(collect_existing_unique_dirs(candidate_dirs))
}

pub(crate) async fn collect_preferred_runtime_command_candidates(
    command_name: &str,
) -> Result<Vec<PathBuf>, String> {
    if !command_uses_node_runtime(command_name) {
        return Ok(Vec::new());
    }

    let Some(preferred_bin_dir) = get_preferred_runtime_bin_dir() else {
        return Ok(Vec::new());
    };

    let search_dirs =
        collect_preferred_runtime_command_dirs(command_name, &preferred_bin_dir).await?;
    Ok(find_all_commands_in_paths(command_name, &search_dirs))
}

pub(crate) async fn find_command_in_shell(command_name: &str) -> Result<Option<String>, String> {
    let mut candidates = collect_standard_command_candidates(command_name).await?;

    if command_name == "openclaw" {
        candidates.extend(find_commands_via_npm_global_prefix(command_name).await?);
    }

    Ok(select_command_path(command_name, candidates)
        .await?
        .map(|path| path.to_string_lossy().to_string()))
}

pub(crate) async fn find_command_in_standard_locations(
    command_name: &str,
) -> Result<Option<String>, String> {
    Ok(select_command_path(
        command_name,
        collect_standard_command_candidates(command_name).await?,
    )
    .await?
    .map(|path| path.to_string_lossy().to_string()))
}

pub(crate) async fn collect_standard_command_candidates(
    command_name: &str,
) -> Result<Vec<PathBuf>, String> {
    collect_standard_command_candidates_with_preference(command_name, true).await
}

pub(crate) async fn collect_standard_command_candidates_without_preference(
    command_name: &str,
) -> Result<Vec<PathBuf>, String> {
    collect_standard_command_candidates_with_preference(command_name, false).await
}

pub(crate) async fn collect_standard_command_candidates_with_preference(
    command_name: &str,
    include_preferred_runtime: bool,
) -> Result<Vec<PathBuf>, String> {
    #[cfg(target_os = "windows")]
    {
        let _ = refresh_windows_path_from_registry();
    }

    let mut candidates = Vec::new();

    if include_preferred_runtime {
        candidates.extend(collect_preferred_runtime_command_candidates(command_name).await?);
    }

    #[cfg(target_os = "windows")]
    {
        candidates.extend(find_commands_via_where(command_name).await?);
    }

    candidates.extend(find_all_commands_in_known_locations(command_name));

    Ok(candidates)
}

pub(crate) async fn select_command_path(
    command_name: &str,
    candidates: Vec<PathBuf>,
) -> Result<Option<PathBuf>, String> {
    select_command_candidate(command_name, dedupe_paths(candidates)).await
}

#[cfg(target_os = "windows")]
pub(crate) async fn find_commands_via_where(command_name: &str) -> Result<Vec<PathBuf>, String> {
    let mut command = Command::new("cmd");
    apply_windows_no_window(&mut command);
    let output = command
        .arg("/C")
        .arg("where")
        .arg(command_name)
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .output()
        .await
        .map_err(|e| format!("查找命令失败: {e}"))?;

    if !output.status.success() {
        return Ok(Vec::new());
    }

    Ok(String::from_utf8_lossy(&output.stdout)
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(PathBuf::from)
        .collect())
}

pub(crate) async fn select_command_candidate(
    command_name: &str,
    candidates: Vec<PathBuf>,
) -> Result<Option<PathBuf>, String> {
    if candidates.is_empty() {
        return Ok(None);
    }

    let has_preferred_runtime =
        command_uses_node_runtime(command_name) && get_preferred_runtime_bin_dir().is_some();
    if let Some(candidate) = select_preferred_runtime_candidate(command_name, &candidates).await? {
        return Ok(Some(candidate));
    }
    if has_preferred_runtime {
        return Ok(None);
    }

    if command_name == "node" {
        return select_best_node_candidate(candidates).await;
    }

    if matches!(command_name, "npm" | "npx" | "openclaw") {
        return select_node_runtime_candidate(candidates).await;
    }

    if command_name == "git" {
        return Ok(select_best_git_candidate(candidates));
    }

    Ok(candidates.into_iter().next())
}

pub(crate) fn select_best_git_candidate(candidates: Vec<PathBuf>) -> Option<PathBuf> {
    select_preferred_path_candidate(candidates.clone()).or_else(|| candidates.into_iter().next())
}

pub(crate) async fn select_preferred_runtime_candidate(
    command_name: &str,
    candidates: &[PathBuf],
) -> Result<Option<PathBuf>, String> {
    if !command_uses_node_runtime(command_name) {
        return Ok(None);
    }

    let Some(preferred_bin_dir) = get_preferred_runtime_bin_dir() else {
        return Ok(None);
    };

    let preferred_dirs =
        collect_preferred_runtime_command_dirs(command_name, &preferred_bin_dir).await?;
    if preferred_dirs.is_empty() {
        return Ok(None);
    }

    Ok(select_preferred_path_candidate(
        candidates
            .iter()
            .filter(|candidate| {
                candidate
                    .parent()
                    .is_some_and(|parent| preferred_dirs.iter().any(|dir| dir.as_path() == parent))
            })
            .cloned()
            .collect(),
    ))
}

pub(crate) fn find_all_commands_in_known_locations(command_name: &str) -> Vec<PathBuf> {
    let search_dirs = collect_known_command_search_dirs(command_name);
    find_all_commands_in_paths(command_name, &search_dirs)
}

pub(crate) fn collect_known_command_search_dirs(_command_name: &str) -> Vec<PathBuf> {
    let mut search_dirs = Vec::new();

    if let Some(path_var) = std::env::var_os("PATH") {
        search_dirs.extend(std::env::split_paths(&path_var));
    }

    if let Some(home) = home_dir() {
        search_dirs.extend([
            home.join(".npm-global/bin"),
            home.join(".local/bin"),
            home.join(".bun/bin"),
            home.join(".volta/bin"),
            home.join(".asdf/shims"),
            home.join(".local/share/mise/shims"),
            home.join("Library/PhpWebStudy/env/node/bin"),
        ]);

        let nvm_versions = home.join(".nvm/versions/node");
        if let Ok(entries) = std::fs::read_dir(nvm_versions) {
            for entry in entries.flatten() {
                search_dirs.push(entry.path().join("bin"));
            }
        }

        let fnm_versions = home.join(".fnm/node-versions");
        if let Ok(entries) = std::fs::read_dir(fnm_versions) {
            for entry in entries.flatten() {
                search_dirs.push(entry.path().join("installation/bin"));
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        search_dirs.extend(windows_known_command_dirs_from_env());
        if _command_name == "git" {
            search_dirs.extend(windows_known_git_command_dirs_from_env());
        }
    }

    if cfg!(target_os = "macos") {
        search_dirs.extend([
            PathBuf::from("/opt/homebrew/bin"),
            PathBuf::from("/usr/local/bin"),
            PathBuf::from("/usr/bin"),
            PathBuf::from("/bin"),
        ]);
    }

    collect_existing_unique_dirs(search_dirs)
}

#[cfg(target_os = "windows")]
pub(crate) fn windows_known_command_dirs_from_env() -> Vec<PathBuf> {
    let mut dirs = Vec::new();

    if let Some(appdata) = std::env::var_os("APPDATA") {
        dirs.push(PathBuf::from(appdata).join("npm"));
    }

    if let Some(localappdata) = std::env::var_os("LOCALAPPDATA") {
        let localappdata = PathBuf::from(localappdata);
        dirs.push(localappdata.join("Programs").join("nodejs"));
        dirs.push(localappdata.join("Volta").join("bin"));
    }

    if let Some(program_files) = std::env::var_os("ProgramFiles") {
        dirs.push(PathBuf::from(program_files).join("nodejs"));
    }

    if let Some(program_files_x86) = std::env::var_os("ProgramFiles(x86)") {
        dirs.push(PathBuf::from(program_files_x86).join("nodejs"));
    }

    if let Some(home) = home_dir() {
        dirs.push(home.join("AppData").join("Roaming").join("npm"));
        dirs.push(
            home.join("AppData")
                .join("Local")
                .join("Programs")
                .join("nodejs"),
        );
    }

    dirs
}

#[cfg(any(target_os = "windows", test))]
pub(crate) fn windows_git_install_dir_variants(root: PathBuf) -> Vec<PathBuf> {
    vec![
        root.join("cmd"),
        root.join("bin"),
        root.join("mingw64").join("bin"),
    ]
}

#[cfg(target_os = "windows")]
pub(crate) fn windows_known_git_command_dirs_from_env() -> Vec<PathBuf> {
    let mut dirs = Vec::new();

    if let Some(program_files) = std::env::var_os("ProgramFiles") {
        dirs.extend(windows_git_install_dir_variants(
            PathBuf::from(program_files).join("Git"),
        ));
    }

    if let Some(program_files_x86) = std::env::var_os("ProgramFiles(x86)") {
        dirs.extend(windows_git_install_dir_variants(
            PathBuf::from(program_files_x86).join("Git"),
        ));
    }

    if let Some(localappdata) = std::env::var_os("LOCALAPPDATA") {
        dirs.extend(windows_git_install_dir_variants(
            PathBuf::from(localappdata).join("Programs").join("Git"),
        ));
    }

    if let Some(home) = home_dir() {
        dirs.extend(windows_git_install_dir_variants(
            home.join("scoop").join("apps").join("git").join("current"),
        ));
    }

    dirs
}

pub(crate) fn find_all_commands_in_paths(
    command_name: &str,
    search_dirs: &[PathBuf],
) -> Vec<PathBuf> {
    find_all_commands_in_paths_for(current_shell_platform(), command_name, search_dirs)
}

pub(crate) fn find_all_commands_in_paths_for(
    platform: ShellPlatform,
    command_name: &str,
    search_dirs: &[PathBuf],
) -> Vec<PathBuf> {
    let candidates = match platform {
        ShellPlatform::Windows => vec![
            format!("{command_name}.exe"),
            format!("{command_name}.cmd"),
            format!("{command_name}.bat"),
            command_name.to_string(),
        ],
        ShellPlatform::Unix => vec![command_name.to_string()],
    };

    let mut matches = Vec::new();
    let mut seen = HashSet::new();
    for dir in search_dirs {
        for candidate in &candidates {
            let path = dir.join(candidate);
            if path.is_file() && seen.insert(path.clone()) {
                matches.push(path);
            }
        }
    }

    matches
}

pub(crate) async fn find_commands_via_npm_global_prefix(
    command_name: &str,
) -> Result<Vec<PathBuf>, String> {
    let Some(npm_path) = find_command_in_standard_locations("npm").await? else {
        return Ok(Vec::new());
    };
    let Some(prefix) = detect_npm_global_prefix(&npm_path).await else {
        return Ok(Vec::new());
    };

    Ok(find_all_commands_in_paths(
        command_name,
        &npm_global_command_dirs(&prefix),
    ))
}

pub(crate) fn npm_global_command_dirs(prefix: &str) -> Vec<PathBuf> {
    npm_global_command_dirs_for(current_shell_platform(), prefix)
}

pub(crate) fn npm_global_command_dirs_for(platform: ShellPlatform, prefix: &str) -> Vec<PathBuf> {
    let prefix_path = PathBuf::from(prefix);

    match platform {
        ShellPlatform::Windows => vec![prefix_path],
        ShellPlatform::Unix => vec![prefix_path.join("bin"), prefix_path],
    }
}

pub(crate) fn npm_global_node_modules_dirs_for(
    platform: ShellPlatform,
    prefix: &str,
) -> Vec<PathBuf> {
    let prefix_path = PathBuf::from(prefix);

    match platform {
        ShellPlatform::Windows => vec![prefix_path.join("node_modules")],
        ShellPlatform::Unix => vec![
            prefix_path.join("lib").join("node_modules"),
            prefix_path.join("node_modules"),
        ],
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct InstalledOpenClawPackage {
    pub(crate) name: &'static str,
    pub(crate) version: Option<String>,
    pub(crate) path: PathBuf,
}

#[cfg(test)]
pub(crate) fn find_installed_openclaw_package(
    prefix: &str,
) -> Option<(&'static str, Option<String>)> {
    find_installed_openclaw_package_details(prefix).map(|package| (package.name, package.version))
}

pub(crate) fn find_installed_openclaw_package_details(
    prefix: &str,
) -> Option<InstalledOpenClawPackage> {
    for node_modules_dir in npm_global_node_modules_dirs_for(current_shell_platform(), prefix) {
        let openclaw_manifest = node_modules_dir.join("openclaw").join("package.json");
        if openclaw_manifest.is_file() {
            return Some(InstalledOpenClawPackage {
                name: "openclaw",
                version: read_package_version(&openclaw_manifest),
                path: openclaw_manifest,
            });
        }

        let zh_manifest = node_modules_dir
            .join("@qingchencloud")
            .join("openclaw-zh")
            .join("package.json");
        if zh_manifest.is_file() {
            return Some(InstalledOpenClawPackage {
                name: "@qingchencloud/openclaw-zh",
                version: read_package_version(&zh_manifest),
                path: zh_manifest,
            });
        }
    }

    None
}

pub(crate) fn read_package_version(manifest_path: &Path) -> Option<String> {
    #[derive(Deserialize)]
    struct PackageManifest {
        version: Option<String>,
    }

    let content = std::fs::read_to_string(manifest_path).ok()?;
    let manifest = serde_json::from_str::<PackageManifest>(&content).ok()?;
    manifest.version.filter(|item| !item.trim().is_empty())
}

pub(crate) fn resolve_openclaw_cli_entry_from_package_manifest(
    manifest_path: &Path,
) -> Option<PathBuf> {
    let package_root = manifest_path.parent()?;
    let content = std::fs::read_to_string(manifest_path).ok()?;
    let manifest = serde_json::from_str::<Value>(&content).ok()?;

    let mut candidates = Vec::new();

    if let Some(bin_value) = manifest.get("bin") {
        let bin_entry = match bin_value {
            Value::String(value) => Some(value.as_str()),
            Value::Object(entries) => entries
                .get("openclaw")
                .and_then(Value::as_str)
                .or_else(|| entries.values().find_map(Value::as_str)),
            _ => None,
        };

        if let Some(entry) = bin_entry {
            candidates.push(package_root.join(entry));
        }
    }

    candidates.push(package_root.join("dist").join("index.js"));
    candidates.push(package_root.join("dist").join("index.mjs"));
    candidates.push(package_root.join("dist").join("entry.js"));
    candidates.push(package_root.join("dist").join("entry.mjs"));

    candidates.into_iter().find(|path| path.is_file())
}

pub(crate) fn prefers_node_cli_for_openclaw_path(
    platform: ShellPlatform,
    openclaw_path: &Path,
) -> bool {
    matches!(platform, ShellPlatform::Windows)
        && openclaw_path
            .extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| matches!(ext.to_ascii_lowercase().as_str(), "cmd" | "bat"))
            .unwrap_or(false)
}

pub(crate) fn resolve_openclaw_command_from_runtime_candidate_for(
    platform: ShellPlatform,
    candidate: &OpenClawRuntimeCandidate,
) -> Option<ResolvedOpenClawCommand> {
    let openclaw_path = candidate
        .openclaw_path
        .as_deref()
        .map(PathBuf::from)
        .filter(|path| path.is_file());

    if let Some(openclaw_path) = openclaw_path.as_ref() {
        if !prefers_node_cli_for_openclaw_path(platform, openclaw_path) {
            return Some(ResolvedOpenClawCommand::Binary {
                binary_path: openclaw_path.clone(),
            });
        }
    }

    let node_path = PathBuf::from(candidate.node_path.as_str());
    let manifest_path = candidate
        .openclaw_package_path
        .as_deref()
        .map(PathBuf::from);

    if node_path.is_file() {
        if let Some(manifest_path) = manifest_path {
            if let Some(cli_path) = resolve_openclaw_cli_entry_from_package_manifest(&manifest_path)
            {
                return Some(ResolvedOpenClawCommand::NodeCli {
                    node_path,
                    cli_path,
                    package_version: read_package_version(&manifest_path),
                });
            }
        }
    }

    openclaw_path.map(|binary_path| ResolvedOpenClawCommand::Binary { binary_path })
}

pub(crate) fn resolve_openclaw_command_from_runtime_candidate(
    candidate: &OpenClawRuntimeCandidate,
) -> Option<ResolvedOpenClawCommand> {
    resolve_openclaw_command_from_runtime_candidate_for(current_shell_platform(), candidate)
}

pub(crate) fn runtime_candidate_matches_openclaw_path(
    candidate: &OpenClawRuntimeCandidate,
    openclaw_path: &Path,
) -> bool {
    candidate
        .openclaw_path
        .as_deref()
        .map(Path::new)
        .is_some_and(|candidate_path| candidate_path == openclaw_path)
        || openclaw_path
            .parent()
            .is_some_and(|parent| Path::new(&candidate.bin_dir) == parent)
        || candidate
            .npm_global_prefix
            .as_deref()
            .map(Path::new)
            .is_some_and(|prefix| openclaw_path.starts_with(prefix))
}

pub(crate) fn dedupe_openclaw_commands(
    commands: Vec<ResolvedOpenClawCommand>,
) -> Vec<ResolvedOpenClawCommand> {
    let mut deduped = Vec::with_capacity(commands.len());
    let mut seen = HashSet::new();
    for command in commands {
        if seen.insert(command.dedupe_key()) {
            deduped.push(command);
        }
    }
    deduped
}

pub(crate) fn dedupe_paths(candidates: Vec<PathBuf>) -> Vec<PathBuf> {
    let mut deduped = Vec::with_capacity(candidates.len());
    let mut seen = HashSet::new();
    for candidate in candidates {
        if seen.insert(candidate.clone()) {
            deduped.push(candidate);
        }
    }
    deduped
}

pub(crate) async fn resolve_openclaw_command() -> Result<Option<ResolvedOpenClawCommand>, String> {
    let shell_platform = current_shell_platform();
    let shell_binary = find_command_in_shell("openclaw").await?.map(PathBuf::from);
    let mut runtime_candidates = list_openclaw_runtime_candidates().await?;
    runtime_candidates.sort_by(compare_openclaw_runtime_candidates);

    if let Some(shell_binary) = shell_binary.as_ref() {
        if !prefers_node_cli_for_openclaw_path(shell_platform, shell_binary) {
            return Ok(Some(ResolvedOpenClawCommand::Binary {
                binary_path: shell_binary.clone(),
            }));
        }

        if let Some(command) = runtime_candidates
            .iter()
            .filter(|candidate| runtime_candidate_matches_openclaw_path(candidate, shell_binary))
            .find_map(|candidate| {
                resolve_openclaw_command_from_runtime_candidate_for(shell_platform, candidate)
            })
        {
            return Ok(Some(command));
        }
    }

    if let Some(command) = runtime_candidates.iter().find_map(|candidate| {
        resolve_openclaw_command_from_runtime_candidate_for(shell_platform, candidate)
    }) {
        return Ok(Some(command));
    }

    Ok(shell_binary.map(|binary_path| ResolvedOpenClawCommand::Binary { binary_path }))
}

pub(crate) async fn read_openclaw_version_from_command(
    command_spec: &ResolvedOpenClawCommand,
) -> Result<Option<String>, String> {
    if let Some(version) = command_spec.fallback_version() {
        return Ok(Some(version));
    }

    let output = command_spec
        .build_command_with_args(["--version"])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await
        .map_err(|e| format!("读取 OpenClaw 版本失败: {e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if stdout.is_empty() {
        Ok(None)
    } else {
        Ok(Some(stdout))
    }
}

pub(crate) async fn list_openclaw_runtime_candidates(
) -> Result<Vec<OpenClawRuntimeCandidate>, String> {
    let node_candidates =
        dedupe_paths(collect_standard_command_candidates_without_preference("node").await?);
    let preferred_bin_dir = get_preferred_runtime_bin_dir().filter(|dir| dir.is_dir());
    let auto_selected_node = select_best_node_candidate(node_candidates.clone()).await?;
    let active_bin_dir = preferred_bin_dir.clone().or_else(|| {
        auto_selected_node
            .as_ref()
            .and_then(|path| path.parent().map(Path::to_path_buf))
    });

    let mut runtimes = Vec::new();
    let mut seen_bin_dirs = HashSet::new();
    for node_path in node_candidates {
        let Some(bin_dir) = node_path.parent().map(Path::to_path_buf) else {
            continue;
        };
        if !seen_bin_dirs.insert(bin_dir.clone()) {
            continue;
        }

        runtimes.push(
            inspect_openclaw_runtime_candidate(
                &bin_dir,
                preferred_bin_dir.as_deref(),
                active_bin_dir.as_deref(),
            )
            .await,
        );
    }

    runtimes.sort_by(compare_openclaw_runtime_candidates);
    Ok(runtimes)
}

pub(crate) async fn inspect_openclaw_runtime_candidate(
    bin_dir: &Path,
    preferred_bin_dir: Option<&Path>,
    active_bin_dir: Option<&Path>,
) -> OpenClawRuntimeCandidate {
    let node_path = find_command_in_bin_dir("node", bin_dir).unwrap_or_else(|| {
        #[cfg(target_os = "windows")]
        let node_name = "node.exe";
        #[cfg(not(target_os = "windows"))]
        let node_name = "node";

        bin_dir.join(node_name)
    });

    let npm_path = find_command_in_bin_dir("npm", bin_dir);
    let npm_path_string = npm_path.as_ref().map(|path| path.display().to_string());
    let npm_global_prefix = match npm_path_string.as_deref() {
        Some(path) => detect_npm_global_prefix(path).await,
        None => None,
    };
    let openclaw_path = resolve_runtime_openclaw_path(bin_dir, npm_global_prefix.as_deref());
    let openclaw_package_path = npm_global_prefix
        .as_deref()
        .and_then(find_installed_openclaw_package_details)
        .map(|package| package.path.display().to_string());

    OpenClawRuntimeCandidate {
        id: bin_dir.display().to_string(),
        source: infer_openclaw_runtime_source(bin_dir),
        bin_dir: bin_dir.display().to_string(),
        node_path: node_path.display().to_string(),
        node_version: read_display_version_text(&node_path).await,
        npm_path: npm_path_string,
        npm_global_prefix,
        openclaw_path: openclaw_path
            .as_ref()
            .map(|path| path.display().to_string()),
        openclaw_version: match openclaw_path.as_deref() {
            Some(path) => read_display_version_text(path).await,
            None => None,
        },
        openclaw_package_path,
        is_active: active_bin_dir.is_some_and(|path| path == bin_dir),
        is_preferred: preferred_bin_dir.is_some_and(|path| path == bin_dir),
    }
}

pub(crate) fn resolve_runtime_openclaw_path(
    bin_dir: &Path,
    npm_global_prefix: Option<&str>,
) -> Option<PathBuf> {
    find_command_in_bin_dir("openclaw", bin_dir).or_else(|| {
        npm_global_prefix.and_then(|prefix| {
            select_preferred_path_candidate(find_all_commands_in_paths(
                "openclaw",
                &npm_global_command_dirs(prefix),
            ))
        })
    })
}

pub(crate) async fn read_display_version_text(binary_path: &Path) -> Option<String> {
    let path = binary_path.to_str()?;
    let version_text = read_command_version_text(path, &["--version"]).await.ok()?;
    let version_text = version_text.trim();
    if version_text.is_empty() {
        return None;
    }

    Some(
        parse_semver_from_text(version_text)
            .map(format_semver)
            .unwrap_or_else(|| version_text.to_string()),
    )
}

pub(crate) fn infer_openclaw_runtime_source(bin_dir: &Path) -> String {
    let normalized = bin_dir
        .display()
        .to_string()
        .replace('\\', "/")
        .to_lowercase();

    if normalized.contains("/.nvm/") {
        return "nvm".to_string();
    }
    if normalized.contains("/phpwebstudy/") {
        return "PhpWebStudy".to_string();
    }
    if normalized.contains("/.volta/") {
        return "Volta".to_string();
    }
    if normalized.contains("/.fnm/") {
        return "fnm".to_string();
    }
    if normalized.contains("/.asdf/") {
        return "asdf".to_string();
    }
    if normalized.contains("/mise/") {
        return "mise".to_string();
    }
    if normalized.contains("/opt/homebrew/") {
        return "Homebrew".to_string();
    }
    if normalized.ends_with("/usr/local/bin")
        || normalized.ends_with("/usr/bin")
        || normalized.ends_with("/bin")
        || normalized.contains("/program files/nodejs")
        || normalized.contains("/program files (x86)/nodejs")
    {
        return "系统".to_string();
    }

    "PATH".to_string()
}

pub(crate) fn compare_openclaw_runtime_candidates(
    left: &OpenClawRuntimeCandidate,
    right: &OpenClawRuntimeCandidate,
) -> Ordering {
    right
        .is_active
        .cmp(&left.is_active)
        .then_with(|| right.is_preferred.cmp(&left.is_preferred))
        .then_with(|| {
            right
                .openclaw_path
                .is_some()
                .cmp(&left.openclaw_path.is_some())
        })
        .then_with(|| {
            compare_optional_semver_desc(
                left.node_version.as_deref(),
                right.node_version.as_deref(),
            )
        })
        .then_with(|| left.bin_dir.cmp(&right.bin_dir))
}

pub(crate) fn compare_optional_semver_desc(left: Option<&str>, right: Option<&str>) -> Ordering {
    match (
        left.and_then(parse_semver_from_text),
        right.and_then(parse_semver_from_text),
    ) {
        (Some(left), Some(right)) => right.cmp(&left),
        (Some(_), None) => Ordering::Less,
        (None, Some(_)) => Ordering::Greater,
        (None, None) => Ordering::Equal,
    }
}

pub(crate) async fn select_best_node_candidate(
    candidates: Vec<PathBuf>,
) -> Result<Option<PathBuf>, String> {
    let mut versioned = Vec::with_capacity(candidates.len());
    for candidate in candidates {
        let openclaw_signal = match candidate.parent() {
            Some(bin_dir) => inspect_node_runtime_openclaw_signal(bin_dir).await,
            None => 0,
        };
        let version = read_binary_semver(&candidate).await;
        versioned.push((candidate, openclaw_signal, version));
    }
    Ok(select_best_node_runtime_candidate(versioned))
}

pub(crate) async fn select_node_runtime_candidate(
    candidates: Vec<PathBuf>,
) -> Result<Option<PathBuf>, String> {
    let mut runtime_ranked = Vec::with_capacity(candidates.len());
    for candidate in &candidates {
        let openclaw_signal = match candidate.parent() {
            Some(bin_dir) => inspect_node_runtime_openclaw_signal(bin_dir).await,
            None => 0,
        };
        let version = match sibling_node_path(candidate) {
            Some(node_path) => read_binary_semver(&node_path).await,
            None => None,
        };
        runtime_ranked.push((candidate.clone(), openclaw_signal, version));
    }

    if let Some(candidate) = select_best_node_runtime_candidate(runtime_ranked.clone()) {
        let candidate_signal = runtime_ranked
            .iter()
            .find(|(path, _, _)| path == &candidate)
            .map(|(_, signal, _)| *signal)
            .unwrap_or(0);
        if candidate_signal > 0 {
            return Ok(Some(candidate));
        }
    }

    let preferred_node =
        select_best_node_candidate(find_all_commands_in_known_locations("node")).await?;
    if let Some(preferred_bin_dir) = preferred_node.as_deref().and_then(Path::parent) {
        if let Some(candidate) = select_preferred_path_candidate(
            candidates
                .iter()
                .filter(|candidate| candidate.parent() == Some(preferred_bin_dir))
                .cloned()
                .collect(),
        ) {
            return Ok(Some(candidate));
        }
    }

    Ok(
        select_best_node_runtime_candidate(runtime_ranked)
            .or_else(|| candidates.into_iter().next()),
    )
}

pub(crate) async fn inspect_node_runtime_openclaw_signal(bin_dir: &Path) -> u8 {
    if find_command_in_bin_dir("openclaw", bin_dir).is_some() {
        return 3;
    }

    let Some(npm_path) =
        find_command_in_bin_dir("npm", bin_dir).and_then(|path| path.to_str().map(str::to_string))
    else {
        return 0;
    };

    let Some(prefix) = detect_npm_global_prefix(&npm_path).await else {
        return 0;
    };

    if select_preferred_path_candidate(find_all_commands_in_paths(
        "openclaw",
        &npm_global_command_dirs(&prefix),
    ))
    .is_some()
    {
        return 3;
    }

    if find_installed_openclaw_package_details(&prefix).is_some() {
        return 2;
    }

    0
}

pub(crate) fn select_best_node_runtime_candidate(
    candidates: Vec<(PathBuf, u8, Option<(u64, u64, u64)>)>,
) -> Option<PathBuf> {
    candidates
        .into_iter()
        .max_by(
            |(left_path, left_signal, left_version), (right_path, right_signal, right_version)| {
                left_signal
                    .cmp(right_signal)
                    .then_with(|| left_version.cmp(right_version))
                    .then_with(|| {
                        let preferred = select_preferred_path_candidate(vec![
                            left_path.clone(),
                            right_path.clone(),
                        ]);
                        match preferred.as_ref() {
                            Some(path) if path == left_path => std::cmp::Ordering::Greater,
                            Some(path) if path == right_path => std::cmp::Ordering::Less,
                            _ => std::cmp::Ordering::Equal,
                        }
                    })
            },
        )
        .map(|(path, _, _)| path)
}

pub(crate) fn sibling_node_path(command_path: &Path) -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    let node_name = "node.exe";

    #[cfg(not(target_os = "windows"))]
    let node_name = "node";

    let node_path = command_path.parent()?.join(node_name);
    node_path.is_file().then_some(node_path)
}

pub(crate) async fn read_binary_semver(path: &Path) -> Option<(u64, u64, u64)> {
    let mut command = Command::new(path);
    apply_windows_no_window(&mut command);
    let output = command
        .arg("--version")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await
        .ok()?;
    if !output.status.success() {
        return None;
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    parse_semver(stdout.trim()).or_else(|| parse_semver(stderr.trim()))
}

#[cfg_attr(not(test), allow(dead_code))]
pub(crate) fn select_best_semver_candidate(
    candidates: Vec<(PathBuf, Option<(u64, u64, u64)>)>,
) -> Option<PathBuf> {
    core_select_best_semver_candidate(candidates, NODE_MIN_VERSION)
}

pub(crate) fn select_preferred_path_candidate(candidates: Vec<PathBuf>) -> Option<PathBuf> {
    core_select_preferred_path_candidate(candidates)
}
