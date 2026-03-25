import { useState, useEffect } from 'react';
import { Zap, RefreshCw, AlertTriangle, MessageSquare, Server, MapPin, ShieldAlert } from 'lucide-react';
import { getAllRadarLogs, getAllTransactions, getUserSettings } from '../lib/db';
import { GoogleGenAI } from "@google/genai";
import { getRuleBasedRecommendation } from '../lib/recommendationEngine';
import SpotMap from './SpotMap';

export default function Advice() {
  const [advice, setAdvice] = useState<string>('');
  const [ruleAdvice, setRuleAdvice] = useState<string>('');
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
      setRuleAdvice("Sistem Cloud: Gagal mengambil instruksi saat ini.");
    } finally {
      setIsRuleLoading(false);
    }
  };

  const fetchAdvice = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Gather Context Data
      const logs = await getAllRadarLogs();
      const txs = await getAllTransactions();
      const settings = await getUserSettings();
      
      const today = new Date();
      today.setHours(0,0,0,0);
      const startOfDay = today.getTime();
      
      const todayLogs = logs.filter(l => l.timestamp >= startOfDay).sort((a,b) => b.timestamp - a.timestamp);
      const todayTxs = txs.filter(t => t.timestamp >= startOfDay && t.type === 'expense');
      
      let todayIncome = 0;
      todayLogs.forEach(l => todayIncome += (l.net_fare || 0));
      
      let todayExpense = 0;
      todayTxs.forEach(t => todayExpense += t.amount);
      
      const lastOrder = todayLogs.length > 0 ? todayLogs[0] : null;
      const weather = lastOrder ? lastOrder.weather : 'Cerah';
      
      const dayStr = new Date().toLocaleDateString('id-ID', { weekday: 'long' });
      const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      
      const prompt = `Peran: Kamu adalah 'Mang Oded', legenda ojol Maxim Motor di Bandung yang hafal mati pola jalanan.
      
Konteks Saat Ini:
- Hari: ${dayStr}
- Jam: ${timeStr} WIB
- Cuaca Terakhir: ${weather}
- Pendapatan: Rp ${todayIncome} (Target: Rp ${settings.daily_target || 100000})
- Pengeluaran: Rp ${todayExpense}
- Orderan Terakhir: ${lastOrder ? lastOrder.type.replace('_', ' ') : 'Belum narik'}

Tugas: Berikan 3 poin saran mangkal/strategi yang SANGAT SPESIFIK dan AKURAT untuk kondisi di atas.

Aturan Wajib:
1. Analisa kombinasi Hari + Jam + Cuaca. (Misal: Senin pagi = anak sekolah/kantoran, Jumat malam = nongkrong, Minggu pagi = Gasibu/wisata, Hujan = orderan food naik).
2. SEBUTKAN NAMA LOKASI SPESIFIK di Bandung (contoh: Stasiun Bandung, Terminal Leuwipanjang, Kampus Unpad Dipatiukur, Perkantoran Asia Afrika, Kuliner Lengkong Kecil, Perumahan Antapani, dll).
3. Gunakan gaya bahasa Sunda akrab (Mang, euy, gaskeun, macet, dsb).
4. DILARANG KERAS menggunakan simbol markdown seperti bintang (*), hashtag (#), atau bold. Gunakan teks biasa saja.
5. Format output HANYA 3 baris, masing-masing diawali tanda strip (-). Jangan ada paragraf pembuka/penutup.`;

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      const text = response.text || 'Gagal mendapatkan saran dari Mang Oded.';
      setAdvice(text);
      localStorage.setItem('maxxiss_ai_advice', text);
      localStorage.setItem('maxxiss_ai_advice_time', Date.now().toString());

    } catch (err) {
      console.error(err);
      setError('Sinyal butut, Mang! Gagal kontak pusat.');
      // Fallback ke local storage jika offline/gagal
      const localAdvice = localStorage.getItem('maxxiss_ai_advice');
      if (localAdvice) {
        setAdvice(localAdvice);
      } else {
        setAdvice('- Belum ada saran. Coba refresh lagi kalau sinyal udah bagus, Mang.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const localAdvice = localStorage.getItem('maxxiss_ai_advice');
    const lastTime = localStorage.getItem('maxxiss_ai_advice_time');
    
    const localRuleAdvice = localStorage.getItem('maxxiss_rule_advice');
    const lastRuleTime = localStorage.getItem('maxxiss_rule_advice_time');

    if (localAdvice) setAdvice(localAdvice);
    if (localRuleAdvice) setRuleAdvice(localRuleAdvice);

    // Auto refresh if no advice or older than 1 hour
    if (navigator.onLine) {
      if (!localAdvice || !lastTime || Date.now() - parseInt(lastTime) > 3600000) {
        fetchAdvice();
      }
      if (!localRuleAdvice || !lastRuleTime || Date.now() - parseInt(lastRuleTime) > 1800000) { // 30 mins for rule engine
        fetchRuleAdvice();
      }
    }
  }, []);

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header Card */}
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
              Asisten AI Maxxiss
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        
        {/* Rule-Based Logic Engine (Cloud Server Simulation) */}
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
              {ruleAdvice || "Menunggu instruksi server..."}
            </p>
          </div>
        </div>

        {/* Map Integration */}
        <div className="bg-white rounded-3xl shadow-sm border border-[#4A5D5A]/10 p-5 relative overflow-hidden">
          <div className="flex items-center space-x-2 text-[#4A5D5A] mb-3">
            <MapPin size={16} />
            <span className="text-[10px] font-black uppercase tracking-widest">Peta Spot Gacor Bandung</span>
          </div>
          <SpotMap />
        </div>

        {/* AI Generative Content */}
        <div className="bg-gray-200 rounded-3xl shadow-inner border border-gray-300 p-5 relative">
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
                  if (!cleanLine) return null;

                  if (cleanLine.startsWith('-')) {
                    return (
                      <div key={i} className="flex items-start space-x-3 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                        <Zap size={18} className="text-[#F8CB1D] shrink-0 mt-0.5" />
                        <p className="text-sm font-medium leading-relaxed m-0 text-[#474B51]">
                          {cleanLine.substring(1).trim()}
                        </p>
                      </div>
                    );
                  } else {
                    return (
                      <p key={i} className="text-sm font-bold text-[#4A5D5A] mb-2 px-1">
                        {cleanLine}
                      </p>
                    );
                  }
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

      {/* Error State */}
      {error && (
        <div className="flex items-center space-x-2 text-red-500 bg-red-500/10 px-4 py-3 rounded-2xl shrink-0">
          <AlertTriangle size={20} className="shrink-0" />
          <span className="text-xs font-bold leading-tight">{error}</span>
        </div>
      )}

      {/* Action Button */}
      <div className="relative shrink-0">
        <button 
          onClick={() => { fetchAdvice(); fetchRuleAdvice(); }}
          disabled={isLoading || isRuleLoading || !navigator.onLine}
          className="w-full bg-[#F8CB1D] text-[#4A5D5A] hover:bg-[#F8CB1D]/90 active:scale-95 p-4 rounded-2xl transition-transform disabled:opacity-50 shadow-lg flex items-center justify-center space-x-2"
        >
          <RefreshCw size={20} className={(isLoading || isRuleLoading) ? 'animate-spin' : ''} />
          <span className="text-sm font-black uppercase tracking-widest">Minta Saran Baru</span>
        </button>

        {/* Report Inaccurate Advice Button */}
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
