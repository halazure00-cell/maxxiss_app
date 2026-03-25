import { useState } from 'react';
import { Loader2, LockKeyhole, User } from 'lucide-react';

interface LoginScreenProps {
  onSubmit: (username: string, password: string) => Promise<void>;
}

export default function LoginScreen({ onSubmit }: LoginScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await onSubmit(username, password);
    } catch (submitError: any) {
      setError(submitError?.message || 'Gagal login. Periksa kembali akun Anda.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#F8F9FA] text-[#474B51] flex items-center justify-center p-5">
      <div className="w-full max-w-md">
        <div className="bg-[#4A5D5A] rounded-[32px] p-6 shadow-xl relative overflow-hidden mb-5">
          <div className="absolute -right-10 -top-10 w-36 h-36 rounded-full bg-[#F8CB1D]/20" />
          <div className="relative z-10">
            <div className="w-14 h-14 bg-[#F8CB1D] rounded-2xl flex items-center justify-center shadow-md mb-4">
              <span className="text-[#4A5D5A] font-black text-3xl leading-none">M</span>
            </div>
            <h1 className="text-[#F8CB1D] text-3xl font-black uppercase tracking-tight">Maxxiss</h1>
            <p className="text-white/80 text-sm mt-2 leading-relaxed">
              Login untuk mengakses dashboard dan data akun Anda secara penuh.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-[28px] p-5 shadow-sm border border-[#4A5D5A]/10 space-y-4">
          <div>
            <label className="text-[11px] font-black uppercase tracking-[0.2em] text-[#4A5D5A]/70 mb-2 block">
              Username
            </label>
            <div className="flex items-center space-x-3 rounded-2xl border border-[#4A5D5A]/15 bg-[#F8F9FA] px-4 py-3">
              <User size={18} className="text-[#4A5D5A]/60 shrink-0" />
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Masukkan username"
                autoComplete="username"
                className="w-full bg-transparent outline-none text-sm font-medium"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-black uppercase tracking-[0.2em] text-[#4A5D5A]/70 mb-2 block">
              Password
            </label>
            <div className="flex items-center space-x-3 rounded-2xl border border-[#4A5D5A]/15 bg-[#F8F9FA] px-4 py-3">
              <LockKeyhole size={18} className="text-[#4A5D5A]/60 shrink-0" />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Masukkan password"
                autoComplete="current-password"
                className="w-full bg-transparent outline-none text-sm font-medium"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-2xl bg-red-50 text-red-600 px-4 py-3 text-sm font-bold">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-[#F8CB1D] text-[#4A5D5A] hover:bg-[#e5b810] disabled:opacity-60 rounded-2xl px-4 py-4 font-black uppercase tracking-[0.2em] shadow-lg flex items-center justify-center space-x-2"
          >
            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : null}
            <span>{isSubmitting ? 'Memverifikasi...' : 'Masuk'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
