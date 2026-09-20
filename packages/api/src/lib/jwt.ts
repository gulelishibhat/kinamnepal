import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export type UserRole = 'customer' | 'admin' | 'seller';

export interface JwtPayload {
  sub: string;       // user id
  role: UserRole;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

export function signAccessToken(sub: string, role: UserRole): string {
  return jwt.sign(
    { sub, role, type: 'access' } satisfies Omit<JwtPayload, 'iat' | 'exp'>,
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN } as jwt.SignOptions,
  );
}

export function signRefreshToken(sub: string, role: UserRole): string {
  return jwt.sign(
    { sub, role, type: 'refresh' } satisfies Omit<JwtPayload, 'iat' | 'exp'>,
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN } as jwt.SignOptions,
  );
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload;
}
