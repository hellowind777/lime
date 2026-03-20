/**
 * 通知配置 Tauri API
 *
 * 提供与后端通知配置相关的 Tauri 命令接口。
 *
 * **Validates: Requirements 10.1, 10.2**
 */

/**
 * 通知设置
 */
export interface NotificationSettings {
  /** 是否启用 */
  enabled: boolean;
  /** 是否显示桌面通知 */
  desktop: boolean;
  /** 是否播放声音 */
  sound: boolean;
  /** 声音文件路径（可选） */
  sound_file?: string;
}

/**
 * 通知配置
 */
export interface NotificationConfig {
  /** 是否启用通知 */
  enabled: boolean;
  /** 新 Flow 通知配置 */
  new_flow: NotificationSettings;
  /** 错误 Flow 通知配置 */
  error_flow: NotificationSettings;
  /** 延迟警告通知配置 */
  latency_warning: NotificationSettings;
  /** Token 警告通知配置 */
  token_warning: NotificationSettings;
}

/**
 * 通知 API 类
 */
export class NotificationApi {
  /**
   * 获取通知配置
   */
  static async getConfig(): Promise<NotificationConfig> {
    throw new Error(
      "旧通知配置 Tauri API 已废弃，请改用 src/lib/notificationService.ts。",
    );
  }

  /**
   * 更新通知配置
   */
  static async updateConfig(config: NotificationConfig): Promise<void> {
    void config;
    throw new Error(
      "旧通知配置 Tauri API 已废弃，请改用 src/lib/notificationService.ts。",
    );
  }
}

export default NotificationApi;
