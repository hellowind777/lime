import { notificationService } from "@/lib/notificationService";

export interface ShowNotificationRequest {
  title: string;
  body: string;
  icon?: string;
}

export async function showSystemNotification(
  request: ShowNotificationRequest,
): Promise<void> {
  await notificationService.show(request.title, request.body, "info");
}
