import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { UserRole, type AppUser } from '@prisma/client';
import { prisma } from './prisma';
import { clearSessionCookie, getCookie, getRequestIp, getUserAgent, jsonError, SESSION_COOKIE_NAME, setSessionCookie } from './http';

const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30;
const PASSWORD_ROUNDS = 12;

export function hashSessionToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, PASSWORD_ROUNDS);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export function sanitizeUser(user: AppUser) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt,
  };
}

export async function createSession(res: any, userId: string, req: any) {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashSessionToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await prisma.appSession.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      ipAddress: getRequestIp(req),
      userAgent: getUserAgent(req),
    },
  });

  setSessionCookie(res, rawToken, expiresAt);
}

export async function revokeSessionByToken(token: string | undefined) {
  if (!token) {
    return;
  }

  await prisma.appSession.updateMany({
    where: {
      tokenHash: hashSessionToken(token),
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
}

export async function revokeAllUserSessions(userId: string) {
  await prisma.appSession.updateMany({
    where: {
      userId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
}

export async function getSessionUser(req: any) {
  const rawToken = getCookie(req, SESSION_COOKIE_NAME);
  if (!rawToken) {
    return null;
  }

  const tokenHash = hashSessionToken(rawToken);
  const session = await prisma.appSession.findFirst({
    where: {
      tokenHash,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: {
      user: true,
    },
  });

  if (!session || !session.user.isActive) {
    return null;
  }

  return session.user;
}

export async function requireUser(req: any, res: any) {
  const user = await getSessionUser(req);
  if (!user) {
    jsonError(res, 401, 'Unauthorized');
    return null;
  }

  return user;
}

export async function requireAdmin(req: any, res: any) {
  const user = await requireUser(req, res);
  if (!user) {
    return null;
  }

  if (user.role !== UserRole.ADMIN) {
    jsonError(res, 403, 'Forbidden');
    return null;
  }

  return user;
}

export async function logoutRequest(req: any, res: any) {
  const rawToken = getCookie(req, SESSION_COOKIE_NAME);
  await revokeSessionByToken(rawToken);
  clearSessionCookie(res);
}
