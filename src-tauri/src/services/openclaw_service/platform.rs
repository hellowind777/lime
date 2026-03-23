use super::*;

pub(crate) fn generate_auth_token() -> String {
    rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(48)
        .map(char::from)
        .collect()
}

pub(crate) async fn should_use_china_package(app: &AppHandle) -> bool {
    if let Some(app_state) = app.try_state::<AppState>() {
        let language = {
            let state = app_state.read().await;
            state.config.language.clone()
        };

        if language.starts_with("zh") {
            return true;
        }
    }

    let locale = std::env::var("LC_ALL")
        .ok()
        .or_else(|| std::env::var("LANG").ok())
        .unwrap_or_default()
        .to_lowercase();
    let timezone = std::env::var("TZ").unwrap_or_default().to_lowercase();
    locale.contains("zh_cn") || locale.contains("zh-hans") || timezone.contains("shanghai")
}

pub(crate) async fn detect_npm_global_prefix(npm_path: &str) -> Option<String> {
    let mut command = Command::new(npm_path);
    apply_binary_runtime_path(&mut command, npm_path);
    let output = command
        .arg("config")
        .arg("get")
        .arg("prefix")
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .output()
        .await
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let prefix = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if prefix.is_empty() || prefix.eq_ignore_ascii_case("undefined") {
        None
    } else {
        Some(prefix)
    }
}

pub(crate) fn current_shell_platform() -> ShellPlatform {
    if cfg!(target_os = "windows") {
        ShellPlatform::Windows
    } else {
        ShellPlatform::Unix
    }
}

#[allow(dead_code)]
pub(crate) fn command_bin_dir_for(platform: ShellPlatform, binary_path: &str) -> Option<String> {
    core_command_bin_dir_for(platform, binary_path)
}

pub(crate) fn shell_command_escape_for(platform: ShellPlatform, value: &str) -> String {
    core_shell_command_escape_for(platform, value)
}

pub(crate) fn shell_command_invocation_prefix_for(
    platform: ShellPlatform,
    binary_path: &str,
) -> String {
    core_shell_command_invocation_prefix_for(platform, binary_path)
}

#[cfg_attr(target_os = "windows", allow(dead_code))]
pub(crate) fn shell_command_escape(value: &str) -> String {
    shell_command_escape_for(current_shell_platform(), value)
}

#[allow(dead_code)]
pub(crate) fn shell_npm_prefix_assignment_for(platform: ShellPlatform, value: &str) -> String {
    core_shell_npm_prefix_assignment_for(platform, value)
}

pub(crate) fn shell_path_assignment_for(platform: ShellPlatform, binary_path: &str) -> String {
    core_shell_path_assignment_for(platform, binary_path)
}

#[cfg_attr(target_os = "windows", allow(dead_code))]
pub(crate) fn shell_path_assignment(binary_path: &str) -> String {
    shell_path_assignment_for(current_shell_platform(), binary_path)
}

pub(crate) fn build_openclaw_cleanup_command(
    platform: ShellPlatform,
    npm_path: &str,
    npm_prefix: Option<&str>,
) -> String {
    core_build_openclaw_cleanup_command(platform, npm_path, npm_prefix)
}

pub(crate) fn build_openclaw_install_command(
    platform: ShellPlatform,
    npm_path: &str,
    npm_prefix: Option<&str>,
    package: &str,
    registry: Option<&str>,
) -> String {
    core_build_openclaw_install_command(platform, npm_path, npm_prefix, package, registry)
}

pub(crate) fn build_openclaw_pnpm_install_command(
    platform: ShellPlatform,
    pnpm_path: &str,
    package: &str,
    registry: Option<&str>,
) -> String {
    let mut command = format!(
        "{}{}{} add -g {}",
        shell_path_assignment_for(platform, pnpm_path),
        shell_command_invocation_prefix_for(platform, pnpm_path),
        shell_command_escape_for(platform, pnpm_path),
        shell_command_escape_for(platform, package),
    );

    if let Some(registry) = registry {
        command.push(' ');
        command.push_str("--registry=");
        command.push_str(&shell_command_escape_for(platform, registry));
    }

    command
}

