use aster::session::{
    list_subagent_child_sessions, list_subagent_sessions_with_metadata,
    resolve_subagent_session_metadata, Session, SessionManager, SessionType,
};
use std::collections::{HashMap, HashSet, VecDeque};

fn normalize_optional_text(value: Option<String>) -> Option<String> {
    let trimmed = value?.trim().to_string();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed)
    }
}

pub(crate) fn ensure_subagent_session(session: &Session) -> Result<(), String> {
    if session.session_type != SessionType::SubAgent {
        return Err(format!(
            "会话不是 subagent session: session_id={}, session_type={}",
            session.id, session.session_type
        ));
    }
    Ok(())
}

pub async fn read_session(
    session_id: &str,
    with_conversation: bool,
    error_context: &str,
) -> Result<Session, String> {
    SessionManager::get_session(session_id, with_conversation)
        .await
        .map_err(|error| format!("{error_context}: {error}"))
}

pub async fn list_child_subagent_sessions(
    parent_session_id: &str,
    error_context: &str,
) -> Result<Vec<Session>, String> {
    list_subagent_child_sessions(parent_session_id)
        .await
        .map_err(|error| format!("{error_context}: {error}"))
}

async fn list_subagent_sessions_with_metadata_query() -> Result<Vec<Session>, String> {
    list_subagent_sessions_with_metadata()
        .await
        .map_err(|error| format!("读取 subagent session 列表失败: {error}"))
}

pub(crate) async fn read_subagent_session(
    session_id: &str,
    error_context: &str,
) -> Result<Session, String> {
    let session = read_session(session_id, false, error_context).await?;
    ensure_subagent_session(&session)?;
    Ok(session)
}

pub(crate) fn resolve_subagent_parent_session_id(session: &Session) -> Option<String> {
    let metadata = resolve_subagent_session_metadata(&session.extension_data)?;
    normalize_optional_text(Some(metadata.parent_session_id))
}

pub async fn list_subagent_status_scope_session_ids(session_id: &str) -> Vec<String> {
    let mut scope_ids = Vec::new();
    let mut seen = HashSet::new();
    let mut current_session_id = session_id.to_string();

    while seen.insert(current_session_id.clone()) {
        scope_ids.push(current_session_id.clone());

        let session = match read_session(&current_session_id, false, "解析 team 事件 scope 失败")
            .await
        {
            Ok(session) => session,
            Err(error) => {
                tracing::warn!(
                    "[SessionQuery] 解析 team 事件 scope 失败: session_id={}, error={}",
                    current_session_id,
                    error
                );
                break;
            }
        };
        let Some(parent_session_id) = resolve_subagent_parent_session_id(&session) else {
            break;
        };
        current_session_id = parent_session_id;
    }

    scope_ids
}

pub async fn list_subagent_cascade_session_ids(session_id: &str) -> Result<Vec<String>, String> {
    let _ = read_subagent_session(session_id, "读取 subagent session 失败").await?;
    let sessions = list_subagent_sessions_with_metadata_query().await?;
    Ok(collect_subagent_cascade_session_ids(session_id, &sessions))
}

pub fn collect_subagent_cascade_session_ids(session_id: &str, sessions: &[Session]) -> Vec<String> {
    let mut children_by_parent: HashMap<String, Vec<String>> = HashMap::new();
    for session in sessions {
        let Some(parent_session_id) = resolve_subagent_parent_session_id(session) else {
            continue;
        };
        children_by_parent
            .entry(parent_session_id)
            .or_default()
            .push(session.id.clone());
    }

    let mut ordered = vec![session_id.to_string()];
    let mut queue = VecDeque::from([session_id.to_string()]);
    while let Some(parent_id) = queue.pop_front() {
        let Some(children) = children_by_parent.get(&parent_id) else {
            continue;
        };
        for child_id in children {
            ordered.push(child_id.clone());
            queue.push_back(child_id.clone());
        }
    }
    ordered
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{Duration, Utc};

    #[test]
    fn collect_subagent_cascade_session_ids_returns_breadth_first_tree() {
        let now = Utc::now();
        let child_a = Session {
            id: "child-a".to_string(),
            session_type: SessionType::SubAgent,
            updated_at: now,
            extension_data: aster::session::SubagentSessionMetadata::new("root")
                .into_updated_extension_data(&Session::default())
                .unwrap(),
            ..Session::default()
        };
        let child_b = Session {
            id: "child-b".to_string(),
            session_type: SessionType::SubAgent,
            updated_at: now - Duration::minutes(1),
            extension_data: aster::session::SubagentSessionMetadata::new("root")
                .into_updated_extension_data(&Session::default())
                .unwrap(),
            ..Session::default()
        };
        let grandchild = Session {
            id: "grandchild".to_string(),
            session_type: SessionType::SubAgent,
            updated_at: now - Duration::minutes(2),
            extension_data: aster::session::SubagentSessionMetadata::new("child-a")
                .into_updated_extension_data(&Session::default())
                .unwrap(),
            ..Session::default()
        };

        let ids = collect_subagent_cascade_session_ids("root", &[child_a, child_b, grandchild]);

        assert_eq!(ids, vec!["root", "child-a", "child-b", "grandchild"]);
    }
}
