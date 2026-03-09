//! 心跳任务调度计算模块
//!
//! 支持三种调度方式：
//! - Every: 固定间隔
//! - Cron: Cron 表达式
//! - At: 指定时间点（一次性）

use chrono::{DateTime, Utc};
use proxycast_core::config::TaskSchedule;

/// 调度计算错误
#[derive(Debug, Clone)]
pub struct ScheduleError {
    pub message: String,
}

impl std::fmt::Display for ScheduleError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.message)
    }
}

impl std::error::Error for ScheduleError {}

impl From<String> for ScheduleError {
    fn from(message: String) -> Self {
        Self { message }
    }
}

/// 计算下次执行时间
pub fn next_run_for_schedule(
    schedule: &TaskSchedule,
    from: DateTime<Utc>,
) -> Result<Option<DateTime<Utc>>, ScheduleError> {
    match schedule {
        TaskSchedule::Every { every_secs } => {
            let secs = (*every_secs).max(300); // 最小 5 分钟
            Ok(Some(from + chrono::Duration::seconds(secs as i64)))
        }
        TaskSchedule::Cron { expr, tz } => {
            let normalized = normalize_cron_expression(expr);
            let cron_schedule = cron::Schedule::from_str(&normalized)
                .map_err(|e| ScheduleError::from(format!("无效的 Cron 表达式: {}", e)))?;

            // 处理时区
            let next = if let Some(tz_str) = tz {
                let timezone: chrono_tz::Tz = tz_str
                    .parse()
                    .map_err(|_| ScheduleError::from(format!("无效的时区: {}", tz_str)))?;
                let from_tz = from.with_timezone(&timezone);
                cron_schedule
                    .after(&from_tz)
                    .next()
                    .map(|dt| dt.with_timezone(&Utc))
            } else {
                cron_schedule.after(&from).next()
            };

            Ok(next)
        }
        TaskSchedule::At { at } => {
            let target = DateTime::parse_from_rfc3339(at)
                .map_err(|e| ScheduleError::from(format!("无效的时间格式 (需要 RFC3339): {}", e)))?
                .with_timezone(&Utc);

            if target > from {
                Ok(Some(target))
            } else {
                // 已过期，返回 None 表示不再执行
                Ok(None)
            }
        }
    }
}

/// 验证调度配置
pub fn validate_schedule(schedule: &TaskSchedule, now: DateTime<Utc>) -> Result<(), ScheduleError> {
    match schedule {
        TaskSchedule::Every { every_secs } => {
            if *every_secs < 60 {
                return Err(ScheduleError::from("间隔时间不能小于 60 秒".to_string()));
            }
            Ok(())
        }
        TaskSchedule::Cron { expr, tz } => {
            let normalized = normalize_cron_expression(expr);
            cron::Schedule::from_str(&normalized)
                .map_err(|e| ScheduleError::from(format!("无效的 Cron 表达式: {}", e)))?;

            if let Some(tz_str) = tz {
                let _: chrono_tz::Tz = tz_str
                    .parse()
                    .map_err(|_| ScheduleError::from(format!("无效的时区: {}", tz_str)))?;
            }
            Ok(())
        }
        TaskSchedule::At { at } => {
            let target = DateTime::parse_from_rfc3339(at)
                .map_err(|e| ScheduleError::from(format!("无效的时间格式: {}", e)))?
                .with_timezone(&Utc);

            if target <= now {
                return Err(ScheduleError::from("指定时间已过期".to_string()));
            }
            Ok(())
        }
    }
}

/// 标准化 Cron 表达式
///
/// 支持 5 字段（分 时 日 月 周）和 6 字段（秒 分 时 日 月 周）格式
/// 5 字段格式会自动补充秒字段为 "0"
pub fn normalize_cron_expression(expr: &str) -> String {
    let parts: Vec<&str> = expr.split_whitespace().collect();
    if parts.len() == 5 {
        // 5 字段格式，补充秒字段
        format!("0 {}", expr.trim())
    } else {
        expr.trim().to_string()
    }
}

