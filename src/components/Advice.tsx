import { useEffect, useState } from 'react';
import { Zap, RefreshCw, AlertTriangle, MessageSquare, Server, MapPin, ShieldAlert } from 'lucide-react';
import { getAllRadarLogs, getAllTransactions, getUserSettings } from '../lib/db';
import { getRuleBasedRecommendation } from '../lib/recommendationEngine';
import SpotMap from './SpotMap';

type AdviceSource = 'gemini' | 'rule-based' | null;

interface AdviceApiResponse {
  advice: string;
  source: Exclude<AdviceSource, null>;
}

export default function Advice() {
  const [advice, setAdvice] = useState('');
  const [ruleAdvice, setRuleAdvice] = useState('');
  const [adviceSource, setAdviceSource] = useState<AdviceSource>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRuleLoading, setIsRuleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRuleAdvice = async () => {
    setIsRuleLoading(true);
    try {
      const rec = await getRuleBasedRecommendation();
      setRuleAdvice(rec);
      localStorage.setItem('maxxiss_rule_advice', rec);
      localStorage.setItem('maxxiss_rule_advice_time', Date.now().toString());
    } catch (err) {
      console.error(err);
      setRuleAdvice('Sistem lokal: Gagal mengambil instruksi saat ini.');
    } finally {
      setIsRuleLoading(false);
    }
  };

  const fetchAdvice = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const logs = await getAllRadarLogs();
      const txs = await getAllTransactions();
      const settings = await getUserSettings();

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startOfDay = today.getTime();

      const todayLogs = logs.filter((log) => log.timestamp >= startOfDay).sort((a, b) => b.timestamp - a.timestamp);
      const todayTxs = txs.filter((tx) => tx.timestamp >= startOfDay && tx.type === 'expense');

      let todayIncome = 0;
      todayLogs.forEach((log) => {
        todayIncome += log.net_fare || 0;
      });

      let todayExpense = 0;
      todayTxs.forEach((tx) => {
        todayExpense += tx.amount;
      });

      const lastOrder = todayLogs.length > 0 ? todayLogs[0] : null;
      const weather = lastOrder ? lastOrder.weather : 'Cerah';
      const now = new Date();

      const response = await fetch('/api/advice/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          day: now.toLocaleDateString('id-ID', { weekday: 'long' }),
          time: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          weather,
          income: todayIncome,
          expense: todayExpense,
          daily_target: settings.daily_target || 100000,
          last_order_type: lastOrder ? lastOrder.type.replace('_', ' ') : 'Belum narik',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch local advice');
      }

      const result = (await response.json()) as AdviceApiResponse;
      const text = result.advice || 'Gagal mendapatkan saran dari server lokal.';

      setAdvice(text);
      setAdviceSource(result.source);
      localStorage.setItem('maxxiss_ai_advice', text);
      localStorage.setItem('maxxiss_ai_advice_time', Date.now().toString());
      localStorage.setItem('maxxiss_ai_advice_source', result.source);
    } catch (err) {
      console.error(err);
      setError('Gagal menghubungi server lokal. Menampilkan saran terakhir yang tersimpan.');

      const localAdvice = localStorage.getItem('maxxiss_ai_advice');
      const localSource = localStorage.getItem('maxxiss_ai_advice_source') as AdviceSource;

      if (localAdvice) {
        setAdvice(localAdvice);
        setAdviceSource(localSource || 'rule-based');
      } else {
        setAdviceSource('rule-based');
        setAdvice('- Belum ada saran. Coba refresh lagi kalau server lokal sudah aktif, Mang.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const localAdvice = localStorage.getItem('maxxiss_ai_advice');
    const lastAdviceTime = localStorage.getItem('maxxiss_ai_advice_time');
    const localAdviceSource = localStorage.getItem('maxxiss_ai_advice_source') as AdviceSource;
    const localRuleAdvice = localStorage.getItem('maxxiss_rule_advice');
    const lastRuleTime = localStorage.getItem('maxxiss_rule_advice_time');

    if (localAdvice) {
      setAdvice(localAdvice);
    }
    if (localAdviceSource) {
      setAdviceSource(localAdviceSource);
    }
    if (localRuleAdvice) {
      setRuleAdvice(localRuleAdvice);
    }

    if (!localAdvice || !lastAdviceTime || Date.now() - parseInt(lastAdviceTime, 10) > 3600000) {
      fetchAdvice();
    }
    if (!localRuleAdvice || !lastRuleTime || Date.now() - parseInt(lastRuleTime, 10) > 1800000) {
      fetchRuleAdvice();
    }
  }, []);

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="bg-[#4A5D5A] p-5 rounded-3xl shadow-lg relative overflow-hidden shrink-0">
        <div className="absolute -right-4 -top-4 opacity-10">
          <MessageSquare size={100} />
        </div>
        <div className="flex items-center space-x-4 relative z-10">
          <div className="w-16 h-16 bg-[#F8CB1D] rounded-full flex items-center justify-center border-4 border-[#4A5D5A] shadow-md shrink-0">
            <span className="text-[#4A5D5A] font-black text-2xl">MO</span>
          </div>
          <div>
            <h2 className="text-[#F8CB1D] text-lg font-black uppercase tracking-widest leading-none mb-1">
              Mang Oded
            </h2>
            <p className="text-white/80 text-xs font-bold uppercase tracking-wider">
              Asisten Strategi Maxxiss
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        <div className="bg-white rounded-3xl shadow-sm border border-[#4A5D5A]/10 p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-[#F8CB1D]"></div>
          <div className="flex items-center justify-between mb-3 pl-1">
            <div className="flex items-center space-x-2 text-[#4A5D5A]">
              <Server size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Modul Otak Rekomendasi</span>
            </div>
            {isRuleLoading ? (
              <RefreshCw size={14} className="text-[#4A5D5A] animate-spin" />
            ) : (
              <div className="w-2 h-2 rounded-full bg-[#F8CB1D] animate-pulse"></div>
            )}
          </div>

          <div className="flex items-start space-x-3 pl-1">
            <MapPin size={20} className="text-[#4A5D5A] shrink-0 mt-0.5" />
            <p className="text-sm font-bold text-[#474B51] leading-relaxed">
              {ruleAdvice || 'Menunggu rekomendasi lokal...'}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-[#4A5D5A]/10 p-5 relative overflow-hidden">
          <div className="flex items-center space-x-2 text-[#4A5D5A] mb-3">
            <MapPin size={16} />
            <span className="text-[10px] font-black uppercase tracking-widest">Peta Spot Gacor Bandung</span>
          </div>
          <SpotMap />
        </div>

        <div className="bg-gray-200 rounded-3xl shadow-inner border border-gray-300 p-5 relative">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2 text-[#4A5D5A]">
              <Server size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Saran Server Lokal</span>
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-[#4A5D5A]/70">
              {adviceSource === 'gemini' ? 'Gemini Aktif' : 'Fallback Lokal'}
            </span>
          </div>

          {isLoading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-200/80 backdrop-blur-sm z-20 rounded-3xl">
              <RefreshCw size={40} className="text-[#4A5D5A] animate-spin mb-4" />
              <p className="text-[#4A5D5A] font-bold text-sm uppercase tracking-widest animate-pulse">
                Mang Oded lagi mikir...
              </p>
            </div>
          ) : null}

          <div className="prose prose-sm max-w-none text-[#474B51]">
            {advice ? (
              <div className="space-y-3">
                {advice.split('\n').map((line, i) => {
                  const cleanLine = line.replace(/[*#_`]/g, '').trim();
                  if (!cleanLine) {
                    return null;
                  }

                  if (cleanLine.startsWith('-')) {
                    return (
                      <div key={i} className="flex items-start space-x-3 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                        <Zap size={18} className="text-[#F8CB1D] shrink-0 mt-0.5" />
                        <p className="text-sm font-medium leading-relaxed m-0 text-[#474B51]">
                          {cleanLine.substring(1).trim()}
                        </p>
                      </div>
                    );
                  }

                  return (
                    <p key={i} className="text-sm font-bold text-[#4A5D5A] mb-2 px-1">
                      {cleanLine}
                    </p>
                  );
                })}
              </div>
            ) : (
              <div className="text-center text-[#4A5D5A]/50 py-10">
                <MessageSquare size={48} className="mx-auto mb-4 opacity-50" />
                <p className="font-bold uppercase tracking-wider text-sm">Belum ada obrolan</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center space-x-2 text-red-500 bg-red-500/10 px-4 py-3 rounded-2xl shrink-0">
          <AlertTriangle size={20} className="shrink-0" />
          <span className="text-xs font-bold leading-tight">{error}</span>
        </div>
      )}

      <div className="relative shrink-0">
        <button
          onClick={() => {
            fetchAdvice();
            fetchRuleAdvice();
          }}
          disabled={isLoading || isRuleLoading}
          className="w-full bg-[#F8CB1D] text-[#4A5D5A] hover:bg-[#F8CB1D]/90 active:scale-95 p-4 rounded-2xl transition-transform disabled:opacity-50 shadow-lg flex items-center justify-center space-x-2"
        >
          <RefreshCw size={20} className={(isLoading || isRuleLoading) ? 'animate-spin' : ''} />
          <span className="text-sm font-black uppercase tracking-widest">Minta Saran Baru</span>
        </button>

        <button
          onClick={() => alert('Saran AI dilaporkan sebagai tidak akurat. Terima kasih atas masukannya!')}
          className="absolute -top-4 right-4 bg-[#F8CB1D] text-[#4A5D5A] p-2 rounded-xl shadow-sm border border-[#4A5D5A]/10 z-20 hover:bg-[#F8CB1D]/90 transition-colors active:scale-95"
          title="Laporkan saran tidak akurat"
        >
          <ShieldAlert size={16} />
        </button>
      </div>
    </div>
  );
}
