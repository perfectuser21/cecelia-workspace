// Website contents repository
import { db } from '../../../shared/db/connection';
import { v4 as uuidv4 } from 'uuid';

export interface WebsiteContent {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  body: string | null;
  content_type: 'article' | 'video' | 'post';
  lang: 'zh' | 'en';
  tags: string[];
  reading_time: string | null;
  faq: { question: string; answer: string }[];
  key_takeaways: string[];
  quotable_insights: string[];
  video_url: string | null;
  thumbnail_url: string | null;
  status: 'draft' | 'published';
  published_at: Date | null;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateContentInput {
  slug: string;
  title: string;
  description?: string;
  body?: string;
  content_type: 'article' | 'video' | 'post';
  lang?: 'zh' | 'en';
  tags?: string[];
  reading_time?: string;
  faq?: { question: string; answer: string }[];
  key_takeaways?: string[];
  quotable_insights?: string[];
  video_url?: string;
  thumbnail_url?: string;
  status?: 'draft' | 'published';
  published_at?: Date;
  created_by?: number;
}

export class ContentsRepository {
  async create(data: CreateContentInput): Promise<WebsiteContent> {
    const id = uuidv4();
    const result = await db.query(
      `INSERT INTO website_contents
        (id, slug, title, description, body, content_type, lang, tags, reading_time,
         faq, key_takeaways, quotable_insights, video_url, thumbnail_url, status, published_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       RETURNING *`,
      [
        id,
        data.slug,
        data.title,
        data.description || null,
        data.body || null,
        data.content_type,
        data.lang || 'zh',
        data.tags || [],
        data.reading_time || null,
        JSON.stringify(data.faq || []),
        data.key_takeaways || [],
        data.quotable_insights || [],
        data.video_url || null,
        data.thumbnail_url || null,
        data.status || 'draft',
        data.published_at || (data.status === 'published' ? new Date() : null),
        data.created_by || null,
      ]
    );
    return this.parseContent(result.rows[0]);
  }

  async findById(id: string): Promise<WebsiteContent | null> {
    const result = await db.query(
      'SELECT * FROM website_contents WHERE id = $1',
      [id]
    );
    return result.rows[0] ? this.parseContent(result.rows[0]) : null;
  }

  async findBySlugAndLang(slug: string, lang: string): Promise<WebsiteContent | null> {
    const result = await db.query(
      'SELECT * FROM website_contents WHERE slug = $1 AND lang = $2',
      [slug, lang]
    );
    return result.rows[0] ? this.parseContent(result.rows[0]) : null;
  }

  async findAll(options: {
    lang?: string;
    content_type?: string;
    status?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<WebsiteContent[]> {
    let query = 'SELECT * FROM website_contents WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (options.lang) {
      query += ` AND lang = $${paramIndex++}`;
      params.push(options.lang);
    }

    if (options.content_type) {
      query += ` AND content_type = $${paramIndex++}`;
      params.push(options.content_type);
    }

    if (options.status) {
      query += ` AND status = $${paramIndex++}`;
      params.push(options.status);
    }

    query += ' ORDER BY published_at DESC NULLS LAST, created_at DESC';

    if (options.limit) {
      query += ` LIMIT $${paramIndex++}`;
      params.push(options.limit);
    }

    if (options.offset) {
      query += ` OFFSET $${paramIndex++}`;
      params.push(options.offset);
    }

    const result = await db.query(query, params);
    return result.rows.map((row: any) => this.parseContent(row));
  }

  async update(id: string, data: Partial<CreateContentInput>): Promise<WebsiteContent | null> {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    const fields: (keyof CreateContentInput)[] = [
      'slug', 'title', 'description', 'body', 'content_type', 'lang',
      'reading_time', 'video_url', 'thumbnail_url', 'status'
    ];

    for (const field of fields) {
      if (data[field] !== undefined) {
        updates.push(`${field} = $${paramIndex++}`);
        params.push(data[field]);
      }
    }

    // Handle arrays
    if (data.tags !== undefined) {
      updates.push(`tags = $${paramIndex++}`);
      params.push(data.tags);
    }
    if (data.key_takeaways !== undefined) {
      updates.push(`key_takeaways = $${paramIndex++}`);
      params.push(data.key_takeaways);
    }
    if (data.quotable_insights !== undefined) {
      updates.push(`quotable_insights = $${paramIndex++}`);
      params.push(data.quotable_insights);
    }

    // Handle JSON
    if (data.faq !== undefined) {
      updates.push(`faq = $${paramIndex++}`);
      params.push(JSON.stringify(data.faq));
    }

    // Handle published_at
    if (data.published_at !== undefined) {
      updates.push(`published_at = $${paramIndex++}`);
      params.push(data.published_at);
    } else if (data.status === 'published') {
      // Auto-set published_at when status changes to published
      const existing = await this.findById(id);
      if (existing && !existing.published_at) {
        updates.push(`published_at = $${paramIndex++}`);
        params.push(new Date());
      }
    }

    updates.push(`updated_at = $${paramIndex++}`);
    params.push(new Date());

    params.push(id);

    const result = await db.query(
      `UPDATE website_contents SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    return result.rows[0] ? this.parseContent(result.rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await db.query(
      'DELETE FROM website_contents WHERE id = $1',
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async count(options: {
    lang?: string;
    content_type?: string;
    status?: string;
  } = {}): Promise<number> {
    let query = 'SELECT COUNT(*) FROM website_contents WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (options.lang) {
      query += ` AND lang = $${paramIndex++}`;
      params.push(options.lang);
    }

    if (options.content_type) {
      query += ` AND content_type = $${paramIndex++}`;
      params.push(options.content_type);
    }

    if (options.status) {
      query += ` AND status = $${paramIndex++}`;
      params.push(options.status);
    }

    const result = await db.query(query, params);
    return parseInt(result.rows[0].count, 10);
  }

  private parseContent(row: any): WebsiteContent {
    return {
      ...row,
      faq: typeof row.faq === 'string' ? JSON.parse(row.faq) : row.faq || [],
      tags: row.tags || [],
      key_takeaways: row.key_takeaways || [],
      quotable_insights: row.quotable_insights || [],
    };
  }
}

export const contentsRepository = new ContentsRepository();
export default contentsRepository;
