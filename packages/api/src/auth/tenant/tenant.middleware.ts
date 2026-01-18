import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantContext, TenantContextData } from './tenant.context';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    farmId: string;
    role: string;
  };
}

/**
 * Middleware that sets up the tenant context for each request
 * This must run after authentication middleware
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const user = req.user;

    if (user && user.farmId) {
      const context: TenantContextData = {
        farmId: user.farmId,
        userId: user.userId,
        role: user.role,
      };

      TenantContext.run(context, () => {
        next();
      });
    } else {
      // No authenticated user, continue without tenant context
      next();
    }
  }
}
