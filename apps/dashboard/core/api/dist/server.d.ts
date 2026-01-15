declare class Server {
    private app;
    constructor();
    initialize(): Promise<void>;
    private setupMiddleware;
    private setupApiModules;
    private setupErrorHandling;
    start(): Promise<void>;
    stop(): Promise<void>;
}
export default Server;
//# sourceMappingURL=server.d.ts.map