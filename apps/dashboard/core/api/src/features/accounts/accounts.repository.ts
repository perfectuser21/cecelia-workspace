// Account repository for database operations
import { db } from '../../shared/db/connection';
import { Platform } from '../../shared/types';
import { Account, CreateAccountDTO, UpdateAccountDTO } from './accounts.types';

class AccountRepository {
  async findAll(activeOnly: boolean = false): Promise<Account[]> {
    const query = activeOnly
      ? 'SELECT * FROM accounts WHERE is_active = true ORDER BY platform, display_name'
      : 'SELECT * FROM accounts ORDER BY platform, display_name';

    const result = await db.query<Account>(query);
    return result.rows;
  }

  async findById(id: number): Promise<Account | null> {
    const result = await db.query<Account>(
      'SELECT * FROM accounts WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async findByPlatformAndAccountId(
    platform: Platform,
    accountId: string
  ): Promise<Account | null> {
    const result = await db.query<Account>(
      'SELECT * FROM accounts WHERE platform = $1 AND account_id = $2',
      [platform, accountId]
    );
    return result.rows[0] || null;
  }

  async findByPlatform(platform: Platform): Promise<Account[]> {
    const result = await db.query<Account>(
      'SELECT * FROM accounts WHERE platform = $1 AND is_active = true ORDER BY display_name',
      [platform]
    );
    return result.rows;
  }

  async create(data: CreateAccountDTO): Promise<Account> {
    const result = await db.query<Account>(
      `INSERT INTO accounts (platform, account_id, display_name, owner_user_id, storage_state, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING *`,
      [data.platform, data.account_id, data.display_name, data.owner_user_id || null, data.storage_state || null]
    );
    return result.rows[0];
  }

  async update(id: number, data: UpdateAccountDTO): Promise<Account | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.display_name !== undefined) {
      fields.push(`display_name = $${paramIndex++}`);
      values.push(data.display_name);
    }
    if (data.storage_state !== undefined) {
      fields.push(`storage_state = $${paramIndex++}`);
      values.push(data.storage_state);
    }
    if (data.is_logged_in !== undefined) {
      fields.push(`is_logged_in = $${paramIndex++}`);
      values.push(data.is_logged_in);
    }
    if (data.is_active !== undefined) {
      fields.push(`is_active = $${paramIndex++}`);
      values.push(data.is_active);
    }
    if (data.owner_user_id !== undefined) {
      fields.push(`owner_user_id = $${paramIndex++}`);
      values.push(data.owner_user_id);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `UPDATE accounts SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    const result = await db.query<Account>(query, values);
    return result.rows[0] || null;
  }

  async updateLoginStatus(
    id: number,
    isLoggedIn: boolean,
    storageState?: string
  ): Promise<Account | null> {
    const result = await db.query<Account>(
      `UPDATE accounts
       SET is_logged_in = $1,
           storage_state = $2,
           last_health_check = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [isLoggedIn, storageState || null, id]
    );
    return result.rows[0] || null;
  }

  async updateHealthCheck(id: number, isLoggedIn: boolean): Promise<void> {
    await db.query(
      `UPDATE accounts
       SET last_health_check = CURRENT_TIMESTAMP,
           is_logged_in = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [isLoggedIn, id]
    );
  }

  async delete(id: number): Promise<boolean> {
    const result = await db.query('DELETE FROM accounts WHERE id = $1', [id]);
    return (result.rowCount || 0) > 0;
  }

  async countByPlatform(): Promise<Record<string, number>> {
    const result = await db.query<{ platform: string; count: string }>(
      'SELECT platform, COUNT(*) as count FROM accounts WHERE is_active = true GROUP BY platform'
    );

    const counts: Record<string, number> = {};
    result.rows.forEach(row => {
      counts[row.platform] = parseInt(row.count, 10);
    });
    return counts;
  }
}

export const accountsRepository = new AccountRepository();
