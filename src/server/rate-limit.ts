const rateWindowStore = new Map<string, { count: number; resetAt: number }>();

export function isRateLimited(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = rateWindowStore.get(key);

  if (!current || current.resetAt <= now) {
    rateWindowStore.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  if (current.count >= limit) {
    return true;
  }

  current.count += 1;
  rateWindowStore.set(key, current);
  return false;
}
