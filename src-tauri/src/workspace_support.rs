use crate::workspace::{Workspace, WorkspaceManager, WorkspaceType};
use lime_core::app_paths;
use std::path::PathBuf;

pub(crate) fn get_workspace_projects_root_dir() -> Result<PathBuf, String> {
    app_paths::resolve_projects_dir()
}

pub(crate) fn resolve_default_project_path() -> Result<PathBuf, String> {
    app_paths::resolve_default_project_dir()
}

pub(crate) fn sanitize_project_dir_name(name: &str) -> String {
    let sanitized: String = name
        .trim()
        .chars()
        .map(|ch| match ch {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            _ if ch.is_control() => '_',
            _ => ch,
        })
        .collect();

    let trimmed = sanitized.trim().trim_matches('.').to_string();
    if trimmed.is_empty() {
        "未命名项目".to_string()
    } else {
        trimmed
    }
}

pub(crate) fn get_or_create_default_project(
    manager: &WorkspaceManager,
) -> Result<Workspace, String> {
    if let Some(workspace) = manager.get_default()? {
        return Ok(workspace);
    }

    let default_project_path = resolve_default_project_path()?;
    std::fs::create_dir_all(&default_project_path)
        .map_err(|e| format!("创建默认项目目录失败: {e}"))?;

    let workspace = manager.create_with_type(
        "默认项目".to_string(),
        default_project_path,
        WorkspaceType::Persistent,
    )?;
    manager.set_default(&workspace.id)?;

    manager
        .get(&workspace.id)?
        .ok_or_else(|| "创建默认项目失败".to_string())
}

#[cfg(test)]
mod tests {
    use super::sanitize_project_dir_name;

    #[test]
    fn sanitize_project_dir_name_should_replace_invalid_chars() {
        assert_eq!(sanitize_project_dir_name("  a/b:c*?d  "), "a_b_c__d");
    }

    #[test]
    fn sanitize_project_dir_name_should_fallback_when_empty() {
        assert_eq!(sanitize_project_dir_name(" .. "), "未命名项目");
    }
}
