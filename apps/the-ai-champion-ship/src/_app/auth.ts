import { requireAuthenticated, verifyIssuer } from '@liquidmetal-ai/raindrop-framework/core/auth';

/**
 * Allow all requests without authentication
 */
export const allowAll = async (_request: Request, _env: any): Promise<boolean> => {
  return true;
};

/**
 * verify is the application-wide JWT verification hook.
 * For MVP, we allow all requests without authentication.
 * @param request The incoming request object.
 * @param env The handler environment object.
 * @returns true to allow request to continue.
 */
export const verify = allowAll;

/**
 * authorize is the application-wide authorization hook.
 * For MVP, we allow all requests without authentication.
 * @param request The incoming request object.
 * @param env The handler environment object.
 * @returns true if authorized, false otherwise.
 */
export const authorize = allowAll;
