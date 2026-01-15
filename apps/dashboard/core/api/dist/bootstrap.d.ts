import { Application, Router } from 'express';
export interface ApiModule {
    router: Router;
    basePath: string;
    requiresAuth?: boolean;
}
export declare function loadApiModules(app: Application): Promise<void>;
//# sourceMappingURL=bootstrap.d.ts.map