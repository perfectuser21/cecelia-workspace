"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.accountsRepository = void 0;
// Account repository for database operations
const connection_1 = require("../../shared/db/connection");
class AccountRepository {
    async findAll(activeOnly = false) {
        const query = activeOnly
            ? 'SELECT * FROM accounts WHERE is_active = true ORDER BY platform, display_name'
            : 'SELECT * FROM accounts ORDER BY platform, display_name';
        const result = await connection_1.db.query(query);
        return result.rows;
    }
    async findById(id) {
        const result = await connection_1.db.query('SELECT * FROM accounts WHERE id = $1', [id]);
        return result.rows[0] || null;
    }
    async findByPlatformAndAccountId(platform, accountId) {
        const result = await connection_1.db.query('SELECT * FROM accounts WHERE platform = $1 AND account_id = $2', [platform, accountId]);
        return result.rows[0] || null;
    }
    async findByPlatform(platform) {
        const result = await connection_1.db.query('SELECT * FROM accounts WHERE platform = $1 AND is_active = true ORDER BY display_name', [platform]);
        return result.rows;
    }
    async create(data) {
        const result = await connection_1.db.query(`INSERT INTO accounts (platform, account_id, display_name, owner_user_id, storage_state, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING *`, [data.platform, data.account_id, data.display_name, data.owner_user_id || null, data.storage_state || null]);
        return result.rows[0];
    }
    async update(id, data) {
        const fields = [];
        const values = [];
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
        const result = await connection_1.db.query(query, values);
        return result.rows[0] || null;
    }
    async updateLoginStatus(id, isLoggedIn, storageState) {
        const result = await connection_1.db.query(`UPDATE accounts
       SET is_logged_in = $1,
           storage_state = $2,
           last_health_check = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`, [isLoggedIn, storageState || null, id]);
        return result.rows[0] || null;
    }
    async updateHealthCheck(id, isLoggedIn) {
        await connection_1.db.query(`UPDATE accounts
       SET last_health_check = CURRENT_TIMESTAMP,
           is_logged_in = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`, [isLoggedIn, id]);
    }
    async delete(id) {
        const result = await connection_1.db.query('DELETE FROM accounts WHERE id = $1', [id]);
        return (result.rowCount || 0) > 0;
    }
    async countByPlatform() {
        const result = await connection_1.db.query('SELECT platform, COUNT(*) as count FROM accounts WHERE is_active = true GROUP BY platform');
        const counts = {};
        result.rows.forEach(row => {
            counts[row.platform] = parseInt(row.count, 10);
        });
        return counts;
    }
}
exports.accountsRepository = new AccountRepository();
//# sourceMappingURL=accounts.repository.js.map