import { UserRole } from '@prisma/client';
import { createSession, getSessionUser, hashPassword, logoutRequest, requireAdmin, requireUser, revokeAllUserSessions, sanitizeUser, verifyPassword } from './auth';
import { applyPendingOperations, createRadarLog, createTransaction, deleteRadarLog, ensureUserSettings, generateAdviceForUser, getBootstrapPayload, patchUserSettings, resetTodayData } from './data';
import { getRequestIp, jsonError, methodNotAllowed, setNoStore } from './http';
import { prisma } from './prisma';
import { isRateLimited } from './rate-limit';

const USERNAME_PATTERN = /^[a-z0-9._-]{3,32}$/;
const MAX_DISPLAY_NAME_LENGTH = 60;

function parseBody(req: any) {
  if (!req.body) {
    return {};
  }

  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }

  return req.body;
}

function normalizeUsername(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function isValidUsername(username: string) {
  return USERNAME_PATTERN.test(username);
}

function isValidDisplayName(displayName: string) {
  return displayName.length >= 3 && displayName.length <= MAX_DISPLAY_NAME_LENGTH;
}

function enforceAdminRateLimit(req: any, res: any, action: string) {
  const ip = getRequestIp(req);
  if (isRateLimited(`admin:${action}:${ip}`, 120, 1000 * 60 * 15)) {
    jsonError(res, 429, 'Terlalu banyak request admin. Coba lagi nanti.');
    return true;
  }

  return false;
}

async function wouldRemoveLastActiveAdmin(userId: string, changes: { role?: UserRole; isActive?: boolean }) {
  const targetUser = await prisma.appUser.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      isActive: true,
    },
  });

  if (!targetUser || targetUser.role !== UserRole.ADMIN || !targetUser.isActive) {
    return false;
  }

  const nextRole = changes.role ?? targetUser.role;
  const nextIsActive = typeof changes.isActive === 'boolean' ? changes.isActive : targetUser.isActive;

  if (nextRole === UserRole.ADMIN && nextIsActive) {
    return false;
  }

  const activeAdminCount = await prisma.appUser.count({
    where: {
      role: UserRole.ADMIN,
      isActive: true,
    },
  });

  return activeAdminCount <= 1;
}

export async function healthHandler(req: any, res: any) {
  setNoStore(res);
  if (req.method !== 'GET') {
    return methodNotAllowed(res, ['GET']);
  }

  return res.status(200).json({
    status: 'ok',
    app: 'Maxxiss',
    mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  });
}

export async function loginHandler(req: any, res: any) {
  setNoStore(res);
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST']);
  }

  await bootstrapAdminIfNeeded();

  const ip = getRequestIp(req);
  if (isRateLimited(`login:${ip}`, 10, 1000 * 60 * 15)) {
    return jsonError(res, 429, 'Terlalu banyak percobaan login. Coba lagi nanti.');
  }

  const body = parseBody(req);
  const username = normalizeUsername(body.username);
  const password = String(body.password || '');

  if (!username || !password) {
    return jsonError(res, 400, 'Username dan password wajib diisi.');
  }

  const user = await prisma.appUser.findUnique({
    where: { username },
  });

  if (!user || !user.isActive) {
    return jsonError(res, 401, 'Username atau password salah.');
  }

  const passwordMatches = await verifyPassword(password, user.passwordHash);
  if (!passwordMatches) {
    return jsonError(res, 401, 'Username atau password salah.');
  }

  await prisma.appUser.update({
    where: { id: user.id },
    data: {
      lastLoginAt: new Date(),
    },
  });

  await createSession(res, user.id, req);

  const freshUser = await prisma.appUser.findUnique({
    where: { id: user.id },
  });

  return res.status(200).json({
    success: true,
    user: freshUser ? sanitizeUser(freshUser) : sanitizeUser(user),
  });
}

