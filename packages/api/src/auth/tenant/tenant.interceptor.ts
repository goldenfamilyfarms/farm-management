import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { TenantContext, TenantContextData } from './tenant.context';

/**
 * Interceptor that sets up the tenant context for each request
 * This runs after guards and can access the authenticated user
 */
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (user && user.farmId) {
      const tenantData: TenantContextData = {
        farmId: user.farmId,
        userId: user.userId,
        role: user.role,
      };

      return new Observable((subscriber) => {
        TenantContext.run(tenantData, () => {
          next.handle().subscribe({
            next: (value) => subscriber.next(value),
            error: (err) => subscriber.error(err),
            complete: () => subscriber.complete(),
          });
        });
      });
    }

    return next.handle();
  }
}