#[allow(dead_code)]
pub(crate) fn resolve_windows_dependency_install_plan(
    dependency: DependencyKind,
    has_winget: bool,
) -> WindowsDependencyInstallPlan {
    core_resolve_windows_dependency_install_plan(
        match dependency {
            DependencyKind::Node => OpenClawInstallDependencyKind::Node,
            DependencyKind::Git => OpenClawInstallDependencyKind::Git,
        },
        has_winget,
    )
}

#[allow(dead_code)]
pub(crate) fn build_winget_install_command(winget_path: &str, package_id: &str) -> String {
    core_build_winget_install_command(winget_path, package_id)
}

#[allow(dead_code)]
pub(crate) fn windows_manual_install_message(dependency: DependencyKind) -> &'static str {
    core_windows_manual_install_message(match dependency {
        DependencyKind::Node => OpenClawInstallDependencyKind::Node,
        DependencyKind::Git => OpenClawInstallDependencyKind::Git,
    })
}

pub(crate) fn prepend_path(dir: &Path) -> Option<OsString> {
    let mut paths = vec![dir.to_path_buf()];
    if let Some(current) = std::env::var_os("PATH") {
        paths.extend(std::env::split_paths(&current));
    }
    std::env::join_paths(paths).ok()
}

pub(crate) fn apply_binary_runtime_path(command: &mut Command, binary_path: &str) {
    apply_windows_no_window(command);

    let Some(bin_dir) = Path::new(binary_path).parent() else {
        return;
    };
    if let Some(path) = prepend_path(bin_dir) {
        command.env("PATH", path);
    }
}

pub(crate) fn apply_windows_no_window(_command: &mut Command) {
    #[cfg(target_os = "windows")]
    {
        _command.creation_flags(CREATE_NO_WINDOW);
    }
}

#[cfg(target_os = "windows")]
pub(crate) fn refresh_windows_path_from_registry() -> Result<(), String> {
    unsafe {
        let mut combined_path = String::new();

        // 读取系统 PATH (HKEY_LOCAL_MACHINE)
        if let Ok(system_path) = read_registry_path(HKEY_LOCAL_MACHINE) {
            combined_path.push_str(&system_path);
        }

        // 读取用户 PATH (HKEY_CURRENT_USER)
        if let Ok(user_path) = read_registry_path(HKEY_CURRENT_USER) {
            if !combined_path.is_empty() {
                combined_path.push(';');
            }
            combined_path.push_str(&user_path);
        }

        if !combined_path.is_empty() {
            std::env::set_var("PATH", combined_path);
        }
    }

    Ok(())
}

#[cfg(target_os = "windows")]
pub(crate) unsafe fn read_registry_path(root_key: HKEY) -> Result<String, String> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use std::ptr;

    let subkey: Vec<u16> = OsStr::new("Environment")
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    let value_name: Vec<u16> = OsStr::new("Path")
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    let mut key: HKEY = ptr::null_mut();
    let result = RegOpenKeyExW(
        root_key,
        subkey.as_ptr(),
        0,
        winapi::um::winnt::KEY_READ,
        &mut key,
    );

    if result != ERROR_SUCCESS as i32 {
        return Err(format!("无法打开注册表键: {}", result));
    }

    let mut buffer_size: DWORD = 0;
    let result = RegQueryValueExW(
        key,
        value_name.as_ptr(),
        ptr::null_mut(),
        ptr::null_mut(),
        ptr::null_mut(),
        &mut buffer_size,
    );

    if result != ERROR_SUCCESS as i32 {
        winapi::um::winreg::RegCloseKey(key);
        return Err(format!("无法查询注册表值大小: {}", result));
    }

    let mut buffer: Vec<u16> = vec![0; (buffer_size / 2) as usize + 1];
    let result = RegQueryValueExW(
        key,
        value_name.as_ptr(),
        ptr::null_mut(),
        ptr::null_mut(),
        buffer.as_mut_ptr() as *mut u8,
        &mut buffer_size,
    );

    winapi::um::winreg::RegCloseKey(key);

    if result != ERROR_SUCCESS as i32 {
        return Err(format!("无法读取注册表值: {}", result));
    }

    // 移除尾部的 null 字符
    if let Some(null_pos) = buffer.iter().position(|&c| c == 0) {
        buffer.truncate(null_pos);
    }

    Ok(String::from_utf16_lossy(&buffer))
}

#[cfg(not(target_os = "windows"))]
#[allow(dead_code)]
pub(crate) fn refresh_windows_path_from_registry() -> Result<(), String> {
    Ok(())
}
