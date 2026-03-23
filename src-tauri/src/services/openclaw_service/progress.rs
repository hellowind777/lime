use super::*;

pub(crate) async fn run_shell_command_with_progress(
    app: &AppHandle,
    command_line: &str,
) -> Result<ActionResult, String> {
    let mut child = spawn_shell_command(command_line)?;

    let stdout_task = child.stdout.take().map(|stdout| {
        let app = app.clone();
        tokio::spawn(async move {
            stream_reader_to_progress(app, stdout, "info").await;
        })
    });

    let stderr_task = child.stderr.take().map(|stderr| {
        let app = app.clone();
        tokio::spawn(async move {
            stream_reader_to_progress(app, stderr, "error").await;
        })
    });

    let status = child
        .wait()
        .await
        .map_err(|e| format!("执行命令失败: {e}"))?;

    if let Some(task) = stdout_task {
        let _ = task.await;
    }
    if let Some(task) = stderr_task {
        let _ = task.await;
    }

    if status.success() {
        emit_install_progress(app, "命令执行成功。", "info");
        Ok(ActionResult {
            success: true,
            message: "操作成功完成。".to_string(),
        })
    } else {
        emit_install_progress(
            app,
            &format!("命令执行失败，退出码: {:?}", status.code()),
            "error",
        );
        Ok(ActionResult {
            success: false,
            message: format!("命令执行失败，退出码: {:?}", status.code()),
        })
    }
}

pub(crate) fn spawn_shell_command(command_line: &str) -> Result<Child, String> {
    let mut command = if cfg!(target_os = "windows") {
        let mut cmd = Command::new("cmd");
        cmd.arg("/C").arg(command_line);
        cmd
    } else if cfg!(target_os = "macos") {
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
        let mut cmd = Command::new("script");
        cmd.arg("-q")
            .arg("/dev/null")
            .arg(shell)
            .arg("-lc")
            .arg(command_line);
        cmd
    } else {
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string());
        let mut cmd = Command::new(shell);
        cmd.arg("-lc").arg(command_line);
        cmd
    };

    apply_windows_no_window(&mut command);

    command
        .env("NO_COLOR", "1")
        .env("CLICOLOR", "0")
        .env("FORCE_COLOR", "0")
        .env("npm_config_color", "false")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    command.spawn().map_err(|e| format!("启动命令失败: {e}"))
}

pub(crate) async fn stream_reader_to_progress<R>(
    app: AppHandle,
    mut reader: R,
    default_level: &'static str,
) where
    R: AsyncRead + Unpin,
{
    let mut buffer = [0_u8; 2048];
    let mut pending = String::new();

    loop {
        match reader.read(&mut buffer).await {
            Ok(0) => break,
            Ok(size) => {
                pending.push_str(&String::from_utf8_lossy(&buffer[..size]));
                flush_progress_chunks(&app, &mut pending, default_level);
            }
            Err(error) => {
                emit_install_progress(&app, &format!("读取命令输出失败: {error}"), "warn");
                break;
            }
        }
    }

    let tail = pending.trim();
    if !tail.is_empty() {
        emit_install_progress(&app, tail, classify_progress_level(tail, default_level));
    }
}

pub(crate) fn flush_progress_chunks(
    app: &AppHandle,
    pending: &mut String,
    default_level: &'static str,
) {
    loop {
        let next_break = pending.find(['\n', '\r']);
        let Some(index) = next_break else {
            break;
        };

        let mut line = pending[..index].trim().to_string();
        let mut consume_len = index + 1;
        while pending
            .get(consume_len..consume_len + 1)
            .is_some_and(|ch| ch == "\n" || ch == "\r")
        {
            consume_len += 1;
        }

        pending.drain(..consume_len);

        if line.is_empty() {
            continue;
        }

        line = sanitize_progress_line(&line);
        if line.is_empty() {
            continue;
        }

        emit_install_progress(app, &line, classify_progress_level(&line, default_level));
    }

    if pending.len() > 4096 {
        let line = sanitize_progress_line(pending.trim());
        if !line.is_empty() {
            emit_install_progress(app, &line, classify_progress_level(&line, default_level));
        }
        pending.clear();
    }
}

pub(crate) fn sanitize_progress_line(value: &str) -> String {
    value
        .replace('\u{1b}', "")
        .replace("[?25h", "")
        .replace("[?25l", "")
        .trim()
        .to_string()
}

pub(crate) fn classify_progress_level(message: &str, default_level: &'static str) -> &'static str {
    let lower = message.to_ascii_lowercase();
    if lower.contains("error") || lower.contains("fatal") {
        "error"
    } else if lower.contains("warn") || lower.contains("warning") {
        "warn"
    } else {
        default_level
    }
}

pub(crate) fn emit_install_progress(app: &AppHandle, message: &str, level: &str) {
    if let Some(service_state) = app.try_state::<OpenClawServiceState>() {
        if let Ok(mut service) = service_state.0.try_lock() {
            service.push_progress_log(message.to_string(), level.to_string());
        }
    }

    let payload = InstallProgressEvent {
        message: message.to_string(),
        level: level.to_string(),
    };
    let _ = app.emit(OPENCLAW_INSTALL_EVENT, payload);
}

pub(crate) fn parse_semver(value: &str) -> Option<(u64, u64, u64)> {
    let sanitized = value.trim().trim_start_matches('v');
    let core = sanitized.split(['-', '+']).next()?;
    let mut parts = core.split('.');
    let major = parts.next()?.parse().ok()?;
    let minor = parts.next().unwrap_or("0").parse().ok()?;
    let patch = parts.next().unwrap_or("0").parse().ok()?;
    Some((major, minor, patch))
}

pub(crate) fn parse_semver_from_text(value: &str) -> Option<(u64, u64, u64)> {
    parse_semver(value).or_else(|| {
        value
            .split(|ch: char| ch.is_whitespace() || ch == ',' || ch == '(' || ch == ')')
            .find_map(parse_semver)
    })
}

pub(crate) fn format_semver(version: (u64, u64, u64)) -> String {
    format!("{}.{}.{}", version.0, version.1, version.2)
}
