import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

export type UserRole = 'owner' | 'manager' | 'worker' | 'viewer';

/**
 * Permission matrix for role-based access control
 * Defines what each role can do in the system
 */
export const PERMISSION_MATRIX: Record<UserRole, string[]> = {
  owner: [
    'farm:read',
    'farm:write',
    'farm:delete',
    'user:read',
    'user:write',
    'user:delete',
    'equipment:read',
    'equipment:write',
    'equipment:delete',
    'field:read',
    'field:write',
    'field:delete',
    'financial:read',
    'financial:write',
    'financial:delete',
    'workforce:read',
    'workforce:write',
    'workforce:delete',
    'task:read',
    'task:write',
    'task:delete',
    'report:read',
    'report:export',
    'settings:read',
    'settings:write',
  ],
  manager: [
    'farm:read',
    'user:read',
    'equipment:read',
    'equipment:write',
    'field:read',
    'field:write',
    'financial:read',
    'financial:write',
    'workforce:read',
    'workforce:write',
    'task:read',
    'task:write',
    'task:delete',
    'report:read',
    'report:export',
    'settings:read',
  ],
  worker: [
    'farm:read',
    'equipment:read',
    'field:read',
    'task:read',
    'task:write',
    'workforce:read',
    'workforce:write:self',
  ],
  viewer: [
    'farm:read',
    'equipment:read',
    'field:read',
    'financial:read',
    'workforce:read',
    'task:read',
    'report:read',
  ],
};

/**
 * Role hierarchy - higher roles include permissions of lower roles
 */
const ROLE_HIERARCHY: Record<UserRole, number> = {
  owner: 4,
  manager: 3,
  worker: 2,
  viewer: 1,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no roles are required, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.role) {
      throw new ForbiddenException('Access denied: No user role found');
    }

    const hasRequiredRole = requiredRoles.some((role) =>
      this.hasRole(user.role, role),
    );

    if (!hasRequiredRole) {
      throw new ForbiddenException(
        `Access denied: Required role(s): ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }

  /**
   * Check if userRole has at least the same level as requiredRole
   * Uses role hierarchy for comparison
   */
  private hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
    return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
  }
}
