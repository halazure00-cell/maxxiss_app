export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  role: 'USER' | 'ADMIN';
  isActive: boolean;
  lastLoginAt?: string | null;
}

const CURRENT_USER_KEY = 'maxxiss_current_user_id';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    ...init,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || 'Request failed');
  }

  return payload as T;
}

export function getCurrentUserId() {
  return localStorage.getItem(CURRENT_USER_KEY);
}

export function setCurrentUserId(userId: string | null) {
  if (userId) {
    localStorage.setItem(CURRENT_USER_KEY, userId);
    return;
  }

  localStorage.removeItem(CURRENT_USER_KEY);
}

export async function login(username: string, password: string) {
  const payload = await request<{ success: true; user: AuthUser }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  setCurrentUserId(payload.user.id);
  return payload.user;
}

export async function logout() {
  await request<{ success: true }>('/api/auth/logout', {
    method: 'POST',
    body: JSON.stringify({}),
  });
  setCurrentUserId(null);
}

export async function getCurrentUser() {
  const response = await fetch('/api/auth/me', {
    credentials: 'same-origin',
  });

  if (response.status === 401) {
    setCurrentUserId(null);
    return null;
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.user) {
    throw new Error(payload.message || 'Gagal memuat sesi');
  }

  setCurrentUserId(payload.user.id);
  return payload.user as AuthUser;
}