/// 获取调度类型的人类可读描述
pub fn describe_schedule(schedule: &TaskSchedule) -> String {
    match schedule {
        TaskSchedule::Every { every_secs } => {
            let secs = *every_secs;
            if secs >= 86400 && secs % 86400 == 0 {
                format!("每 {} 天", secs / 86400)
            } else if secs >= 3600 && secs % 3600 == 0 {
                format!("每 {} 小时", secs / 3600)
            } else if secs >= 60 && secs % 60 == 0 {
                format!("每 {} 分钟", secs / 60)
            } else {
                format!("每 {} 秒", secs)
            }
        }
        TaskSchedule::Cron { expr, tz } => {
            let tz_info = tz.as_ref().map(|t| format!(" ({})", t)).unwrap_or_default();
            format!("Cron: {}{}", expr, tz_info)
        }
        TaskSchedule::At { at } => {
            format!("定时: {}", at)
        }
    }
}

/// 预览下次执行时间（用于前端显示）
pub fn preview_next_run(schedule: &TaskSchedule) -> Result<Option<String>, ScheduleError> {
    let now = Utc::now();
    let next = next_run_for_schedule(schedule, now)?;
    Ok(next.map(|dt| dt.to_rfc3339()))
}

use std::str::FromStr;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_every_schedule() {
        let schedule = TaskSchedule::Every { every_secs: 300 };
        let now = Utc::now();
        let next = next_run_for_schedule(&schedule, now).unwrap().unwrap();
        assert_eq!((next - now).num_seconds(), 300);
    }

    #[test]
    fn test_every_schedule_min_interval() {
        // 小于 300 秒会被强制为 300
        let schedule = TaskSchedule::Every { every_secs: 60 };
        let now = Utc::now();
        let next = next_run_for_schedule(&schedule, now).unwrap().unwrap();
        assert_eq!((next - now).num_seconds(), 300);
    }

    #[test]
    fn test_cron_schedule() {
        // 每分钟执行
        let schedule = TaskSchedule::Cron {
            expr: "* * * * *".to_string(),
            tz: None,
        };
        let now = Utc::now();
        let next = next_run_for_schedule(&schedule, now).unwrap();
        assert!(next.is_some());
    }

    #[test]
    fn test_cron_schedule_with_timezone() {
        let schedule = TaskSchedule::Cron {
            expr: "0 9 * * *".to_string(), // 每天 9 点
            tz: Some("Asia/Shanghai".to_string()),
        };
        let now = Utc::now();
        let next = next_run_for_schedule(&schedule, now).unwrap();
        assert!(next.is_some());
    }

    #[test]
    fn test_at_schedule_future() {
        let future = Utc::now() + chrono::Duration::hours(1);
        let schedule = TaskSchedule::At {
            at: future.to_rfc3339(),
        };
        let now = Utc::now();
        let next = next_run_for_schedule(&schedule, now).unwrap();
        assert!(next.is_some());
    }

    #[test]
    fn test_at_schedule_past() {
        let past = Utc::now() - chrono::Duration::hours(1);
        let schedule = TaskSchedule::At {
            at: past.to_rfc3339(),
        };
        let now = Utc::now();
        let next = next_run_for_schedule(&schedule, now).unwrap();
        assert!(next.is_none());
    }

    #[test]
    fn test_normalize_cron_5_fields() {
        let expr = "0 9 * * *";
        let normalized = normalize_cron_expression(expr);
        assert_eq!(normalized, "0 0 9 * * *");
    }

    #[test]
    fn test_normalize_cron_6_fields() {
        let expr = "30 0 9 * * *";
        let normalized = normalize_cron_expression(expr);
        assert_eq!(normalized, "30 0 9 * * *");
    }

    #[test]
    fn test_validate_schedule_invalid_cron() {
        let schedule = TaskSchedule::Cron {
            expr: "invalid".to_string(),
            tz: None,
        };
        let result = validate_schedule(&schedule, Utc::now());
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_schedule_invalid_timezone() {
        let schedule = TaskSchedule::Cron {
            expr: "* * * * *".to_string(),
            tz: Some("Invalid/Timezone".to_string()),
        };
        let result = validate_schedule(&schedule, Utc::now());
        assert!(result.is_err());
    }

    #[test]
    fn test_describe_schedule() {
        assert_eq!(
            describe_schedule(&TaskSchedule::Every { every_secs: 300 }),
            "每 5 分钟"
        );
        assert_eq!(
            describe_schedule(&TaskSchedule::Every { every_secs: 3600 }),
            "每 1 小时"
        );
        assert_eq!(
            describe_schedule(&TaskSchedule::Every { every_secs: 86400 }),
            "每 1 天"
        );
    }
}
