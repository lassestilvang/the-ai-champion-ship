import { describe, it, expect, beforeEach } from 'vitest';
import {
  matchOrigin,
  addCorsHeaders,
  handlePreflight,
  createCorsHandler,
  corsAllowAll,
  corsDisabled,
  type CorsConfig,
} from './cors.js';

describe('cors', () => {
  describe('matchOrigin', () => {
    it('should return null when no origin header is present', () => {
      const request = new Request('http://localhost');
      const config: CorsConfig = { origin: '*' };

      const result = matchOrigin(request, {}, config);

      expect(result).toBeNull();
    });

    it('should return * for wildcard origin', () => {
      const request = new Request('http://localhost', {
        headers: { origin: 'https://example.com' },
      });
      const config: CorsConfig = { origin: '*' };

      const result = matchOrigin(request, {}, config);

      expect(result).toBe('*');
    });

    it('should return origin when string matches', () => {
      const request = new Request('http://localhost', {
        headers: { origin: 'https://example.com' },
      });
      const config: CorsConfig = { origin: 'https://example.com' };

      const result = matchOrigin(request, {}, config);

      expect(result).toBe('https://example.com');
    });

    it('should return null when string does not match', () => {
      const request = new Request('http://localhost', {
        headers: { origin: 'https://example.com' },
      });
      const config: CorsConfig = { origin: 'https://other.com' };

      const result = matchOrigin(request, {}, config);

      expect(result).toBeNull();
    });

    it('should return origin when array contains match', () => {
      const request = new Request('http://localhost', {
        headers: { origin: 'https://example.com' },
      });
      const config: CorsConfig = {
        origin: ['https://other.com', 'https://example.com', 'https://third.com'],
      };

      const result = matchOrigin(request, {}, config);

      expect(result).toBe('https://example.com');
    });

    it('should return null when array does not contain match', () => {
      const request = new Request('http://localhost', {
        headers: { origin: 'https://example.com' },
      });
      const config: CorsConfig = {
        origin: ['https://other.com', 'https://third.com'],
      };

      const result = matchOrigin(request, {}, config);

      expect(result).toBeNull();
    });

    it('should use function to validate origin', () => {
      const request = new Request('http://localhost', {
        headers: { origin: 'https://example.com' },
      });
      const config: CorsConfig = {
        origin: (req, _env) => {
          const origin = req.headers.get('origin');
          return origin?.includes('example') ? origin : null;
        },
      };

      const result = matchOrigin(request, {}, config);

      expect(result).toBe('https://example.com');
    });

    it('should return null when function rejects origin', () => {
      const request = new Request('http://localhost', {
        headers: { origin: 'https://malicious.com' },
      });
      const config: CorsConfig = {
        origin: (req, _env) => {
          const origin = req.headers.get('origin');
          return origin?.includes('example') ? origin : null;
        },
      };

      const result = matchOrigin(request, {}, config);

      expect(result).toBeNull();
    });
  });

  describe('addCorsHeaders', () => {
    let mockResponse: Response;

    beforeEach(() => {
      mockResponse = new Response('test body', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    it('should return response unchanged when origin not allowed', () => {
      const request = new Request('http://localhost', {
        headers: { origin: 'https://malicious.com' },
      });
      const config: CorsConfig = { origin: 'https://example.com' };

      const result = addCorsHeaders(mockResponse, request, {}, config);

      expect(result.headers.get('Access-Control-Allow-Origin')).toBeNull();
      expect(result.headers.get('Content-Type')).toBe('application/json');
    });

    it('should add CORS headers when origin allowed (wildcard)', () => {
      const request = new Request('http://localhost', {
        headers: { origin: 'https://example.com' },
      });
      const config: CorsConfig = { origin: '*' };

      const result = addCorsHeaders(mockResponse, request, {}, config);

      expect(result.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(result.headers.get('Vary')).toBe('Origin');
    });

    it('should add CORS headers when origin allowed (specific)', () => {
      const request = new Request('http://localhost', {
        headers: { origin: 'https://example.com' },
      });
      const config: CorsConfig = { origin: 'https://example.com' };

      const result = addCorsHeaders(mockResponse, request, {}, config);

      expect(result.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');
      expect(result.headers.get('Vary')).toBe('Origin');
    });

    it('should add credentials header when configured', () => {
      const request = new Request('http://localhost', {
        headers: { origin: 'https://example.com' },
      });
      const config: CorsConfig = { origin: '*', credentials: true };

      const result = addCorsHeaders(mockResponse, request, {}, config);

      expect(result.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    });

    it('should not add credentials header when not configured', () => {
      const request = new Request('http://localhost', {
        headers: { origin: 'https://example.com' },
      });
      const config: CorsConfig = { origin: '*', credentials: false };

      const result = addCorsHeaders(mockResponse, request, {}, config);

      expect(result.headers.get('Access-Control-Allow-Credentials')).toBeNull();
    });

    it('should add expose headers when configured', () => {
      const request = new Request('http://localhost', {
        headers: { origin: 'https://example.com' },
      });
      const config: CorsConfig = {
        origin: '*',
        exposeHeaders: ['X-Custom-Header', 'X-Another-Header'],
      };

      const result = addCorsHeaders(mockResponse, request, {}, config);

      expect(result.headers.get('Access-Control-Expose-Headers')).toBe(
        'X-Custom-Header, X-Another-Header'
      );
    });

    it('should not add expose headers when empty', () => {
      const request = new Request('http://localhost', {
        headers: { origin: 'https://example.com' },
      });
      const config: CorsConfig = { origin: '*', exposeHeaders: [] };

      const result = addCorsHeaders(mockResponse, request, {}, config);

      expect(result.headers.get('Access-Control-Expose-Headers')).toBeNull();
    });

    it('should add Vary header when not present', () => {
      const request = new Request('http://localhost', {
        headers: { origin: 'https://example.com' },
      });
      const config: CorsConfig = { origin: '*' };

      const result = addCorsHeaders(mockResponse, request, {}, config);

      expect(result.headers.get('Vary')).toBe('Origin');
    });

    it('should append to existing Vary header', () => {
      const responseWithVary = new Response('test', {
        headers: { Vary: 'Accept-Encoding' },
      });
      const request = new Request('http://localhost', {
        headers: { origin: 'https://example.com' },
      });
      const config: CorsConfig = { origin: '*' };

      const result = addCorsHeaders(responseWithVary, request, {}, config);

      expect(result.headers.get('Vary')).toBe('Accept-Encoding, Origin');
    });

    it('should not duplicate Origin in Vary header', () => {
      const responseWithVary = new Response('test', {
        headers: { Vary: 'Origin, Accept-Encoding' },
      });
      const request = new Request('http://localhost', {
        headers: { origin: 'https://example.com' },
      });
      const config: CorsConfig = { origin: '*' };

      const result = addCorsHeaders(responseWithVary, request, {}, config);

      expect(result.headers.get('Vary')).toBe('Origin, Accept-Encoding');
    });

    it('should preserve response status and statusText', () => {
      const customResponse = new Response('error', {
        status: 404,
        statusText: 'Not Found',
      });
      const request = new Request('http://localhost', {
        headers: { origin: 'https://example.com' },
      });
      const config: CorsConfig = { origin: '*' };

      const result = addCorsHeaders(customResponse, request, {}, config);

      expect(result.status).toBe(404);
      expect(result.statusText).toBe('Not Found');
    });

    it('should preserve response body', async () => {
      const request = new Request('http://localhost', {
        headers: { origin: 'https://example.com' },
      });
      const config: CorsConfig = { origin: '*' };

      const result = addCorsHeaders(mockResponse, request, {}, config);
      const body = await result.text();

      expect(body).toBe('test body');
    });

    it('should preserve existing headers', () => {
      const request = new Request('http://localhost', {
        headers: { origin: 'https://example.com' },
      });
      const config: CorsConfig = { origin: '*' };

      const result = addCorsHeaders(mockResponse, request, {}, config);

      expect(result.headers.get('Content-Type')).toBe('application/json');
    });
  });

  describe('handlePreflight', () => {
    it('should return 403 when origin not allowed', () => {
      const request = new Request('http://localhost', {
        method: 'OPTIONS',
        headers: { origin: 'https://malicious.com' },
      });
      const config: CorsConfig = { origin: 'https://example.com' };

      const result = handlePreflight(request, {}, config);

      expect(result.status).toBe(403);
    });

    it('should return 204 with CORS headers when origin allowed', () => {
      const request = new Request('http://localhost', {
        method: 'OPTIONS',
        headers: { origin: 'https://example.com' },
      });
      const config: CorsConfig = { origin: 'https://example.com' };

      const result = handlePreflight(request, {}, config);

      expect(result.status).toBe(204);
      expect(result.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');
      expect(result.headers.get('Vary')).toBe('Origin');
    });

    it('should add credentials header when configured', () => {
      const request = new Request('http://localhost', {
        method: 'OPTIONS',
        headers: { origin: 'https://example.com' },
      });
      const config: CorsConfig = { origin: '*', credentials: true };

      const result = handlePreflight(request, {}, config);

      expect(result.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    });

    it('should use default allow methods', () => {
      const request = new Request('http://localhost', {
        method: 'OPTIONS',
        headers: { origin: 'https://example.com' },
      });
      const config: CorsConfig = { origin: '*' };

      const result = handlePreflight(request, {}, config);

      expect(result.headers.get('Access-Control-Allow-Methods')).toBe(
        'GET, POST, PUT, DELETE, PATCH, OPTIONS'
      );
    });

    it('should use custom allow methods', () => {
      const request = new Request('http://localhost', {
        method: 'OPTIONS',
        headers: { origin: 'https://example.com' },
      });
      const config: CorsConfig = {
        origin: '*',
        allowMethods: ['GET', 'POST'],
      };

      const result = handlePreflight(request, {}, config);

      expect(result.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST');
    });

    it('should use default allow headers', () => {
      const request = new Request('http://localhost', {
        method: 'OPTIONS',
        headers: { origin: 'https://example.com' },
      });
      const config: CorsConfig = { origin: '*' };

      const result = handlePreflight(request, {}, config);

      expect(result.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization');
    });

    it('should use custom allow headers', () => {
      const request = new Request('http://localhost', {
        method: 'OPTIONS',
        headers: { origin: 'https://example.com' },
      });
      const config: CorsConfig = {
        origin: '*',
        allowHeaders: ['X-Custom-Header'],
      };

      const result = handlePreflight(request, {}, config);

      expect(result.headers.get('Access-Control-Allow-Headers')).toBe('X-Custom-Header');
    });

    it('should use default maxAge', () => {
      const request = new Request('http://localhost', {
        method: 'OPTIONS',
        headers: { origin: 'https://example.com' },
      });
      const config: CorsConfig = { origin: '*' };

      const result = handlePreflight(request, {}, config);

      expect(result.headers.get('Access-Control-Max-Age')).toBe('86400');
    });

    it('should use custom maxAge', () => {
      const request = new Request('http://localhost', {
        method: 'OPTIONS',
        headers: { origin: 'https://example.com' },
      });
      const config: CorsConfig = { origin: '*', maxAge: 3600 };

      const result = handlePreflight(request, {}, config);

      expect(result.headers.get('Access-Control-Max-Age')).toBe('3600');
    });

    it('should handle maxAge of 0', () => {
      const request = new Request('http://localhost', {
        method: 'OPTIONS',
        headers: { origin: 'https://example.com' },
      });
      const config: CorsConfig = { origin: '*', maxAge: 0 };

      const result = handlePreflight(request, {}, config);

      expect(result.headers.get('Access-Control-Max-Age')).toBe('0');
    });

    it('should set Vary header', () => {
      const request = new Request('http://localhost', {
        method: 'OPTIONS',
        headers: { origin: 'https://example.com' },
      });
      const config: CorsConfig = { origin: '*' };

      const result = handlePreflight(request, {}, config);

      expect(result.headers.get('Vary')).toBe('Origin');
    });

    it('should return complete preflight response', () => {
      const request = new Request('http://localhost', {
        method: 'OPTIONS',
        headers: { origin: 'https://example.com' },
      });
      const config: CorsConfig = {
        origin: 'https://example.com',
        credentials: true,
        allowMethods: ['GET', 'POST', 'DELETE'],
        allowHeaders: ['Content-Type', 'X-Custom'],
        maxAge: 7200,
      };

      const result = handlePreflight(request, {}, config);

      expect(result.status).toBe(204);
      expect(result.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');
      expect(result.headers.get('Access-Control-Allow-Credentials')).toBe('true');
      expect(result.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, DELETE');
      expect(result.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, X-Custom');
      expect(result.headers.get('Access-Control-Max-Age')).toBe('7200');
      expect(result.headers.get('Vary')).toBe('Origin');
    });
  });

  describe('createCorsHandler', () => {
    it('should handle preflight request when no response provided', () => {
      const request = new Request('http://localhost', {
        method: 'OPTIONS',
        headers: { origin: 'https://example.com' },
      });
      const config: CorsConfig = { origin: 'https://example.com' };
      const handler = createCorsHandler(config);

      const result = handler(request, {});

      expect(result.status).toBe(204);
      expect(result.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');
    });

    it('should add CORS headers when response provided', () => {
      const request = new Request('http://localhost', {
        headers: { origin: 'https://example.com' },
      });
      const response = new Response('body', { status: 200 });
      const config: CorsConfig = { origin: 'https://example.com' };
      const handler = createCorsHandler(config);

      const result = handler(request, {}, response);

      expect(result.status).toBe(200);
      expect(result.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');
    });

    it('should reject disallowed origin in preflight', () => {
      const request = new Request('http://localhost', {
        method: 'OPTIONS',
        headers: { origin: 'https://malicious.com' },
      });
      const config: CorsConfig = { origin: 'https://example.com' };
      const handler = createCorsHandler(config);

      const result = handler(request, {});

      expect(result.status).toBe(403);
    });

    it('should not add headers for disallowed origin in regular request', () => {
      const request = new Request('http://localhost', {
        headers: { origin: 'https://malicious.com' },
      });
      const response = new Response('body');
      const config: CorsConfig = { origin: 'https://example.com' };
      const handler = createCorsHandler(config);

      const result = handler(request, {}, response);

      expect(result.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });

    it('should work with wildcard origin', () => {
      const request = new Request('http://localhost', {
        headers: { origin: 'https://any-origin.com' },
      });
      const response = new Response('body');
      const config: CorsConfig = { origin: '*' };
      const handler = createCorsHandler(config);

      const result = handler(request, {}, response);

      expect(result.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });

    it('should work with function-based origin', () => {
      const request = new Request('http://localhost', {
        headers: { origin: 'https://example.com' },
      });
      const response = new Response('body');
      const config: CorsConfig = {
        origin: (req) => (req.headers.get('origin')?.includes('example') ? req.headers.get('origin') : null),
      };
      const handler = createCorsHandler(config);

      const result = handler(request, {}, response);

      expect(result.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');
    });
  });

  describe('corsAllowAll', () => {
    it('should allow preflight from any origin', () => {
      const request = new Request('http://localhost', {
        method: 'OPTIONS',
        headers: { origin: 'https://any-origin.com' },
      });

      const result = corsAllowAll(request, {});

      expect(result.status).toBe(204);
      expect(result.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });

    it('should add CORS headers to regular response from any origin', () => {
      const request = new Request('http://localhost', {
        headers: { origin: 'https://any-origin.com' },
      });
      const response = new Response('body');

      const result = corsAllowAll(request, {}, response);

      expect(result.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });

    it('should include credentials header', () => {
      const request = new Request('http://localhost', {
        headers: { origin: 'https://example.com' },
      });
      const response = new Response('body');

      const result = corsAllowAll(request, {}, response);

      expect(result.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    });

    it('should handle preflight without origin header', () => {
      const request = new Request('http://localhost', {
        method: 'OPTIONS',
      });

      const result = corsAllowAll(request, {});

      expect(result.status).toBe(403);
    });

    it('should handle regular request without origin header', () => {
      const request = new Request('http://localhost');
      const response = new Response('body');

      const result = corsAllowAll(request, {}, response);

      expect(result.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });
  });

  describe('corsDisabled', () => {
    it('should return 403 for OPTIONS preflight request', () => {
      const request = new Request('http://localhost', {
        method: 'OPTIONS',
        headers: { origin: 'https://example.com' },
      });

      const result = corsDisabled(request, {});

      expect(result.status).toBe(403);
    });

    it('should return response unchanged for regular request', () => {
      const request = new Request('http://localhost', {
        headers: { origin: 'https://example.com' },
      });
      const response = new Response('body', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

      const result = corsDisabled(request, {}, response);

      expect(result).toBe(response);
      expect(result.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });

    it('should not add any CORS headers', () => {
      const request = new Request('http://localhost', {
        headers: { origin: 'https://example.com' },
      });
      const response = new Response('body');

      const result = corsDisabled(request, {}, response);

      expect(result.headers.get('Access-Control-Allow-Origin')).toBeNull();
      expect(result.headers.get('Access-Control-Allow-Credentials')).toBeNull();
      expect(result.headers.get('Access-Control-Allow-Methods')).toBeNull();
      expect(result.headers.get('Access-Control-Allow-Headers')).toBeNull();
    });

    it('should throw error when called without response for non-OPTIONS', () => {
      const request = new Request('http://localhost', {
        method: 'GET',
      });

      expect(() => corsDisabled(request, {})).toThrow(
        'corsDisabled called without response for non-OPTIONS request'
      );
    });

    it('should preserve response status and headers', async () => {
      const request = new Request('http://localhost', {
        headers: { origin: 'https://example.com' },
      });
      const response = new Response('test body', {
        status: 404,
        statusText: 'Not Found',
        headers: { 'X-Custom': 'value' },
      });

      const result = corsDisabled(request, {}, response);
      const body = await result.text();

      expect(result.status).toBe(404);
      expect(result.statusText).toBe('Not Found');
      expect(result.headers.get('X-Custom')).toBe('value');
      expect(body).toBe('test body');
    });
  });
});
