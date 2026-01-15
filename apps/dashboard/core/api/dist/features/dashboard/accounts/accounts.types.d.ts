import { Platform } from '../../../shared/types';
export interface Account {
    id: number;
    platform: Platform;
    account_id: string;
    display_name: string;
    storage_state?: string;
    is_logged_in: boolean;
    is_active: boolean;
    last_health_check?: Date;
    owner_user_id?: number;
    created_at: Date;
    updated_at: Date;
}
export interface CreateAccountDTO {
    platform: Platform;
    account_id: string;
    display_name: string;
    owner_user_id?: number;
    storage_state?: string;
}
export interface UpdateAccountDTO {
    display_name?: string;
    storage_state?: string;
    is_logged_in?: boolean;
    is_active?: boolean;
    owner_user_id?: number;
}
export interface AccountApiResponse {
    platform: string;
    accountId: string;
    displayName: string;
    isLoggedIn: boolean;
    isActive: boolean;
    lastHealthCheck?: Date;
}
//# sourceMappingURL=accounts.types.d.ts.map