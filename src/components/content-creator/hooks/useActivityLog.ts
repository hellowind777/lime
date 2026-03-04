/**
 * @file useActivityLog.ts
 * @description 活动日志 Hook - 订阅和管理活动日志状态
 * @module components/content-creator/hooks/useActivityLog
 */

import { useState, useEffect } from 'react';
import { activityLogger, ActivityLog, type ActivityLogScope } from '../utils/activityLogger';

/**
 * 活动日志 Hook 返回值
 */
export interface UseActivityLogReturn {
  /** 所有日志 */
  logs: ActivityLog[];
  /** 清空日志 */
  clearLogs: () => void;
}

export type UseActivityLogFilter = ActivityLogScope;

/**
 * 活动日志 Hook
 *
 * 订阅活动日志的变化，自动更新组件状态。
 *
 * @param filter - 日志作用域过滤条件
 * @returns 日志数据和操作方法
 */
export function useActivityLog(filter?: UseActivityLogFilter): UseActivityLogReturn {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const workspaceId = filter?.workspaceId;
  const sessionId = filter?.sessionId;

  useEffect(() => {
    const scope =
      workspaceId === undefined && sessionId === undefined
        ? undefined
        : { workspaceId, sessionId };

    // 初始化日志
    setLogs(activityLogger.getLogs(scope));

    // 订阅日志变化
    const unsubscribe = activityLogger.subscribe(() => {
      setLogs(activityLogger.getLogs(scope));
    });

    return unsubscribe;
  }, [workspaceId, sessionId]);

  return {
    logs,
    clearLogs: () => activityLogger.clear(filter),
  };
}

export default useActivityLog;
