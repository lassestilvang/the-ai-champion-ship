import type { Actor } from './actor.js';
import type { ActorNamespace } from './actor.js';

/**
 * Payments actor interface
 */
export interface PaymentsActor<Env> extends Actor<Env> {
  // Product management
  getProductId(): Promise<string>;
  validateProductId(id: string): Promise<boolean>;

  // Payment operations
  generatePaymentUrl(userId: string, email?: string): Promise<string>;

  // Subscription verification (used by payment verification fallback)
  checkActiveSubscription(userId: string): Promise<{
    hasActiveSubscription: boolean;
    customerId?: string;
    subscriptionId?: string;
  }>;

  // WorkOS metadata updates (used for healing stale JWT metadata)
  updateWorkOSMetadata(
    userId: string,
    productId: string,
    customerId: string,
    status: string,
  ): Promise<void>;
}

/**
 * Payments binding type (ActorNamespace)
 */
export type Payments = ActorNamespace<PaymentsActor<unknown>>;
