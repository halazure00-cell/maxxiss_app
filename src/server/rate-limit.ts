interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const localWindowStore = new Map<string, RateLimitRecord>();

const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
const shouldUseRedis = Boolean(redisUrl && redisToken);

function isFailClosed() {
  return process.env.RATE_LIMIT_FAIL_CLOSED !== 'false';
}

function getWindowKey(key: string, windowMs: number, now: number) {
  const bucket = Math.floor(now / windowMs);
  return `maxxiss:ratelimit:${key}:${windowMs}:${bucket}`;
}

async function incrementRedisWindow(windowKey: string, windowMs: number) {
  const baseUrl = redisUrl!;
  const authHeader = {
    Authorization: `Bearer ${redisToken}`,
  };

  const incrResponse = await fetch(`${baseUrl}/incr/${encodeURIComponent(windowKey)}`, {
    method: 'POST',
    headers: authHeader,
  });

  if (!incrResponse.ok) {
    throw new Error(`Redis INCR failed with status ${incrResponse.status}`);
  }

  const incrPayload = await incrResponse.json() as { result?: number };
  const count = Number(incrPayload?.result || 0);

  if (count === 1) {
    const ttlSeconds = Math.max(1, Math.ceil(windowMs / 1000));
    const expireResponse = await fetch(`${baseUrl}/expire/${encodeURIComponent(windowKey)}/${ttlSeconds}`, {
      method: 'POST',
      headers: authHeader,
    });

    if (!expireResponse.ok) {
      throw new Error(`Redis EXPIRE failed with status ${expireResponse.status}`);
    }
  }

  return count;
}

function incrementLocalWindow(windowKey: string, windowMs: number, now: number) {
  const current = localWindowStore.get(windowKey);

  if (!current || current.resetAt <= now) {
    localWindowStore.set(windowKey, { count: 1, resetAt: now + windowMs });
    return 1;
  }

  current.count += 1;
  localWindowStore.set(windowKey, current);
  return current.count;
}

export async function isRateLimited(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const windowKey = getWindowKey(key, windowMs, now);

  if (!shouldUseRedis) {
    const count = incrementLocalWindow(windowKey, windowMs, now);
    return count > limit;
  }

  try {
    const count = await incrementRedisWindow(windowKey, windowMs);
    return count > limit;
  } catch (error) {
    console.error('[RATE LIMIT STORE ERROR]', error);

    if (isFailClosed()) {
      return true;
    }

    const count = incrementLocalWindow(windowKey, windowMs, now);
    return count > limit;
  }
}
