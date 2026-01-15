export interface NotifyLoginRequiredRequest {
    platform: string;
    accountId: string;
    reason: string;
    loginUrl: string;
}
export interface NotifyLoginRequiredResponse {
    ok: boolean;
    notified: string[];
}
export interface NotifyTeamDailyRequest {
    date: string;
    summaryText: string;
    notionUrl?: string;
}
export interface NotifyTeamDailyResponse {
    ok: boolean;
    channels: string[];
}
export interface NotifyOpsAlertRequest {
    where: string;
    workflow: string;
    node: string;
    platform: string;
    accountId: string;
    error: string;
    meta?: Record<string, any>;
}
export interface NotifyOpsAlertResponse {
    ok: boolean;
    alertId: string;
}
//# sourceMappingURL=notifications.types.d.ts.map