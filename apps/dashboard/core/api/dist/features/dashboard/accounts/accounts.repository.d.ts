import { Platform } from '../../../shared/types';
import { Account, CreateAccountDTO, UpdateAccountDTO } from './accounts.types';
declare class AccountRepository {
    findAll(activeOnly?: boolean): Promise<Account[]>;
    findById(id: number): Promise<Account | null>;
    findByPlatformAndAccountId(platform: Platform, accountId: string): Promise<Account | null>;
    findByPlatform(platform: Platform): Promise<Account[]>;
    create(data: CreateAccountDTO): Promise<Account>;
    update(id: number, data: UpdateAccountDTO): Promise<Account | null>;
    updateLoginStatus(id: number, isLoggedIn: boolean, storageState?: string): Promise<Account | null>;
    updateHealthCheck(id: number, isLoggedIn: boolean): Promise<void>;
    delete(id: number): Promise<boolean>;
    countByPlatform(): Promise<Record<string, number>>;
}
export declare const accountsRepository: AccountRepository;
export {};
//# sourceMappingURL=accounts.repository.d.ts.map