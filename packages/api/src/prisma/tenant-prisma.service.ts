import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { TenantContext } from '../auth/tenant/tenant.context';

/**
 * TenantPrismaService provides tenant-scoped database access
 * All queries automatically filter by the current tenant's farmId
 */
@Injectable()
export class TenantPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get the current farm ID from tenant context
   * @throws Error if no tenant context is set
   */
  getFarmId(): string {
    return TenantContext.getFarmId();
  }

  /**
   * Get the current user ID from tenant context
   */
  getUserId(): string {
    return TenantContext.getUserId();
  }

  /**
   * Add farmId filter to a where clause
   */
  withTenantFilter<T extends object>(where?: T): T & { farmId: string } {
    return {
      ...(where || {}),
      farmId: this.getFarmId(),
    } as T & { farmId: string };
  }

  /**
   * User operations scoped to current tenant
   */
  get user() {
    const farmId = this.getFarmId();
    return {
      findMany: (args?: { where?: object; include?: object; orderBy?: object; take?: number; skip?: number }) =>
        this.prisma.user.findMany({
          ...args,
          where: { ...args?.where, farmId },
        }),
      findFirst: (args?: { where?: object; include?: object; orderBy?: object }) =>
        this.prisma.user.findFirst({
          ...args,
          where: { ...args?.where, farmId },
        }),
      count: (args?: { where?: object }) =>
        this.prisma.user.count({
          ...args,
          where: { ...args?.where, farmId },
        }),
    };
  }

  /**
   * Equipment operations scoped to current tenant
   */
  get equipment() {
    const farmId = this.getFarmId();
    return {
      findMany: (args?: { where?: object; include?: object; orderBy?: object; take?: number; skip?: number }) =>
        this.prisma.equipment.findMany({
          ...args,
          where: { ...args?.where, farmId },
        }),
      findFirst: (args?: { where?: object; include?: object; orderBy?: object }) =>
        this.prisma.equipment.findFirst({
          ...args,
          where: { ...args?.where, farmId },
        }),
      count: (args?: { where?: object }) =>
        this.prisma.equipment.count({
          ...args,
          where: { ...args?.where, farmId },
        }),
    };
  }

  /**
   * Field operations scoped to current tenant
   */
  get field() {
    const farmId = this.getFarmId();
    return {
      findMany: (args?: { where?: object; include?: object; orderBy?: object; take?: number; skip?: number }) =>
        this.prisma.field.findMany({
          ...args,
          where: { ...args?.where, farmId },
        }),
      findFirst: (args?: { where?: object; include?: object; orderBy?: object }) =>
        this.prisma.field.findFirst({
          ...args,
          where: { ...args?.where, farmId },
        }),
      count: (args?: { where?: object }) =>
        this.prisma.field.count({
          ...args,
          where: { ...args?.where, farmId },
        }),
    };
  }

  /**
   * Task operations scoped to current tenant
   */
  get task() {
    const farmId = this.getFarmId();
    return {
      findMany: (args?: { where?: object; include?: object; orderBy?: object; take?: number; skip?: number }) =>
        this.prisma.task.findMany({
          ...args,
          where: { ...args?.where, farmId },
        }),
      findFirst: (args?: { where?: object; include?: object; orderBy?: object }) =>
        this.prisma.task.findFirst({
          ...args,
          where: { ...args?.where, farmId },
        }),
      count: (args?: { where?: object }) =>
        this.prisma.task.count({
          ...args,
          where: { ...args?.where, farmId },
        }),
    };
  }

  /**
   * Worker operations scoped to current tenant
   */
  get worker() {
    const farmId = this.getFarmId();
    return {
      findMany: (args?: { where?: object; include?: object; orderBy?: object; take?: number; skip?: number }) =>
        this.prisma.worker.findMany({
          ...args,
          where: { ...args?.where, farmId },
        }),
      findFirst: (args?: { where?: object; include?: object; orderBy?: object }) =>
        this.prisma.worker.findFirst({
          ...args,
          where: { ...args?.where, farmId },
        }),
      count: (args?: { where?: object }) =>
        this.prisma.worker.count({
          ...args,
          where: { ...args?.where, farmId },
        }),
    };
  }

  /**
   * TimeCard operations scoped to current tenant
   */
  get timeCard() {
    const farmId = this.getFarmId();
    return {
      findMany: (args?: { where?: object; include?: object; orderBy?: object; take?: number; skip?: number }) =>
        this.prisma.timeCard.findMany({
          ...args,
          where: { ...args?.where, farmId },
        }),
      findFirst: (args?: { where?: object; include?: object; orderBy?: object }) =>
        this.prisma.timeCard.findFirst({
          ...args,
          where: { ...args?.where, farmId },
        }),
      count: (args?: { where?: object }) =>
        this.prisma.timeCard.count({
          ...args,
          where: { ...args?.where, farmId },
        }),
    };
  }

  /**
   * Expense operations scoped to current tenant
   */
  get expense() {
    const farmId = this.getFarmId();
    return {
      findMany: (args?: { where?: object; include?: object; orderBy?: object; take?: number; skip?: number }) =>
        this.prisma.expense.findMany({
          ...args,
          where: { ...args?.where, farmId },
        }),
      findFirst: (args?: { where?: object; include?: object; orderBy?: object }) =>
        this.prisma.expense.findFirst({
          ...args,
          where: { ...args?.where, farmId },
        }),
      count: (args?: { where?: object }) =>
        this.prisma.expense.count({
          ...args,
          where: { ...args?.where, farmId },
        }),
    };
  }

  /**
   * Revenue operations scoped to current tenant
   */
  get revenue() {
    const farmId = this.getFarmId();
    return {
      findMany: (args?: { where?: object; include?: object; orderBy?: object; take?: number; skip?: number }) =>
        this.prisma.revenue.findMany({
          ...args,
          where: { ...args?.where, farmId },
        }),
      findFirst: (args?: { where?: object; include?: object; orderBy?: object }) =>
        this.prisma.revenue.findFirst({
          ...args,
          where: { ...args?.where, farmId },
        }),
      count: (args?: { where?: object }) =>
        this.prisma.revenue.count({
          ...args,
          where: { ...args?.where, farmId },
        }),
    };
  }

  /**
   * Direct access to the underlying Prisma service
   * Use with caution - bypasses tenant isolation
   */
  get $prisma() {
    return this.prisma;
  }
}
