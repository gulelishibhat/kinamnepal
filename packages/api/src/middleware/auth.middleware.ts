import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, type JwtPayload } from '../lib/jwt.js';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

function extractToken(req: Request): string | undefined {
  // 1. HttpOnly cookie (same-origin / dev)
  const cookieToken = req.cookies?.['access_token'] as string | undefined;
  if (cookieToken) return cookieToken;
  // 2. Authorization: Bearer <token> (cross-origin SPA clients)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
  // 3. ?token= query param (EventSource/SSE can't set headers)
  const queryToken = req.query?.['token'];
  if (typeof queryToken === 'string' && queryToken) return queryToken;
  return undefined;
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }
  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }
  if (req.user.role !== 'admin') {
    res.status(403).json({ success: false, error: 'Admin access required' });
    return;
  }
  next();
}

export function requireCustomer(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }
  if (req.user.role !== 'customer') {
    res.status(403).json({ success: false, error: 'Customer access required' });
    return;
  }
  next();
}

export function requireSeller(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }
  if (req.user.role !== 'seller') {
    res.status(403).json({ success: false, error: 'Seller access required' });
    return;
  }
  next();
}

/** Soft auth — attaches user if token present but does not block guests */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (token) {
    try {
      req.user = verifyAccessToken(token);
    } catch {
      // invalid token — treat as guest
    }
  }
  next();
}
