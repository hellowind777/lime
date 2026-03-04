/**
 * @file ActivityLogList.tsx
 * @description 活动日志列表组件 - 显示工作流执行过程中的所有操作记录
 * @module components/content-creator/components/ActivityLog
 */

import { Check, Loader, AlertCircle, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useActivityLog } from '../../hooks/useActivityLog';
import type { ActivityLog } from '../../utils/activityLogger';

export interface ActivityLogListProps {
  workspaceId?: string;
  sessionId?: string | null;
}

/**
 * 活动日志列表组件
 *
 * 显示所有活动日志，支持展开查看详细信息。
 */
export function ActivityLogList({ workspaceId, sessionId }: ActivityLogListProps) {
  const { logs, clearLogs } = useActivityLog({ workspaceId, sessionId });
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  /**
   * 切换日志展开状态
   */
  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  /**
   * 获取状态图标
   */
  const getStatusIcon = (status: ActivityLog['status']) => {
    switch (status) {
      case 'success':
        return <Check className="w-4 h-4 text-green-500" />;
      case 'pending':
        return <Loader className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
  };

  /**
   * 格式化时间
   */
  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}小时前`;
    const days = Math.floor(hours / 24);
    return `${days}天前`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* 头部 */}
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold">活动日志</h3>
        <button
          onClick={clearLogs}
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          清空
        </button>
      </div>

      {/* 日志列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {logs.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            暂无活动记录
          </div>
        ) : (
          logs.slice().reverse().map(log => (
            <div
              key={log.id}
              className="border rounded-lg p-3 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start gap-2">
                {/* 状态图标 */}
                {getStatusIcon(log.status)}

                {/* 日志内容 */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{log.title}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {formatTime(log.timestamp)}
                    {log.duration && ` · 耗时 ${(log.duration / 1000).toFixed(1)}s`}
                  </div>
                  {log.description && (
                    <div className="text-xs text-gray-600 mt-1">
                      {log.description}
                    </div>
                  )}
                  {log.error && (
                    <div className="text-xs text-red-600 mt-1">
                      错误: {log.error}
                    </div>
                  )}
                </div>

                {/* 展开按钮 */}
                {log.metadata && (
                  <button
                    onClick={() => toggleExpand(log.id)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${
                        expandedIds.has(log.id) ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                )}
              </div>

              {/* 展开的详细信息 */}
              {expandedIds.has(log.id) && log.metadata && (
                <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                  {JSON.stringify(log.metadata, null, 2)}
                </pre>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default ActivityLogList;
