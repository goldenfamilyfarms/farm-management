import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContextData {
  farmId: string;
  userId: string;
  role: string;
}

/**
 * TenantContext provides request-scoped tenant information
 * using AsyncLocalStorage for safe concurrent access
 */
class TenantContextClass {
  private storage = new AsyncLocalStorage<TenantContextData>();

  /**
   * Run a function within a tenant context
   */
  run<T>(context: TenantContextData, fn: () => T): T {
    return this.storage.run(context, fn);
  }

  /**
   * Get the current tenant context
   */
  get(): TenantContextData | undefined {
    return this.storage.getStore();
  }

  /**
   * Get the current farm ID
   * @throws Error if no tenant context is set
   */
  getFarmId(): string {
    const context = this.get();
    if (!context) {
      throw new Error('No tenant context available');
    }
    return context.farmId;
  }

  /**
   * Get the current user ID
   * @throws Error if no tenant context is set
   */
  getUserId(): string {
    const context = this.get();
    if (!context) {
      throw new Error('No tenant context available');
    }
    return context.userId;
  }

  /**
   * Get the current user role
   * @throws Error if no tenant context is set
   */
  getRole(): string {
    const context = this.get();
    if (!context) {
      throw new Error('No tenant context available');
    }
    return context.role;
  }

  /**
   * Check if a tenant context is currently set
   */
  isSet(): boolean {
    return this.get() !== undefined;
  }
}

export const TenantContext = new TenantContextClass();
