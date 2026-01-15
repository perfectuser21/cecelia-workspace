import { Request, Response, NextFunction } from 'express';
export interface AuthenticatedRequest extends Request {
    apiKey?: string;
}
export declare const authMiddleware: (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
//# sourceMappingURL=auth.middleware.d.ts.map