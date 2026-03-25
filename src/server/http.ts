import { parse as parseCookie, serialize as serializeCookie } from 'cookie';

export const SESSION_COOKIE_NAME = 'maxxiss_session';

export function setNoStore(res: any) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

export function getCookies(req: any) {
  const rawCookie = req.headers?.cookie || '';
  return parseCookie(rawCookie);
}

export function getCookie(req: any, name: string) {
  return getCookies(req)[name];
}

export function setSessionCookie(res: any, token: string, expiresAt: Date) {
  const secure = process.env.NODE_ENV === 'production';
  const cookieValue = serializeCookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    expires: expiresAt,
    maxAge: Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)),
  });

  res.setHeader('Set-Cookie', cookieValue);
}

export function clearSessionCookie(res: any) {
  const secure = process.env.NODE_ENV === 'production';
  const cookieValue = serializeCookie(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    expires: new Date(0),
    maxAge: 0,
  });

  res.setHeader('Set-Cookie', cookieValue);
}

export function getRequestIp(req: any) {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }

  return req.socket?.remoteAddress || req.ip || 'unknown';
}

export function getUserAgent(req: any) {
  const userAgent = req.headers?.['user-agent'];
  return typeof userAgent === 'string' ? userAgent : null;
}

export function jsonError(res: any, status: number, message: string, details?: Record<string, unknown>) {
  setNoStore(res);
  return res.status(status).json({
    success: false,
    message,
    ...(details || {}),
  });
}

export function methodNotAllowed(res: any, allowed: string[]) {
  res.setHeader('Allow', allowed);
  return jsonError(res, 405, 'Method not allowed');
}