export async function logoutHandler(req: any, res: any) {
  setNoStore(res);
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST']);
  }

  await logoutRequest(req, res);
  return res.status(200).json({ success: true });
}

export async function meHandler(req: any, res: any) {
  setNoStore(res);
  if (req.method !== 'GET') {
    return methodNotAllowed(res, ['GET']);
  }

  const user = await getSessionUser(req);
  if (!user) {
    return jsonError(res, 401, 'Unauthorized');
  }

  return res.status(200).json({
    success: true,
    user: sanitizeUser(user),
  });
}

export async function bootstrapHandler(req: any, res: any) {
  setNoStore(res);
  if (req.method !== 'GET') {
    return methodNotAllowed(res, ['GET']);
  }

  const user = await requireUser(req, res);
  if (!user) {
    return;
  }

  const payload = await getBootstrapPayload(user);
  return res.status(200).json({
    success: true,
    ...payload,
  });
}

export async function adviceHandler(req: any, res: any) {
  setNoStore(res);
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST']);
  }

  const user = await requireUser(req, res);
  if (!user) {
    return;
  }

  const result = await generateAdviceForUser(user.id);
  return res.status(200).json(result);
}

export async function createTransactionHandler(req: any, res: any) {
  setNoStore(res);
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST']);
  }

  const user = await requireUser(req, res);
  if (!user) {
    return;
  }

  try {
    const transaction = await createTransaction(user.id, parseBody(req));
    return res.status(200).json({ success: true, transaction });
  } catch (error) {
    console.error('[TRANSACTION CREATE ERROR]', error);
    return jsonError(res, 400, 'Payload transaksi tidak valid.');
  }
}

export async function createRadarLogHandler(req: any, res: any) {
  setNoStore(res);
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST']);
  }

  const user = await requireUser(req, res);
  if (!user) {
    return;
  }

  try {
    const radarLog = await createRadarLog(user.id, parseBody(req));
    return res.status(200).json({ success: true, radarLog });
  } catch (error) {
    console.error('[RADAR CREATE ERROR]', error);
    return jsonError(res, 400, 'Payload radar tidak valid.');
  }
}

export async function deleteRadarLogHandler(req: any, res: any) {
  setNoStore(res);
  if (req.method !== 'DELETE') {
    return methodNotAllowed(res, ['DELETE']);
  }

  const user = await requireUser(req, res);
  if (!user) {
    return;
  }

  const id = String(req.query?.id || req.params?.id || '').trim();
  if (!id) {
    return jsonError(res, 400, 'ID radar log wajib diisi.');
  }

  await deleteRadarLog(user.id, id);
  return res.status(200).json({ success: true });
}

export async function patchUserSettingsHandler(req: any, res: any) {
  setNoStore(res);
  if (req.method !== 'PATCH') {
    return methodNotAllowed(res, ['PATCH']);
  }

  const user = await requireUser(req, res);
  if (!user) {
    return;
  }

  const settings = await patchUserSettings(user.id, parseBody(req));
  return res.status(200).json({
    success: true,
    settings,
  });
}

export async function syncPendingHandler(req: any, res: any) {
  setNoStore(res);
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST']);
  }

  const user = await requireUser(req, res);
  if (!user) {
    return;
  }

  const body = parseBody(req);
  const operations = Array.isArray(body.operations) ? body.operations : [];

  try {
    await applyPendingOperations(user.id, operations);
    const payload = await getBootstrapPayload(user);
    return res.status(200).json({
      success: true,
      ...payload,
    });
  } catch (error) {
    console.error('[SYNC PENDING ERROR]', error);
    return jsonError(res, 400, 'Gagal memproses sinkronisasi pending.');
  }
}

export async function resetTodayHandler(req: any, res: any) {
  setNoStore(res);
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST']);
  }

  const user = await requireUser(req, res);
  if (!user) {
    return;
  }

  await resetTodayData(user.id);
  const payload = await getBootstrapPayload(user);
  return res.status(200).json({
    success: true,
    ...payload,
  });
}

