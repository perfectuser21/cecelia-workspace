export declare const config: {
    port: number;
    nodeEnv: string;
    apiKey: string;
    database: {
        host: string;
        port: number;
        database: string;
        user: string;
        password: string;
        max: number;
        idleTimeoutMillis: number;
        connectionTimeoutMillis: number;
    };
    workers: {
        headless: boolean;
        timeout: number;
        maxConcurrent: number;
    };
    storage: {
        sessionPath: string;
        screenshotPath: string;
    };
    notifications: {
        feishu: {
            webhookUrl: string;
        };
        slack: {
            webhookUrl: string;
        };
    };
    notion: {
        apiKey: string;
        databaseId: string;
        tasksDbId: string;
    };
    rateLimit: {
        windowMs: number;
        max: number;
    };
    logging: {
        level: string;
        format: string;
    };
    cors: {
        origin: string;
    };
};
export default config;
//# sourceMappingURL=config.d.ts.map