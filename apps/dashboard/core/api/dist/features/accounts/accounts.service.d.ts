import { Account, CreateAccountDTO, UpdateAccountDTO, AccountApiResponse } from './accounts.types';
import { Platform } from '../../shared/types';
declare class AccountService {
    getAllAccounts(activeOnly?: boolean): Promise<Account[]>;
    getAccountById(id: number): Promise<Account>;
    getAccountByPlatformAndId(platform: Platform, accountId: string): Promise<Account>;
    getAccountsByPlatform(platform: Platform): Promise<Account[]>;
    createAccount(data: CreateAccountDTO): Promise<Account>;
    updateAccount(id: number, data: UpdateAccountDTO): Promise<Account>;
    updateLoginStatus(id: number, isLoggedIn: boolean, storageState?: string): Promise<Account>;
    deleteAccount(id: number): Promise<void>;
    getAccountStatistics(): Promise<Record<string, number>>;
    formatAccountForApi(account: Account): AccountApiResponse;
}
export declare const accountsService: AccountService;
export {};
//# sourceMappingURL=accounts.service.d.ts.map