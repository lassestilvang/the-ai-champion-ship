import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifyIssuer, requireAuthenticated } from './auth.js';
import type { JWTVerifyResult } from '@liquidmetal-ai/noway';
import type { KvCache } from '../kv_cache.js';

// Mock the noway module
vi.mock('@liquidmetal-ai/noway', () => ({
  NoWay: vi.fn(),
  decodeJwt: vi.fn(),
}));

describe('auth', () => {
  let mockNoWay: {
    verifyJWTWithJWKS: ReturnType<typeof vi.fn>;
  };
  let mockDecodeJwt: ReturnType<typeof vi.fn>;
  let mockKvCache: KvCache;
  let mockLogger: {
    info: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup NoWay mock
    mockNoWay = {
      verifyJWTWithJWKS: vi.fn(),
    };

    const { NoWay, decodeJwt } = await import('@liquidmetal-ai/noway');
    (NoWay as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => mockNoWay);
    mockDecodeJwt = decodeJwt as unknown as ReturnType<typeof vi.fn>;

    // Setup mock KvCache
    mockKvCache = {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(),
    } as unknown as KvCache;

    // Setup mock logger
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
    };
  });

  describe('verifyIssuer', () => {
    it('should return true when no Authorization header is present', async () => {
      const request = new Request('http://localhost', {});
      const env: {
        LM_AUTH_ALLOWED_ORIGINS: string;
        LM_AUTH_ALLOWED_ISSUERS: string;
        mem: KvCache;
        logger: typeof mockLogger;
        jwt?: JWTVerifyResult;
      } = {
        LM_AUTH_ALLOWED_ORIGINS: 'localhost',
        LM_AUTH_ALLOWED_ISSUERS: 'test-issuer',
        mem: mockKvCache,
        logger: mockLogger,
      };

      const result = await verifyIssuer(request, env);

      expect(result).toBe(true);
      expect(env.jwt).toBeUndefined();
    });

    it('should return true when Authorization header does not start with Bearer', async () => {
      const request = new Request('http://localhost', {
        headers: { Authorization: 'Basic abc123' },
      });
      const env: {
        LM_AUTH_ALLOWED_ORIGINS: string;
        LM_AUTH_ALLOWED_ISSUERS: string;
        mem: KvCache;
        logger: typeof mockLogger;
        jwt?: JWTVerifyResult;
      } = {
        LM_AUTH_ALLOWED_ORIGINS: 'localhost',
        LM_AUTH_ALLOWED_ISSUERS: 'test-issuer',
        mem: mockKvCache,
        logger: mockLogger,
      };

      const result = await verifyIssuer(request, env);

      expect(result).toBe(true);
      expect(env.jwt).toBeUndefined();
    });

    it('should return true when token is empty after Bearer', async () => {
      const request = new Request('http://localhost', {
        headers: { Authorization: 'Bearer ' },
      });
      const env: {
        LM_AUTH_ALLOWED_ORIGINS: string;
        LM_AUTH_ALLOWED_ISSUERS: string;
        mem: KvCache;
        logger: typeof mockLogger;
        jwt?: JWTVerifyResult;
      } = {
        LM_AUTH_ALLOWED_ORIGINS: 'localhost',
        LM_AUTH_ALLOWED_ISSUERS: 'test-issuer',
        mem: mockKvCache,
        logger: mockLogger,
      };

      const result = await verifyIssuer(request, env);

      expect(result).toBe(true);
      expect(env.jwt).toBeUndefined();
    });

    it('should populate env.jwt with valid JWT', async () => {
      const mockJwt = {
        payload: { sub: 'user123', iss: 'test-issuer' },
        header: { alg: 'RS256' },
        protectedHeader: {},
      } as unknown as JWTVerifyResult;

      mockNoWay.verifyJWTWithJWKS.mockResolvedValue(mockJwt);

      const request = new Request('http://localhost', {
        headers: { Authorization: 'Bearer valid.jwt.token' },
      });
      const env: {
        LM_AUTH_ALLOWED_ORIGINS: string;
        LM_AUTH_ALLOWED_ISSUERS: string;
        mem: KvCache;
        logger: typeof mockLogger;
        jwt?: JWTVerifyResult;
      } = {
        LM_AUTH_ALLOWED_ORIGINS: 'localhost',
        LM_AUTH_ALLOWED_ISSUERS: 'test-issuer',
        mem: mockKvCache,
        logger: mockLogger,
      };

      const result = await verifyIssuer(request, env);

      expect(result).toBe(true);
      expect(env.jwt).toEqual(mockJwt);
      expect(mockNoWay.verifyJWTWithJWKS).toHaveBeenCalledWith('valid.jwt.token', {
        issuer: ['test-issuer'],
      });
    });

    it('should throw error when LM_AUTH_ALLOWED_ORIGINS is not configured', async () => {
      const request = new Request('http://localhost', {
        headers: { Authorization: 'Bearer token' },
      });
      const env: {
        LM_AUTH_ALLOWED_ORIGINS: string;
        LM_AUTH_ALLOWED_ISSUERS: string;
        mem: KvCache;
        logger: typeof mockLogger;
        jwt?: JWTVerifyResult;
      } = {
        LM_AUTH_ALLOWED_ORIGINS: '',
        LM_AUTH_ALLOWED_ISSUERS: 'test-issuer',
        mem: mockKvCache,
        logger: mockLogger,
      };

      const result = await verifyIssuer(request, env);

      expect(result).toBe(true);
      expect(env.jwt).toBeUndefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should throw error when LM_AUTH_ALLOWED_ISSUERS is not configured', async () => {
      const request = new Request('http://localhost', {
        headers: { Authorization: 'Bearer token' },
      });
      const env: {
        LM_AUTH_ALLOWED_ORIGINS: string;
        LM_AUTH_ALLOWED_ISSUERS: string;
        mem: KvCache;
        logger: typeof mockLogger;
        jwt?: JWTVerifyResult;
      } = {
        LM_AUTH_ALLOWED_ORIGINS: 'localhost',
        LM_AUTH_ALLOWED_ISSUERS: '',
        mem: mockKvCache,
        logger: mockLogger,
      };

      const result = await verifyIssuer(request, env);

      expect(result).toBe(true);
      expect(env.jwt).toBeUndefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle multiple comma-separated issuers', async () => {
      const mockJwt = {
        payload: { sub: 'user123', iss: 'issuer2' },
        header: { alg: 'RS256' },
        protectedHeader: {},
      } as unknown as JWTVerifyResult;

      mockNoWay.verifyJWTWithJWKS.mockResolvedValue(mockJwt);

      const request = new Request('http://localhost', {
        headers: { Authorization: 'Bearer token' },
      });
      const env: {
        LM_AUTH_ALLOWED_ORIGINS: string;
        LM_AUTH_ALLOWED_ISSUERS: string;
        mem: KvCache;
        logger: typeof mockLogger;
        jwt?: JWTVerifyResult;
      } = {
        LM_AUTH_ALLOWED_ORIGINS: 'localhost',
        LM_AUTH_ALLOWED_ISSUERS: 'issuer1, issuer2, issuer3',
        mem: mockKvCache,
        logger: mockLogger,
      };

      await verifyIssuer(request, env);

      expect(mockNoWay.verifyJWTWithJWKS).toHaveBeenCalledWith('token', {
        issuer: ['issuer1', 'issuer2', 'issuer3'],
      });
    });

    it('should handle multiple comma-separated origins', async () => {
      const mockJwt = {
        payload: { sub: 'user123', iss: 'test-issuer' },
        header: { alg: 'RS256' },
        protectedHeader: {},
      } as unknown as JWTVerifyResult;

      mockNoWay.verifyJWTWithJWKS.mockResolvedValue(mockJwt);

      const request = new Request('http://localhost', {
        headers: { Authorization: 'Bearer token' },
      });
      const env: {
        LM_AUTH_ALLOWED_ORIGINS: string;
        LM_AUTH_ALLOWED_ISSUERS: string;
        mem: KvCache;
        logger: typeof mockLogger;
        jwt?: JWTVerifyResult;
      } = {
        LM_AUTH_ALLOWED_ORIGINS: 'origin1.com, origin2.com, origin3.com',
        LM_AUTH_ALLOWED_ISSUERS: 'test-issuer',
        mem: mockKvCache,
        logger: mockLogger,
      };

      await verifyIssuer(request, env);

      // Capture the NoWay constructor call to check originValidator
      const { NoWay } = await import('@liquidmetal-ai/noway');
      const nowayCall = (NoWay as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0];

      expect(nowayCall.originValidator('https://origin2.com/path')).toBe(true);
      expect(nowayCall.originValidator('https://unknown.com/path')).toBe(false);
    });

    it('should log error with issuer mismatch details', async () => {
      mockNoWay.verifyJWTWithJWKS.mockRejectedValue(new Error('Invalid issuer'));
      mockDecodeJwt.mockReturnValue({ iss: 'wrong-issuer' });

      const request = new Request('http://localhost', {
        headers: { Authorization: 'Bearer token' },
      });
      const env: {
        LM_AUTH_ALLOWED_ORIGINS: string;
        LM_AUTH_ALLOWED_ISSUERS: string;
        mem: KvCache;
        logger: typeof mockLogger;
        jwt?: JWTVerifyResult;
      } = {
        LM_AUTH_ALLOWED_ORIGINS: 'localhost',
        LM_AUTH_ALLOWED_ISSUERS: 'correct-issuer',
        mem: mockKvCache,
        logger: mockLogger,
      };

      await verifyIssuer(request, env);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('JWT verification failed')
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('wrong-issuer')
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('correct-issuer')
      );
    });

    it('should handle error during JWT decoding', async () => {
      mockNoWay.verifyJWTWithJWKS.mockRejectedValue(new Error('Verification failed'));
      mockDecodeJwt.mockImplementation(() => {
        throw new Error('Decode error');
      });

      const request = new Request('http://localhost', {
        headers: { Authorization: 'Bearer token' },
      });
      const env: {
        LM_AUTH_ALLOWED_ORIGINS: string;
        LM_AUTH_ALLOWED_ISSUERS: string;
        mem: KvCache;
        logger: typeof mockLogger;
        jwt?: JWTVerifyResult;
      } = {
        LM_AUTH_ALLOWED_ORIGINS: 'localhost',
        LM_AUTH_ALLOWED_ISSUERS: 'test-issuer',
        mem: mockKvCache,
        logger: mockLogger,
      };

      const result = await verifyIssuer(request, env);

      expect(result).toBe(true);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'JWT verification failed with error during logging',
        expect.any(Object)
      );
    });

    it('should handle non-Error thrown during verification', async () => {
      mockNoWay.verifyJWTWithJWKS.mockRejectedValue('string error');

      const request = new Request('http://localhost', {
        headers: { Authorization: 'Bearer token' },
      });
      const env: {
        LM_AUTH_ALLOWED_ORIGINS: string;
        LM_AUTH_ALLOWED_ISSUERS: string;
        mem: KvCache;
        logger: typeof mockLogger;
        jwt?: JWTVerifyResult;
      } = {
        LM_AUTH_ALLOWED_ORIGINS: 'localhost',
        LM_AUTH_ALLOWED_ISSUERS: 'test-issuer',
        mem: mockKvCache,
        logger: mockLogger,
      };

      await verifyIssuer(request, env);

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should work without logger', async () => {
      mockNoWay.verifyJWTWithJWKS.mockRejectedValue(new Error('Verification failed'));

      const request = new Request('http://localhost', {
        headers: { Authorization: 'Bearer token' },
      });
      const env: {
        LM_AUTH_ALLOWED_ORIGINS: string;
        LM_AUTH_ALLOWED_ISSUERS: string;
        mem: KvCache;
        jwt?: JWTVerifyResult;
      } = {
        LM_AUTH_ALLOWED_ORIGINS: 'localhost',
        LM_AUTH_ALLOWED_ISSUERS: 'test-issuer',
        mem: mockKvCache,
      };

      const result = await verifyIssuer(request, env);

      expect(result).toBe(true);
      expect(env.jwt).toBeUndefined();
    });

    it('should validate origins using originValidator callback', async () => {
      const mockJwt = {
        payload: { sub: 'user123', iss: 'test-issuer' },
        header: { alg: 'RS256' },
        protectedHeader: {},
      } as unknown as JWTVerifyResult;

      mockNoWay.verifyJWTWithJWKS.mockResolvedValue(mockJwt);

      const request = new Request('http://localhost', {
        headers: { Authorization: 'Bearer token' },
      });
      const env: {
        LM_AUTH_ALLOWED_ORIGINS: string;
        LM_AUTH_ALLOWED_ISSUERS: string;
        mem: KvCache;
        logger: typeof mockLogger;
        jwt?: JWTVerifyResult;
      } = {
        LM_AUTH_ALLOWED_ORIGINS: 'example.com',
        LM_AUTH_ALLOWED_ISSUERS: 'test-issuer',
        mem: mockKvCache,
        logger: mockLogger,
      };

      await verifyIssuer(request, env);

      const { NoWay } = await import('@liquidmetal-ai/noway');
      const nowayCall = (NoWay as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0];

      // Test originValidator
      expect(nowayCall.originValidator('https://example.com')).toBe(true);
      expect(nowayCall.originValidator('https://other.com')).toBe(false);
      expect(nowayCall.originValidator('invalid-url')).toBe(false);
    });

    it('should trim whitespace from issuers and origins', async () => {
      const mockJwt = {
        payload: { sub: 'user123', iss: 'issuer1' },
        header: { alg: 'RS256' },
        protectedHeader: {},
      } as unknown as JWTVerifyResult;

      mockNoWay.verifyJWTWithJWKS.mockResolvedValue(mockJwt);

      const request = new Request('http://localhost', {
        headers: { Authorization: 'Bearer token' },
      });
      const env: {
        LM_AUTH_ALLOWED_ORIGINS: string;
        LM_AUTH_ALLOWED_ISSUERS: string;
        mem: KvCache;
        logger: typeof mockLogger;
        jwt?: JWTVerifyResult;
      } = {
        LM_AUTH_ALLOWED_ORIGINS: '  origin1.com  ,  origin2.com  ',
        LM_AUTH_ALLOWED_ISSUERS: '  issuer1  ,  issuer2  ',
        mem: mockKvCache,
        logger: mockLogger,
      };

      await verifyIssuer(request, env);

      expect(mockNoWay.verifyJWTWithJWKS).toHaveBeenCalledWith('token', {
        issuer: ['issuer1', 'issuer2'],
      });
    });
  });

  describe('requireAuthenticated', () => {
    it('should return true when JWT is present', async () => {
      const request = new Request('http://localhost');
      const env: {
        LM_AUTH_ALLOWED_ORIGINS: string;
        LM_AUTH_ALLOWED_ISSUERS: string;
        mem: KvCache;
        jwt?: JWTVerifyResult;
      } = {
        LM_AUTH_ALLOWED_ORIGINS: 'localhost',
        LM_AUTH_ALLOWED_ISSUERS: 'test-issuer',
        mem: mockKvCache,
        jwt: {
          payload: { sub: 'user123' },
          header: {},
          protectedHeader: {},
        } as unknown as JWTVerifyResult,
      };

      const result = await requireAuthenticated(request, env);

      expect(result).toBe(true);
    });

    it('should return false when JWT is not present', async () => {
      const request = new Request('http://localhost');
      const env: {
        LM_AUTH_ALLOWED_ORIGINS: string;
        LM_AUTH_ALLOWED_ISSUERS: string;
        mem: KvCache;
        jwt?: JWTVerifyResult;
      } = {
        LM_AUTH_ALLOWED_ORIGINS: 'localhost',
        LM_AUTH_ALLOWED_ISSUERS: 'test-issuer',
        mem: mockKvCache,
      };

      const result = await requireAuthenticated(request, env);

      expect(result).toBe(false);
    });

    it('should return false when JWT is undefined', async () => {
      const request = new Request('http://localhost');
      const env: {
        LM_AUTH_ALLOWED_ORIGINS: string;
        LM_AUTH_ALLOWED_ISSUERS: string;
        mem: KvCache;
        jwt?: JWTVerifyResult;
      } = {
        LM_AUTH_ALLOWED_ORIGINS: 'localhost',
        LM_AUTH_ALLOWED_ISSUERS: 'test-issuer',
        mem: mockKvCache,
        jwt: undefined,
      };

      const result = await requireAuthenticated(request, env);

      expect(result).toBe(false);
    });
  });
});
