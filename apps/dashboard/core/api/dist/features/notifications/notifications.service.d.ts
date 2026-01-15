import { NotifyLoginRequiredRequest, NotifyLoginRequiredResponse, NotifyTeamDailyRequest, NotifyTeamDailyResponse, NotifyOpsAlertRequest, NotifyOpsAlertResponse } from './notifications.types';
declare class NotificationService {
    notifyLoginRequired(request: NotifyLoginRequiredRequest): Promise<NotifyLoginRequiredResponse>;
    notifyTeamDaily(request: NotifyTeamDailyRequest): Promise<NotifyTeamDailyResponse>;
    notifyOpsAlert(request: NotifyOpsAlertRequest): Promise<NotifyOpsAlertResponse>;
    private sendFeishuMessage;
    private sendSlackMessage;
}
export declare const notificationsService: NotificationService;
export {};
//# sourceMappingURL=notifications.service.d.ts.map