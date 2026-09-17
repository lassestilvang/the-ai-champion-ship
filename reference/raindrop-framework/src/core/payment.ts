import { JWTVerifyResult } from '@liquidmetal-ai/noway';
import type { Payments } from '../payments.js';

type Env = {
  payments: Payments;
  jwt?: JWTVerifyResult<{
    metadata?: {
      [key: string]: string; // Flat metadata with string values (e.g., "prod_123_status": "active")
    };
  }>;
  logger?: {
    info: (msg: string, ...args: unknown[]) => void;
    warn: (msg: string, ...args: unknown[]) => void;
    error: (msg: string, ...args: unknown[]) => void;
  };
  ctx: ExecutionContext; // REQUIRED: needed for waitUntil to update WorkOS metadata in background
};

// ExecutionContext type for waitUntil
interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

/**
 * Payment verification interceptor for paid services.
 *
 * This function acts as a payment gate, similar to how verifyIssuer acts as an auth gate.
 * It should be called AFTER authentication (verifyIssuer) and authorization (requireAuthenticated).
 *
 * Validates that:
 * 1. User has valid JWT with metadata (fast path)
 * 2. Subscription status is 'active' for the specific product
 * OR
 * 3. Falls back to Stripe API lookup if JWT metadata is missing/stale (handles race conditions)
 *
 * Expected JWT metadata structure (flattened with product_id prefix):
 * {
 *   "prod_123_customer_id": "cus_456",
 *   "prod_123_status": "active",
 *   "prod_789_customer_id": "cus_abc",
 *   "prod_789_status": "cancelled"
 * }
 *
 * This structure allows a single user to have multiple product subscriptions.
 * WorkOS requires flat metadata with string values, so we use prefixed keys.
 *
 * Race condition handling:
 * If JWT was issued before webhook updated WorkOS metadata, this will query Stripe directly
 * to check for active subscriptions. This adds latency but ensures paying users get access.
 * The WorkOS metadata is then "healed" in the background using ctx.waitUntil().
 *
 * IMPORTANT: When calling verifyPayment from a Service, you must pass this.ctx:
 *
 * Example usage in a Service:
 * ```typescript
 * const hasAccess = await verifyPayment(request, {
 *   payments: this.env.payments,
 *   jwt: this.env.jwt,
 *   logger: this.env.logger,
 *   ctx: this.ctx  // ← REQUIRED: pass execution context from Service
 * });
 * ```
 *
 * @param request The incoming request object.
 * @param env The environment object containing payments binding, JWT, and execution context.
 * @returns True if user has active subscription for this product, false otherwise.
 */
export const verifyPayment = async (request: Request, env: Env): Promise<boolean> => {
  // Must have authenticated JWT
  if (!env.jwt) {
    env.logger?.error('Payment verification called without authenticated JWT');
    return false;
  }

  const userId = env.jwt.payload.sub!; // WorkOS user ID

  // Check if Payments binding exists
  if (!env.payments) {
    env.logger?.error('payments binding not found in environment for paid service');
    return false;
  }

  // Get Payments actor instance (using consistent sharding key)
  const paymentsId = env.payments.idFromName('payments');
  const paymentsActor = env.payments.get(paymentsId);

  // Get the product ID for this service
  const productId = await paymentsActor.getProductId();
  if (!productId) {
    env.logger?.error('No product configured for this service');
    return false;
  }

  // Fast path: Check JWT metadata first
  const metadata = env.jwt.payload.metadata;
  const statusKey = `${productId}_status`;
  if (metadata?.[statusKey] === 'active') {
    env.logger?.info('Payment verified via JWT metadata', { userId, productId });
    return true;
  }

  // Fallback path: Query Stripe directly
  // This handles:
  // - JWT issued before webhook updated WorkOS metadata (race condition)
  // - Stale JWT (subscription status changed since JWT was issued)
  // - Missing or invalid JWT metadata
  env.logger?.info('JWT metadata missing/invalid, checking Stripe directly', {
    userId,
    productId,
    hasMetadata: !!metadata,
    productStatus: metadata?.[statusKey],
  });

  try {
    const subscriptionResult = await paymentsActor.checkActiveSubscription(userId);

    if (subscriptionResult.hasActiveSubscription) {
      env.logger?.info('Payment verified via Stripe fallback', {
        userId,
        productId,
        subscriptionId: subscriptionResult.subscriptionId,
      });

      // "Heal" the WorkOS metadata if we have subscription details
      // Do this in the background so we don't block the request
      if (subscriptionResult.customerId && subscriptionResult.subscriptionId) {
        env.logger?.info('Updating WorkOS metadata in background to heal stale JWT', {
          userId,
          productId,
          subscriptionId: subscriptionResult.subscriptionId,
        });

        // Use waitUntil to update WorkOS metadata without blocking the response
        env.ctx.waitUntil(
          paymentsActor
            .updateWorkOSMetadata(userId, productId, subscriptionResult.customerId, 'active')
            .catch((err) => {
              env.logger?.error('Failed to heal WorkOS metadata', {
                userId,
                productId,
                error: String(err),
              });
            }),
        );
      }

      return true;
    } else {
      env.logger?.info('No active subscription found', { userId, productId });
      return false;
    }
  } catch (error) {
    env.logger?.error('Error checking subscription via Stripe', {
      userId,
      productId,
      error: String(error),
    });
    return false;
  }
};
