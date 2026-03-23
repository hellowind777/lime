use super::*;

pub(crate) fn command_output_lines(output: &[u8]) -> Vec<String> {
    String::from_utf8_lossy(output)
        .lines()
        .map(sanitize_progress_line)
        .filter(|line| !line.is_empty())
        .collect()
}

pub(crate) fn normalize_process_probe_text(value: &str) -> String {
    value.replace('\\', "/").to_ascii_lowercase()
}

pub(crate) fn process_looks_like_openclaw_process(
    process_name: &str,
    exe_path: Option<&Path>,
    command_args: &[OsString],
) -> bool {
    let process_name = normalize_process_probe_text(process_name);
    let exe_path = exe_path
        .map(|path| normalize_process_probe_text(&path.display().to_string()))
        .unwrap_or_default();
    let command_line = normalize_process_probe_text(
        &command_args
            .iter()
            .map(|arg| arg.to_string_lossy())
            .collect::<Vec<_>>()
            .join(" "),
    );

    process_name.contains("openclaw")
        || exe_path.contains("openclaw")
        || command_line.contains("openclaw")
}

pub(crate) fn collect_openclaw_process_family_pids(
    system: &System,
    listener_pids: &[u32],
) -> Vec<Pid> {
    let mut target_pids = HashSet::new();

    for listener_pid in listener_pids {
        let pid = Pid::from_u32(*listener_pid);
        let Some(process) = system.process(pid) else {
            continue;
        };
        if !process_looks_like_openclaw_process(
            &process.name().to_string_lossy(),
            process.exe(),
            process.cmd(),
        ) {
            continue;
        }

        target_pids.insert(pid);
        let mut parent_pid = process.parent();
        while let Some(next_parent) = parent_pid {
            let Some(parent_process) = system.process(next_parent) else {
                break;
            };
            if !process_looks_like_openclaw_process(
                &parent_process.name().to_string_lossy(),
                parent_process.exe(),
                parent_process.cmd(),
            ) {
                break;
            }

            target_pids.insert(next_parent);
            parent_pid = parent_process.parent();
        }
    }

    let mut target_pids = target_pids.into_iter().collect::<Vec<_>>();
    target_pids.sort_by_key(|pid| pid.as_u32());
    target_pids
}

pub(crate) async fn terminate_sysinfo_processes(system: &mut System, target_pids: &[Pid]) {
    for pid in target_pids {
        if let Some(process) = system.process(*pid) {
            let terminated = process.kill_with(Signal::Term).unwrap_or(false);
            if !terminated {
                let _ = process.kill();
            }
        }
    }

    sleep(Duration::from_millis(900)).await;
    system.refresh_all();

    for pid in target_pids {
        if let Some(process) = system.process(*pid) {
            let _ = process.kill();
        }
    }
}

#[cfg_attr(target_os = "windows", allow(dead_code))]
pub(crate) fn parse_lsof_listener_pids(output: &str) -> Vec<u32> {
    let mut pids = output
        .lines()
        .filter_map(|line| line.trim().parse::<u32>().ok())
        .collect::<Vec<_>>();
    pids.sort_unstable();
    pids.dedup();
    pids
}

#[cfg_attr(not(target_os = "windows"), allow(dead_code))]
pub(crate) fn parse_windows_netstat_listener_pids(output: &str, port: u16) -> Vec<u32> {
    let mut pids = output
        .lines()
        .filter_map(|line| {
            let columns = line.split_whitespace().collect::<Vec<_>>();
            if columns.len() < 5 {
                return None;
            }

            let local_address = columns.get(1).copied().unwrap_or_default();
            let state = columns.get(3).copied().unwrap_or_default();
            if !state.eq_ignore_ascii_case("LISTENING")
                || !local_address.ends_with(&format!(":{port}"))
            {
                return None;
            }

            columns.last().and_then(|value| value.parse::<u32>().ok())
        })
        .collect::<Vec<_>>();
    pids.sort_unstable();
    pids.dedup();
    pids
}

pub(crate) async fn collect_listening_port_pids(port: u16) -> Vec<u32> {
    #[cfg(target_os = "windows")]
    {
        collect_listening_port_pids_windows(port).await
    }

    #[cfg(not(target_os = "windows"))]
    {
        collect_listening_port_pids_unix(port).await
    }
}

#[cfg(not(target_os = "windows"))]
pub(crate) async fn collect_listening_port_pids_unix(port: u16) -> Vec<u32> {
    let mut command = Command::new("lsof");
    apply_windows_no_window(&mut command);
    let output = timeout(
        Duration::from_secs(3),
        command
            .arg("-nP")
            .arg(format!("-iTCP:{port}"))
            .arg("-sTCP:LISTEN")
            .arg("-t")
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .output(),
    )
    .await;

    match output {
        Ok(Ok(result)) if result.status.success() => {
            parse_lsof_listener_pids(&String::from_utf8_lossy(&result.stdout))
        }
        _ => Vec::new(),
    }
}

#[cfg(target_os = "windows")]
pub(crate) async fn collect_listening_port_pids_windows(port: u16) -> Vec<u32> {
    let mut command = Command::new("netstat");
    apply_windows_no_window(&mut command);
    let output = timeout(
        Duration::from_secs(3),
        command
            .arg("-ano")
            .arg("-p")
            .arg("tcp")
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .output(),
    )
    .await;

    match output {
        Ok(Ok(result)) if result.status.success() => {
            parse_windows_netstat_listener_pids(&String::from_utf8_lossy(&result.stdout), port)
        }
        _ => Vec::new(),
    }
}