async function createAuditLog(adminUserId: string, action: string, targetUserId?: string, metadata?: Record<string, unknown>) {
  await prisma.adminAuditLog.create({
    data: {
      adminUserId,
      action,
      targetUserId,
      metadata: metadata as any,
    },
  });
}

export async function adminUsersHandler(req: any, res: any) {
  setNoStore(res);
  const admin = await requireAdmin(req, res);
  if (!admin) {
    return;
  }

  if (enforceAdminRateLimit(req, res, `users:${req.method}`)) {
    return;
  }

  if (req.method === 'GET') {
    const users = await prisma.appUser.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        sessions: {
          where: {
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
          select: { id: true },
        },
      },
    });

    return res.status(200).json({
      success: true,
      users: users.map((user) => ({
        ...sanitizeUser(user),
        activeSessionCount: user.sessions.length,
      })),
    });
  }

  if (req.method === 'POST') {
    const body = parseBody(req);
    const username = normalizeUsername(body.username);
    const displayName = String(body.displayName || '').trim();
    const password = String(body.password || '');
    const role = body.role === UserRole.ADMIN ? UserRole.ADMIN : UserRole.USER;

    if (!isValidUsername(username)) {
      return jsonError(res, 400, 'Username harus 3-32 karakter dan hanya boleh berisi huruf kecil, angka, titik, strip, atau underscore.');
    }

    if (!isValidDisplayName(displayName) || password.length < 8) {
      return jsonError(res, 400, 'Display name wajib 3-60 karakter dan password minimal 8 karakter.');
    }

    const existing = await prisma.appUser.findUnique({
      where: { username },
    });
    if (existing) {
      return jsonError(res, 409, 'Username sudah dipakai.');
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.appUser.create({
      data: {
        username,
        displayName,
        passwordHash,
        role,
        userSettings: {
          create: {},
        },
      },
    });

    await createAuditLog(admin.id, 'user.create', user.id, { username, role });

    return res.status(200).json({
      success: true,
      user: sanitizeUser(user),
    });
  }

  return methodNotAllowed(res, ['GET', 'POST']);
}

export async function adminUserByIdHandler(req: any, res: any) {
  setNoStore(res);
  if (req.method !== 'PATCH') {
    return methodNotAllowed(res, ['PATCH']);
  }

  const admin = await requireAdmin(req, res);
  if (!admin) {
    return;
  }

  if (enforceAdminRateLimit(req, res, 'user.patch')) {
    return;
  }

  const id = String(req.query?.id || req.params?.id || '').trim();
  if (!id) {
    return jsonError(res, 400, 'ID user wajib diisi.');
  }

  const body = parseBody(req);
  const data: Record<string, any> = {};

  if (typeof body.displayName === 'string' && body.displayName.trim()) {
    const nextDisplayName = body.displayName.trim();
    if (!isValidDisplayName(nextDisplayName)) {
      return jsonError(res, 400, 'Display name wajib 3-60 karakter.');
    }
    data.displayName = nextDisplayName;
  }
  if (typeof body.username === 'string' && body.username.trim()) {
    const nextUsername = normalizeUsername(body.username);
    if (!isValidUsername(nextUsername)) {
      return jsonError(res, 400, 'Username harus 3-32 karakter dan hanya boleh berisi huruf kecil, angka, titik, strip, atau underscore.');
    }

    const existing = await prisma.appUser.findUnique({
      where: { username: nextUsername },
      select: { id: true },
    });
    if (existing && existing.id !== id) {
      return jsonError(res, 409, 'Username sudah dipakai.');
    }

    data.username = nextUsername;
  }
  if (typeof body.isActive === 'boolean') {
    data.isActive = body.isActive;
  }
  if (body.role === UserRole.ADMIN || body.role === UserRole.USER) {
    data.role = body.role;
  }

  if (Object.keys(data).length === 0) {
    return jsonError(res, 400, 'Tidak ada perubahan yang dikirim.');
  }

  if (admin.id === id && (data.isActive === false || data.role === UserRole.USER)) {
    return jsonError(res, 400, 'Akun admin yang sedang dipakai tidak bisa menonaktifkan atau menurunkan rolenya sendiri.');
  }

  if (await wouldRemoveLastActiveAdmin(id, data)) {
    return jsonError(res, 409, 'Setidaknya harus ada satu admin aktif yang tersisa.');
  }

  const updated = await prisma.appUser.update({
    where: { id },
    data,
  });

  if (data.isActive === false) {
    await revokeAllUserSessions(id);
  }

  await createAuditLog(admin.id, 'user.update', id, data);

  return res.status(200).json({
    success: true,
    user: sanitizeUser(updated),
  });
}

