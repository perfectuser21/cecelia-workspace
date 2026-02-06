/**
 * OKR Tree CRUD API
 * Provides tree-based operations for OKR management
 */

import { Router } from 'express';
import pool from '../task-system/db.js';

const router = Router();

/**
 * GET /api/okr/trees
 * List all OKR trees (top-level Objectives only)
 */
router.get('/trees', async (req, res) => {
  try {
    const { project_id } = req.query;

    let query = `
      SELECT
        o.*,
        (SELECT COUNT(*) FROM goals WHERE parent_id = o.id) as children_count
      FROM goals o
      WHERE o.type = 'objective' AND o.parent_id IS NULL
    `;
    const params = [];

    if (project_id) {
      query += ' AND o.project_id = $1';
      params.push(project_id);
    }

    query += ' ORDER BY o.created_at DESC';

    const result = await pool.query(query, params);
    res.json({ trees: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list OKR trees', details: err.message });
  }
});

/**
 * GET /api/okr/trees/:id
 * Get complete OKR tree with all Key Results
 */
router.get('/trees/:id', async (req, res) => {
  try {
    // Get the Objective
    const objResult = await pool.query(
      'SELECT * FROM goals WHERE id = $1 AND type = $2',
      [req.params.id, 'objective']
    );

    if (objResult.rows.length === 0) {
      return res.status(404).json({ error: 'OKR tree not found' });
    }

    const objective = objResult.rows[0];

    // Get all Key Results
    const krsResult = await pool.query(
      'SELECT * FROM goals WHERE parent_id = $1 ORDER BY weight DESC, created_at ASC',
      [req.params.id]
    );

    res.json({
      ...objective,
      children: krsResult.rows
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get OKR tree', details: err.message });
  }
});

/**
 * POST /api/okr/trees
 * Create new OKR tree (Objective + Key Results in one request)
 */
router.post('/trees', async (req, res) => {
  const client = await pool.connect();

  try {
    const { title, description, project_id, status, priority, deadline, key_results } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    await client.query('BEGIN');

    // Create Objective
    const objResult = await client.query(
      `INSERT INTO goals (project_id, title, description, status, priority, deadline, progress, type, parent_id, weight)
       VALUES ($1, $2, $3, $4, $5, $6, 0, 'objective', NULL, 1.0)
       RETURNING *`,
      [project_id, title, description, status || 'pending', priority || 'P2', deadline]
    );

    const objective = objResult.rows[0];
    const children = [];

    // Create Key Results if provided
    if (key_results && Array.isArray(key_results)) {
      for (const kr of key_results) {
        const krResult = await client.query(
          `INSERT INTO goals (project_id, title, description, status, priority, deadline, progress, type, parent_id, weight)
           VALUES ($1, $2, $3, $4, $5, $6, 0, 'key_result', $7, $8)
           RETURNING *`,
          [
            project_id,
            kr.title,
            kr.description || null,
            kr.status || 'pending',
            kr.priority || 'P2',
            kr.deadline || null,
            objective.id,
            kr.weight || 1.0
          ]
        );
        children.push(krResult.rows[0]);
      }
    }

    await client.query('COMMIT');

    res.status(201).json({
      ...objective,
      children
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to create OKR tree', details: err.message });
  } finally {
    client.release();
  }
});

/**
 * PUT /api/okr/trees/:id
 * Update OKR tree (can add/update/remove Key Results)
 */
router.put('/trees/:id', async (req, res) => {
  const client = await pool.connect();

  try {
    const { title, description, status, priority, deadline, key_results } = req.body;

    await client.query('BEGIN');

    // Verify Objective exists
    const objResult = await client.query(
      'SELECT * FROM goals WHERE id = $1 AND type = $2',
      [req.params.id, 'objective']
    );

    if (objResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'OKR tree not found' });
    }

    // Update Objective
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      params.push(title);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      params.push(description);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      params.push(status);
    }
    if (priority !== undefined) {
      updates.push(`priority = $${paramIndex++}`);
      params.push(priority);
    }
    if (deadline !== undefined) {
      updates.push(`deadline = $${paramIndex++}`);
      params.push(deadline);
    }

    let updatedObjective = objResult.rows[0];

    if (updates.length > 0) {
      updates.push('updated_at = NOW()');
      params.push(req.params.id);

      const updateResult = await client.query(
        `UPDATE goals SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        params
      );
      updatedObjective = updateResult.rows[0];
    }

    // Handle Key Results if provided
    const children = [];
    if (key_results && Array.isArray(key_results)) {
      // Get existing KRs
      const existingKRs = await client.query(
        'SELECT id FROM goals WHERE parent_id = $1',
        [req.params.id]
      );
      const existingKRIds = new Set(existingKRs.rows.map(kr => kr.id));
      const providedKRIds = new Set();

      for (const kr of key_results) {
        if (kr.id) {
          // Update existing KR
          providedKRIds.add(kr.id);
          const krUpdates = [];
          const krParams = [];
          let krParamIndex = 1;

          if (kr.title !== undefined) {
            krUpdates.push(`title = $${krParamIndex++}`);
            krParams.push(kr.title);
          }
          if (kr.description !== undefined) {
            krUpdates.push(`description = $${krParamIndex++}`);
            krParams.push(kr.description);
          }
          if (kr.status !== undefined) {
            krUpdates.push(`status = $${krParamIndex++}`);
            krParams.push(kr.status);
          }
          if (kr.progress !== undefined) {
            krUpdates.push(`progress = $${krParamIndex++}`);
            krParams.push(kr.progress);
          }
          if (kr.weight !== undefined) {
            krUpdates.push(`weight = $${krParamIndex++}`);
            krParams.push(kr.weight);
          }

          if (krUpdates.length > 0) {
            krUpdates.push('updated_at = NOW()');
            krParams.push(kr.id);

            const krResult = await client.query(
              `UPDATE goals SET ${krUpdates.join(', ')} WHERE id = $${krParamIndex} AND parent_id = $${krParamIndex + 1} RETURNING *`,
              [...krParams, req.params.id]
            );
            if (krResult.rows.length > 0) {
              children.push(krResult.rows[0]);
            }
          }
        } else {
          // Create new KR
          const krResult = await client.query(
            `INSERT INTO goals (project_id, title, description, status, priority, deadline, progress, type, parent_id, weight)
             VALUES ($1, $2, $3, $4, $5, $6, 0, 'key_result', $7, $8)
             RETURNING *`,
            [
              updatedObjective.project_id,
              kr.title,
              kr.description || null,
              kr.status || 'pending',
              kr.priority || 'P2',
              kr.deadline || null,
              req.params.id,
              kr.weight || 1.0
            ]
          );
          children.push(krResult.rows[0]);
        }
      }

      // Delete KRs not in the provided list
      for (const existingId of existingKRIds) {
        if (!providedKRIds.has(existingId)) {
          await client.query('DELETE FROM goals WHERE id = $1', [existingId]);
        }
      }
    }

    // Recalculate Objective progress
    const krsForProgress = await client.query(
      'SELECT progress, weight FROM goals WHERE parent_id = $1',
      [req.params.id]
    );

    if (krsForProgress.rows.length > 0) {
      let totalWeightedProgress = 0;
      let totalWeight = 0;

      for (const kr of krsForProgress.rows) {
        const krWeight = parseFloat(kr.weight) || 1.0;
        const krProgress = parseInt(kr.progress) || 0;
        totalWeightedProgress += krProgress * krWeight;
        totalWeight += krWeight;
      }

      const newProgress = totalWeight > 0 ? Math.round(totalWeightedProgress / totalWeight) : 0;

      await client.query(
        'UPDATE goals SET progress = $1, updated_at = NOW() WHERE id = $2',
        [newProgress, req.params.id]
      );
      updatedObjective.progress = newProgress;
    }

    await client.query('COMMIT');

    // Get final children list if not already populated
    if (children.length === 0) {
      const finalKRs = await pool.query(
        'SELECT * FROM goals WHERE parent_id = $1 ORDER BY weight DESC, created_at ASC',
        [req.params.id]
      );
      children.push(...finalKRs.rows);
    }

    res.json({
      ...updatedObjective,
      children
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to update OKR tree', details: err.message });
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/okr/trees/:id
 * Delete entire OKR tree (Objective + all Key Results)
 */
router.delete('/trees/:id', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Verify Objective exists
    const objResult = await client.query(
      'SELECT * FROM goals WHERE id = $1 AND type = $2',
      [req.params.id, 'objective']
    );

    if (objResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'OKR tree not found' });
    }

    // Delete all Key Results first
    await client.query('DELETE FROM goals WHERE parent_id = $1', [req.params.id]);

    // Delete Objective
    await client.query('DELETE FROM goals WHERE id = $1', [req.params.id]);

    await client.query('COMMIT');

    res.json({ message: 'OKR tree deleted', id: req.params.id });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to delete OKR tree', details: err.message });
  } finally {
    client.release();
  }
});

export default router;
