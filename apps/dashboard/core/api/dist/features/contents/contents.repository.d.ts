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
    faq: {
        question: string;
        answer: string;
    }[];
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
    faq?: {
        question: string;
        answer: string;
    }[];
    key_takeaways?: string[];
    quotable_insights?: string[];
    video_url?: string;
    thumbnail_url?: string;
    status?: 'draft' | 'published';
    published_at?: Date;
    created_by?: number;
}
export declare class ContentsRepository {
    create(data: CreateContentInput): Promise<WebsiteContent>;
    findById(id: string): Promise<WebsiteContent | null>;
    findBySlugAndLang(slug: string, lang: string): Promise<WebsiteContent | null>;
    findAll(options?: {
        lang?: string;
        content_type?: string;
        status?: string;
        limit?: number;
        offset?: number;
    }): Promise<WebsiteContent[]>;
    update(id: string, data: Partial<CreateContentInput>): Promise<WebsiteContent | null>;
    delete(id: string): Promise<boolean>;
    count(options?: {
        lang?: string;
        content_type?: string;
        status?: string;
    }): Promise<number>;
    private parseContent;
}
export declare const contentsRepository: ContentsRepository;
export default contentsRepository;
//# sourceMappingURL=contents.repository.d.ts.map