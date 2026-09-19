import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifyPayment } from './payment.js';
import type { JWTVerifyResult } from '@liquidmetal-ai/noway';
import type { Payments, PaymentsActor } from '../payments.js';

// Type alias for the payment metadata structure (flattened)
type PaymentMetadata = {
  metadata?: {
    [key: string]: string; // Flat metadata like "prod_123_status": "active"
  };
};

describe('payment', () => {
  let mockPaymentsActor: {
    getProductId: ReturnType<typeof vi.fn>;
    validateProductId: ReturnType<typeof vi.fn>;
    checkActiveSubscription: ReturnType<typeof vi.fn>;
    updateWorkOSMetadata: ReturnType<typeof vi.fn>;
  };

  let mockPaymentsBinding: {
    idFromName: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
  };

  let mockLogger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  let mockExecutionContext: {
    waitUntil: ReturnType<typeof vi.fn>;
    passThroughOnException: ReturnType<typeof vi.fn>;
  };

  const createRequest = () => new Request('http://localhost');

  const createEnv = (overrides = {}) => ({
    payments: mockPaymentsBinding as unknown as Payments,
    jwt: {
      payload: {
        sub: 'user_123',
        metadata: {},
      },
      header: {},
      protectedHeader: {},
    } as unknown as JWTVerifyResult<PaymentMetadata>,
    logger: mockLogger,
    ctx: mockExecutionContext, // Required for waitUntil
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock Payments actor
    mockPaymentsActor = {
      getProductId: vi.fn().mockResolvedValue(''),
      validateProductId: vi.fn().mockResolvedValue(false),
      checkActiveSubscription: vi.fn().mockResolvedValue({ hasActiveSubscription: false }),
      updateWorkOSMetadata: vi.fn().mockResolvedValue(undefined),
    };

    // Mock Payments binding
    mockPaymentsBinding = {
      idFromName: vi.fn().mockReturnValue('payments-id'),
      get: vi.fn().mockReturnValue(mockPaymentsActor as unknown as PaymentsActor<unknown>),
    };

    // Mock logger
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    // Mock ExecutionContext
    mockExecutionContext = {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn(),
    };
  });

  describe('Authentication & Environment Checks', () => {
    it('should return false when no JWT in env (unauthenticated)', async () => {
      const request = createRequest();
      const env = createEnv({ jwt: undefined });

      const result = await verifyPayment(request, env);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Payment verification called without authenticated JWT'
      );
    });

    it('should return false when no payments binding in env', async () => {
      const request = createRequest();
      const env = createEnv({ payments: undefined });

      const result = await verifyPayment(request, env);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'payments binding not found in environment for paid service'
      );
    });

    it('should return false when no product configured for service', async () => {
      mockPaymentsActor.getProductId.mockResolvedValue('');

      const request = createRequest();
      const env = createEnv();

      const result = await verifyPayment(request, env);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith('No product configured for this service');
    });
  });

  describe('Fast Path (JWT Metadata)', () => {
    it('should return true when JWT metadata has active status for product', async () => {
      mockPaymentsActor.getProductId.mockResolvedValue('prod_123');

      const request = createRequest();
      const env = createEnv({
        jwt: {
          payload: {
            sub: 'user_123',
            metadata: {
              prod_123_customer_id: 'cus_456',
              prod_123_status: 'active',
            },
          },
          header: {},
          protectedHeader: {},
        } as unknown as JWTVerifyResult<PaymentMetadata>,
      });

      const result = await verifyPayment(request, env);

      expect(result).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith('Payment verified via JWT metadata', {
        userId: 'user_123',
        productId: 'prod_123',
      });
      expect(mockPaymentsActor.checkActiveSubscription).not.toHaveBeenCalled();
    });

    it('should fallback to Stripe when JWT metadata status is not active', async () => {
      mockPaymentsActor.getProductId.mockResolvedValue('prod_123');
      mockPaymentsActor.checkActiveSubscription.mockResolvedValue({
        hasActiveSubscription: false,
      });

      const request = createRequest();
      const env = createEnv({
        jwt: {
          payload: {
            sub: 'user_123',
            metadata: {
              prod_123_customer_id: 'cus_456',
              prod_123_status: 'cancelled',
            },
          },
          header: {},
          protectedHeader: {},
        } as unknown as JWTVerifyResult<PaymentMetadata>,
      });

      const result = await verifyPayment(request, env);

      expect(result).toBe(false);
      expect(mockPaymentsActor.checkActiveSubscription).toHaveBeenCalledWith('user_123');
    });

    it('should fallback to Stripe when JWT metadata missing product key', async () => {
      mockPaymentsActor.getProductId.mockResolvedValue('prod_123');
      mockPaymentsActor.checkActiveSubscription.mockResolvedValue({
        hasActiveSubscription: true,
        customerId: 'cus_456',
        subscriptionId: 'sub_789',
      });

      const request = createRequest();
      const env = createEnv({
        jwt: {
          payload: {
            sub: 'user_123',
            metadata: {
              prod_999_customer_id: 'cus_other',
              prod_999_status: 'active',
            },
          },
          header: {},
          protectedHeader: {},
        } as unknown as JWTVerifyResult<PaymentMetadata>,
      });

      const result = await verifyPayment(request, env);

      expect(result).toBe(true);
      expect(mockPaymentsActor.checkActiveSubscription).toHaveBeenCalledWith('user_123');
    });

    it('should verify correct product when multiple products in metadata', async () => {
      mockPaymentsActor.getProductId.mockResolvedValue('prod_B');

      const request = createRequest();
      const env = createEnv({
        jwt: {
          payload: {
            sub: 'user_123',
            metadata: {
              prod_A_customer_id: 'cus_A',
              prod_A_status: 'cancelled',
              prod_B_customer_id: 'cus_B',
              prod_B_status: 'active',
              prod_C_customer_id: 'cus_C',
              prod_C_status: 'active',
            },
          },
          header: {},
          protectedHeader: {},
        } as unknown as JWTVerifyResult<PaymentMetadata>,
      });

      const result = await verifyPayment(request, env);

      expect(result).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith('Payment verified via JWT metadata', {
        userId: 'user_123',
        productId: 'prod_B',
      });
    });
  });

  describe('Fallback Path (Stripe Lookup)', () => {
    it('should return true when Stripe query finds active subscription', async () => {
      mockPaymentsActor.getProductId.mockResolvedValue('prod_123');
      mockPaymentsActor.checkActiveSubscription.mockResolvedValue({
        hasActiveSubscription: true,
        customerId: 'cus_456',
        subscriptionId: 'sub_789',
      });

      const request = createRequest();
      const env = createEnv({
        jwt: {
          payload: {
            sub: 'user_123',
            metadata: {},
          },
          header: {},
          protectedHeader: {},
        } as unknown as JWTVerifyResult<PaymentMetadata>,
      });

      const result = await verifyPayment(request, env);

      expect(result).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith('JWT metadata missing/invalid, checking Stripe directly', {
        userId: 'user_123',
        productId: 'prod_123',
        hasMetadata: true,
        productStatus: undefined,
      });
      expect(mockLogger.info).toHaveBeenCalledWith('Payment verified via Stripe fallback', {
        userId: 'user_123',
        productId: 'prod_123',
        subscriptionId: 'sub_789',
      });
    });

    it('should return false when Stripe query finds no active subscription', async () => {
      mockPaymentsActor.getProductId.mockResolvedValue('prod_123');
      mockPaymentsActor.checkActiveSubscription.mockResolvedValue({
        hasActiveSubscription: false,
      });

      const request = createRequest();
      const env = createEnv({
        jwt: {
          payload: {
            sub: 'user_123',
            metadata: {},
          },
          header: {},
          protectedHeader: {},
        } as unknown as JWTVerifyResult<PaymentMetadata>,
      });

      const result = await verifyPayment(request, env);

      expect(result).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith('No active subscription found', {
        userId: 'user_123',
        productId: 'prod_123',
      });
    });

    it('should return false when Stripe API error occurs', async () => {
      mockPaymentsActor.getProductId.mockResolvedValue('prod_123');
      mockPaymentsActor.checkActiveSubscription.mockRejectedValue(new Error('Stripe API error'));

      const request = createRequest();
      const env = createEnv({
        jwt: {
          payload: {
            sub: 'user_123',
            metadata: {},
          },
          header: {},
          protectedHeader: {},
        } as unknown as JWTVerifyResult<PaymentMetadata>,
      });

      const result = await verifyPayment(request, env);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith('Error checking subscription via Stripe', {
        userId: 'user_123',
        productId: 'prod_123',
        error: 'Error: Stripe API error',
      });
    });
  });

  describe('Metadata Healing', () => {
    it('should heal WorkOS metadata in background when subscription found', async () => {
      mockPaymentsActor.getProductId.mockResolvedValue('prod_123');
      mockPaymentsActor.checkActiveSubscription.mockResolvedValue({
        hasActiveSubscription: true,
        customerId: 'cus_456',
        subscriptionId: 'sub_789',
      });
      mockPaymentsActor.updateWorkOSMetadata.mockResolvedValue(undefined);

      const request = createRequest();
      const env = createEnv({
        jwt: {
          payload: {
            sub: 'user_123',
            metadata: {},
          },
          header: {},
          protectedHeader: {},
        } as unknown as JWTVerifyResult<PaymentMetadata>,
      });

      await verifyPayment(request, env);

      expect(mockExecutionContext.waitUntil).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Updating WorkOS metadata in background to heal stale JWT',
        {
          userId: 'user_123',
          productId: 'prod_123',
          subscriptionId: 'sub_789',
        }
      );

      // Execute the promise passed to waitUntil
      const healingPromise = mockExecutionContext.waitUntil.mock.calls[0]![0];
      await healingPromise;

      expect(mockPaymentsActor.updateWorkOSMetadata).toHaveBeenCalledWith(
        'user_123',
        'prod_123',
        'cus_456',
        'active'
      );
    });

    it('should not block response when healing fails', async () => {
      mockPaymentsActor.getProductId.mockResolvedValue('prod_123');
      mockPaymentsActor.checkActiveSubscription.mockResolvedValue({
        hasActiveSubscription: true,
        customerId: 'cus_456',
        subscriptionId: 'sub_789',
      });
      mockPaymentsActor.updateWorkOSMetadata.mockRejectedValue(new Error('WorkOS API error'));

      const request = createRequest();
      const env = createEnv({
        jwt: {
          payload: {
            sub: 'user_123',
            metadata: {},
          },
          header: {},
          protectedHeader: {},
        } as unknown as JWTVerifyResult<PaymentMetadata>,
      });

      const result = await verifyPayment(request, env);

      expect(result).toBe(true); // Should still return true

      // Execute the healing promise to trigger error handler
      const healingPromise = mockExecutionContext.waitUntil.mock.calls[0]![0];
      await healingPromise.catch(() => {}); // Catch the error

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to heal WorkOS metadata', {
        userId: 'user_123',
        productId: 'prod_123',
        error: 'Error: WorkOS API error',
      });
    });

    it('should not heal without ExecutionContext', async () => {
      mockPaymentsActor.getProductId.mockResolvedValue('prod_123');
      mockPaymentsActor.checkActiveSubscription.mockResolvedValue({
        hasActiveSubscription: true,
        // No customerId or subscriptionId - so no healing will be attempted
      });

      const request = createRequest();
      const env = createEnv({
        jwt: {
          payload: {
            sub: 'user_123',
            metadata: {},
          },
          header: {},
          protectedHeader: {},
        } as unknown as JWTVerifyResult<PaymentMetadata>,
      });

      const result = await verifyPayment(request, env);

      expect(result).toBe(true);
      expect(mockPaymentsActor.updateWorkOSMetadata).not.toHaveBeenCalled();
    });

    it('should not heal without customerId', async () => {
      mockPaymentsActor.getProductId.mockResolvedValue('prod_123');
      mockPaymentsActor.checkActiveSubscription.mockResolvedValue({
        hasActiveSubscription: true,
        subscriptionId: 'sub_789',
        // customerId missing
      });

      const request = createRequest();
      const env = createEnv({
        jwt: {
          payload: {
            sub: 'user_123',
            metadata: {},
          },
          header: {},
          protectedHeader: {},
        } as unknown as JWTVerifyResult<PaymentMetadata>,
      });

      const result = await verifyPayment(request, env);

      expect(result).toBe(true);
      expect(mockExecutionContext.waitUntil).not.toHaveBeenCalled();
    });

    it('should not heal without subscriptionId', async () => {
      mockPaymentsActor.getProductId.mockResolvedValue('prod_123');
      mockPaymentsActor.checkActiveSubscription.mockResolvedValue({
        hasActiveSubscription: true,
        customerId: 'cus_456',
        // subscriptionId missing
      });

      const request = createRequest();
      const env = createEnv({
        jwt: {
          payload: {
            sub: 'user_123',
            metadata: {},
          },
          header: {},
          protectedHeader: {},
        } as unknown as JWTVerifyResult<PaymentMetadata>,
      });

      const result = await verifyPayment(request, env);

      expect(result).toBe(true);
      expect(mockExecutionContext.waitUntil).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty metadata object', async () => {
      mockPaymentsActor.getProductId.mockResolvedValue('prod_123');
      mockPaymentsActor.checkActiveSubscription.mockResolvedValue({
        hasActiveSubscription: false,
      });

      const request = createRequest();
      const env = createEnv({
        jwt: {
          payload: {
            sub: 'user_123',
            metadata: {},
          },
          header: {},
          protectedHeader: {},
        } as unknown as JWTVerifyResult<PaymentMetadata>,
      });

      const result = await verifyPayment(request, env);

      expect(result).toBe(false);
      expect(mockPaymentsActor.checkActiveSubscription).toHaveBeenCalled();
    });

    it('should handle metadata with missing status field', async () => {
      mockPaymentsActor.getProductId.mockResolvedValue('prod_123');
      mockPaymentsActor.checkActiveSubscription.mockResolvedValue({
        hasActiveSubscription: true,
        customerId: 'cus_456',
        subscriptionId: 'sub_789',
      });

      const request = createRequest();
      const env = createEnv({
        jwt: {
          payload: {
            sub: 'user_123',
            metadata: {
              prod_123_customer_id: 'cus_456',
              // prod_123_status missing
            },
          },
          header: {},
          protectedHeader: {},
        } as unknown as JWTVerifyResult<PaymentMetadata>,
      });

      const result = await verifyPayment(request, env);

      expect(result).toBe(true);
      expect(mockPaymentsActor.checkActiveSubscription).toHaveBeenCalled();
    });

    it('should use consistent sharding key for Payments actor', async () => {
      mockPaymentsActor.getProductId.mockResolvedValue('prod_123');
      mockPaymentsActor.checkActiveSubscription.mockResolvedValue({
        hasActiveSubscription: true,
        customerId: 'cus_456',
        subscriptionId: 'sub_789',
      });

      const request = createRequest();
      const env = createEnv({
        jwt: {
          payload: {
            sub: 'user_123',
            metadata: {},
          },
          header: {},
          protectedHeader: {},
        } as unknown as JWTVerifyResult<PaymentMetadata>,
      });

      await verifyPayment(request, env);

      expect(mockPaymentsBinding.idFromName).toHaveBeenCalledWith('payments');
      expect(mockPaymentsBinding.get).toHaveBeenCalledWith('payments-id');
    });

    it('should work without logger', async () => {
      mockPaymentsActor.getProductId.mockResolvedValue('prod_123');

      const request = createRequest();
      const env = createEnv({
        logger: undefined,
        jwt: {
          payload: {
            sub: 'user_123',
            metadata: {
              prod_123_customer_id: 'cus_456',
              prod_123_status: 'active',
            },
          },
          header: {},
          protectedHeader: {},
        } as unknown as JWTVerifyResult<PaymentMetadata>,
      });

      const result = await verifyPayment(request, env);

      expect(result).toBe(true);
    });

    it('should handle undefined metadata in JWT', async () => {
      mockPaymentsActor.getProductId.mockResolvedValue('prod_123');
      mockPaymentsActor.checkActiveSubscription.mockResolvedValue({
        hasActiveSubscription: false,
      });

      const request = createRequest();
      const env = createEnv({
        jwt: {
          payload: {
            sub: 'user_123',
            metadata: undefined,
          },
          header: {},
          protectedHeader: {},
        } as unknown as JWTVerifyResult<PaymentMetadata>,
      });

      const result = await verifyPayment(request, env);

      expect(result).toBe(false);
      expect(mockPaymentsActor.checkActiveSubscription).toHaveBeenCalled();
    });
  });
});