export async function adminResetPasswordHandler(req: any, res: any) {
  setNoStore(res);
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST']);
  }

  const admin = await requireAdmin(req, res);
  if (!admin) {
    return;
  }

  if (enforceAdminRateLimit(req, res, 'user.reset-password')) {
    return;
  }

  const id = String(req.query?.id || req.params?.id || '').trim();
  const body = parseBody(req);
  const nextPassword = String(body.password || '');

  if (!id || nextPassword.length < 8) {
    return jsonError(res, 400, 'Password baru minimal 8 karakter wajib diisi.');
  }

  const passwordHash = await hashPassword(nextPassword);
  const user = await prisma.appUser.update({
    where: { id },
    data: {
      passwordHash,
    },
  });

  await revokeAllUserSessions(id);
  await createAuditLog(admin.id, 'user.reset-password', id, { username: user.username });

  return res.status(200).json({
    success: true,
  });
}

export async function localSyncCompatHandler(req: any, res: any) {
  setNoStore(res);
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST']);
  }

  const user = await requireUser(req, res);
  if (!user) {
    return;
  }

  const body = parseBody(req);
  const settings = body.data?.settings;
  const transactions = Array.isArray(body.data?.transactions) ? body.data.transactions : [];
  const radarLogs = Array.isArray(body.data?.radar_logs) ? body.data.radar_logs : [];

  const operations = [
    ...transactions.map((item: any) => ({
      kind: 'transaction.create' as const,
      payload: {
        clientKey: String(item.id),
        ...item,
      },
    })),
    ...radarLogs.map((item: any) => ({
      kind: 'radar-log.create' as const,
      payload: {
        clientKey: String(item.id),
        ...item,
      },
    })),
  ];

  if (settings) {
    operations.push({
      kind: 'user-settings.patch' as const,
      payload: settings,
    });
  }

  await applyPendingOperations(user.id, operations);

  const advice = await generateAdviceForUser(user.id);
  return res.status(200).json({
    success: true,
    message: 'Data berhasil disinkronisasi',
    advice: advice.advice,
  });
}

export async function bootstrapAdminIfNeeded() {
  const username = normalizeUsername(process.env.ADMIN_BOOTSTRAP_USERNAME);
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD?.trim();
  const displayName = process.env.ADMIN_BOOTSTRAP_DISPLAY_NAME?.trim() || 'Developer';

  if (!username || !password || !isValidUsername(username)) {
    return;
  }

  const existing = await prisma.appUser.findUnique({
    where: { username },
  });
  if (existing) {
    return;
  }

  const passwordHash = await hashPassword(password);
  await prisma.appUser.create({
    data: {
      username,
      displayName,
      passwordHash,
      role: UserRole.ADMIN,
      userSettings: {
        create: {},
      },
    },
  });
}

export async function ensureBootstrapDataHandler(req: any, res: any) {
  setNoStore(res);
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST']);
  }

  const admin = await requireAdmin(req, res);
  if (!admin) {
    return;
  }

  await ensureUserSettings(admin.id);
  return res.status(200).json({ success: true });
}
