import { useEffect, useState } from 'react';
import { ArrowLeft, KeyRound, Loader2, Lock, ShieldCheck, ShieldOff, UserPlus } from 'lucide-react';
import { type AuthUser } from '../lib/auth';

interface AdminPanelProps {
  currentUser: AuthUser;
  onBack: () => void;
  onLogout: () => Promise<void>;
}

interface ManagedUser extends AuthUser {
  activeSessionCount: number;
}

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

export default function AdminPanel({ currentUser, onBack, onLogout }: AdminPanelProps) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [form, setForm] = useState({
    username: '',
    displayName: '',
    password: '',
    role: 'USER',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const payload = await request<{ success: true; users: ManagedUser[] }>('/api/admin/users');
      setUsers(payload.users);
    } catch (loadError: any) {
      setError(loadError?.message || 'Gagal memuat daftar user.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await request('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify(form),
      });

      setForm({
        username: '',
        displayName: '',
        password: '',
        role: 'USER',
      });
      await loadUsers();
    } catch (submitError: any) {
      setError(submitError?.message || 'Gagal membuat user baru.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleActive = async (user: ManagedUser) => {
    await request(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: !user.isActive }),
    });
    await loadUsers();
  };

  const resetPassword = async (user: ManagedUser) => {
    const nextPassword = window.prompt(`Masukkan password baru untuk ${user.username}`);
    if (!nextPassword) {
      return;
    }

    await request(`/api/admin/users/${user.id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ password: nextPassword }),
    });
    await loadUsers();
  };

  return (
    <div className="min-h-[100dvh] bg-[#F8F9FA] text-[#474B51] p-4 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="bg-[#4A5D5A] rounded-[28px] p-5 text-white shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.25em] text-white/60">Internal Developer</div>
              <h1 className="text-2xl font-black text-[#F8CB1D] mt-1">Panel Admin Maxxiss</h1>
              <p className="text-sm text-white/80 mt-2">
                Login sebagai <span className="font-black">{currentUser.username}</span>. Route ini sengaja tidak tampil di UI publik.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={onBack} className="px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/15 text-sm font-black uppercase tracking-wider flex items-center gap-2">
                <ArrowLeft size={16} />
                <span>Kembali</span>
              </button>
              <button onClick={onLogout} className="px-4 py-3 rounded-2xl bg-[#F8CB1D] text-[#4A5D5A] text-sm font-black uppercase tracking-wider">
                Logout
              </button>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-[360px_1fr] gap-4">
          <form onSubmit={handleCreateUser} className="bg-white rounded-[28px] border border-[#4A5D5A]/10 shadow-sm p-5 space-y-4 h-fit">
            <div className="flex items-center gap-2 text-[#4A5D5A]">
              <UserPlus size={18} />
              <h2 className="text-sm font-black uppercase tracking-[0.2em]">Buat User Baru</h2>
            </div>

            <label className="block">
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#4A5D5A]/60">Display Name</span>
              <input
                value={form.displayName}
                onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
                className="mt-2 w-full rounded-2xl border border-[#4A5D5A]/15 bg-[#F8F9FA] px-4 py-3 outline-none"
                placeholder="Nama tampilan user"
              />
            </label>

            <label className="block">
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#4A5D5A]/60">Username</span>
              <input
                value={form.username}
                onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
                className="mt-2 w-full rounded-2xl border border-[#4A5D5A]/15 bg-[#F8F9FA] px-4 py-3 outline-none"
                placeholder="username unik"
              />
            </label>

            <label className="block">
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#4A5D5A]/60">Password Awal</span>
              <input
                type="password"
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                className="mt-2 w-full rounded-2xl border border-[#4A5D5A]/15 bg-[#F8F9FA] px-4 py-3 outline-none"
                placeholder="minimal 8 karakter"
              />
            </label>

            <label className="block">
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#4A5D5A]/60">Role</span>
              <select
                value={form.role}
                onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}
                className="mt-2 w-full rounded-2xl border border-[#4A5D5A]/15 bg-[#F8F9FA] px-4 py-3 outline-none"
              >
                <option value="USER">USER</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </label>

            {error && <div className="rounded-2xl bg-red-50 text-red-600 px-4 py-3 text-sm font-bold">{error}</div>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-2xl bg-[#F8CB1D] text-[#4A5D5A] px-4 py-4 font-black uppercase tracking-[0.2em] shadow-lg disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
              <span>{isSubmitting ? 'Menyimpan...' : 'Buat Akun'}</span>
            </button>
          </form>

          <div className="bg-white rounded-[28px] border border-[#4A5D5A]/10 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-[#4A5D5A]">
                <ShieldCheck size={18} />
                <h2 className="text-sm font-black uppercase tracking-[0.2em]">Daftar User</h2>
              </div>
              <button onClick={loadUsers} className="text-xs font-black uppercase tracking-wider text-[#4A5D5A]/70">
                Refresh
              </button>
            </div>

            {isLoading ? (
              <div className="py-16 flex justify-center">
                <Loader2 size={26} className="animate-spin text-[#4A5D5A]/40" />
              </div>
            ) : (
              <div className="space-y-3">
                {users.map((user) => (
                  <div key={user.id} className="rounded-2xl border border-[#4A5D5A]/10 bg-[#F8F9FA] px-4 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-[#4A5D5A]">{user.displayName}</span>
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${user.role === 'ADMIN' ? 'bg-[#4A5D5A] text-[#F8CB1D]' : 'bg-white text-[#4A5D5A]/70'}`}>
                          {user.role}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-[#474B51]/70 mt-1">@{user.username}</div>
                      <div className="text-[11px] text-[#474B51]/60 mt-2">
                        Session aktif: {user.activeSessionCount} • Status: {user.isActive ? 'Aktif' : 'Nonaktif'}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => toggleActive(user)}
                        className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 ${user.isActive ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}
                      >
                        {user.isActive ? <ShieldOff size={14} /> : <ShieldCheck size={14} />}
                        <span>{user.isActive ? 'Nonaktifkan' : 'Aktifkan'}</span>
                      </button>
                      <button
                        onClick={() => resetPassword(user)}
                        className="px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-[#4A5D5A] text-[#F8CB1D] flex items-center gap-2"
                      >
                        <KeyRound size={14} />
                        <span>Reset Password</span>
                      </button>
                    </div>
                  </div>
                ))}

                {users.length === 0 ? (
                  <div className="py-12 text-center text-sm font-bold uppercase tracking-wider text-[#4A5D5A]/40">
                    Belum ada user terdaftar.
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
