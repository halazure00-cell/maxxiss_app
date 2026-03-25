import { useState, useEffect } from 'react';
import { getAllTransactions, getAllRadarLogs, getUserSettings, updateUserSettings, deleteRadarLog } from '../lib/db';
import { RefreshCw, Calendar, Activity, Target, Edit2, Check, X, Trash2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

type TabType = 'order' | 'expense' | 'stats';

export default function Analytics() {
  const [activeTab, setActiveTab] = useState<TabType>('stats');
  const [orders, setOrders] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [dailyTarget, setDailyTarget] = useState(100000);
  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [tempTarget, setTempTarget] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const allOrders = await getAllRadarLogs();
      const allTxs = await getAllTransactions();
      const settings = await getUserSettings();
      
      setDailyTarget(settings.daily_target || 100000);
      setOrders(allOrders.sort((a, b) => b.timestamp - a.timestamp));
      setExpenses(allTxs.filter(tx => tx.type === 'expense').sort((a, b) => b.timestamp - a.timestamp));
    } catch (err) {
      console.error("Failed to load history", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveTarget = async () => {
    const val = parseInt(tempTarget.replace(/\D/g, ''), 10);
    if (!isNaN(val) && val > 0) {
      await updateUserSettings({ daily_target: val });
      setDailyTarget(val);
    }
    setIsEditingTarget(false);
  };

  const handleDeleteOrder = async (id: number) => {
    await deleteRadarLog(id);
    setConfirmDeleteId(null);
    loadData();
  };

  const formatRp = (num: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
  };

  const formatShortRp = (num: number) => {
    if (num >= 1000000) return `Rp ${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `Rp ${(num / 1000).toFixed(0)}K`;
    return `Rp ${num}`;
  };

  const formatDate = (ts: number) => {
    return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(ts));
  };

  // Calculate stats
  const getWeeklyChartData = () => {
    const data = [];
    const now = new Date();
    now.setHours(0,0,0,0);
    
    let totalIncome = 0;
    let totalExpense = 0;

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const startOfDay = d.getTime();
      const endOfDay = startOfDay + 86400000;
      
      let income = 0;
      let expense = 0;
      
      orders.forEach(o => {
        if (o.timestamp >= startOfDay && o.timestamp < endOfDay) income += (o.net_fare || 0);
      });
      expenses.forEach(e => {
        if (e.timestamp >= startOfDay && e.timestamp < endOfDay) expense += e.amount;
      });
      
      totalIncome += income;
      totalExpense += expense;

      const dayName = new Intl.DateTimeFormat('id-ID', { weekday: 'short' }).format(d);
      data.push({ name: dayName, Pendapatan: income, Pengeluaran: expense });
    }
    return { data, totalIncome, totalExpense };
  };

  const getMonthlyChartData = () => {
    const data = [];
    const now = new Date();
    now.setHours(0,0,0,0);
    
    let totalIncome = 0;
    let totalExpense = 0;

    // Go back 4 weeks
    for (let i = 3; i >= 0; i--) {
      const endOfWeek = new Date(now);
      endOfWeek.setDate(endOfWeek.getDate() - (i * 7));
      const startOfWeek = new Date(endOfWeek);
      startOfWeek.setDate(startOfWeek.getDate() - 6);
      
      const startTs = startOfWeek.getTime();
      const endTs = endOfWeek.getTime() + 86400000;
      
      let income = 0;
      let expense = 0;
      
      orders.forEach(o => {
        if (o.timestamp >= startTs && o.timestamp < endTs) income += (o.net_fare || 0);
      });
      expenses.forEach(e => {
        if (e.timestamp >= startTs && e.timestamp < endTs) expense += e.amount;
      });
      
      totalIncome += income;
      totalExpense += expense;

      data.push({ name: `Mg ${4-i}`, Pendapatan: income, Pengeluaran: expense });
    }
    return { data, totalIncome, totalExpense };
  };

  const getTodayProgress = () => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const startOfDay = today.getTime();
    
    let todayIncome = 0;
    orders.forEach(o => {
      if (o.timestamp >= startOfDay) todayIncome += (o.net_fare || 0);
    });
    
    return todayIncome;
  };

  const weekly = getWeeklyChartData();
  const monthly = getMonthlyChartData();
  const todayIncome = getTodayProgress();
  const targetPercent = Math.min(100, Math.round((todayIncome / dailyTarget) * 100));

  // Custom Tooltip for Recharts to keep it lightweight and styled
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#4A5D5A] p-2 rounded-lg shadow-lg border border-white/10 text-xs">
          <p className="font-bold text-white mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="font-bold">
              {entry.name}: {formatRp(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Tab Header */}
      <div className="flex space-x-2 bg-[#4A5D5A]/10 p-1 rounded-2xl shrink-0">
        <button 
          onClick={() => setActiveTab('stats')}
          className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-colors ${activeTab === 'stats' ? 'bg-[#4A5D5A] text-[#F8CB1D] shadow-md' : 'text-[#4A5D5A]'}`}
        >
          Statistik
        </button>
        <button 
          onClick={() => setActiveTab('order')}
          className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-colors ${activeTab === 'order' ? 'bg-[#4A5D5A] text-[#F8CB1D] shadow-md' : 'text-[#4A5D5A]'}`}
        >
          Order
        </button>
        <button 
          onClick={() => setActiveTab('expense')}
          className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-colors ${activeTab === 'expense' ? 'bg-[#4A5D5A] text-[#F8CB1D] shadow-md' : 'text-[#4A5D5A]'}`}
        >
          Bocor
        </button>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <RefreshCw size={32} className="animate-spin text-[#4A5D5A]/50" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pb-4 space-y-4">
          
          {/* STATS TAB */}
          {activeTab === 'stats' && (
            <div className="space-y-4">
              
              {/* Daily Target Card */}
              <div className="bg-white p-4 rounded-3xl shadow-sm border border-[#4A5D5A]/10">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center text-[#4A5D5A]">
                    <Target size={18} className="mr-2" />
                    <h3 className="text-sm font-bold uppercase tracking-wider">Target Harian</h3>
                  </div>
                  {!isEditingTarget ? (
                    <button onClick={() => { setTempTarget(dailyTarget.toString()); setIsEditingTarget(true); }} className="text-[#4A5D5A]/50 hover:text-[#4A5D5A] p-1">
                      <Edit2 size={16} />
                    </button>
                  ) : (
                    <div className="flex space-x-2">
                      <button onClick={() => setIsEditingTarget(false)} className="text-red-500 p-1 bg-red-50 rounded-lg">
                        <X size={16} />
                      </button>
                      <button onClick={handleSaveTarget} className="text-green-600 p-1 bg-green-50 rounded-lg">
                        <Check size={16} />
                      </button>
                    </div>
                  )}
                </div>

                {isEditingTarget ? (
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-lg font-bold text-[#4A5D5A]">Rp</span>
                    <input 
                      type="number" 
                      value={tempTarget}
                      onChange={(e) => setTempTarget(e.target.value)}
                      className="flex-1 text-xl font-black text-[#4A5D5A] bg-gray-50 p-2 rounded-xl outline-none border border-[#4A5D5A]/20"
                      autoFocus
                    />
                  </div>
                ) : (
                  <div className="mb-3">
                    <div className="flex justify-between items-end mb-1">
                      <span className="text-2xl font-black text-[#4A5D5A]">{formatRp(todayIncome)}</span>
                      <span className="text-xs font-bold text-[#4A5D5A]/50 mb-1">/ {formatRp(dailyTarget)}</span>
                    </div>
                    <div className="h-4 bg-gray-100 rounded-full overflow-hidden relative">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${targetPercent >= 100 ? 'bg-green-500' : 'bg-[#F8CB1D]'}`} 
                        style={{ width: `${targetPercent}%` }} 
                      />
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-black/50 mix-blend-overlay">
                        {targetPercent}%
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Weekly Chart */}
              <div className="bg-[#4A5D5A] p-4 rounded-3xl shadow-lg">
                <h3 className="text-[#F8CB1D] text-sm font-bold uppercase tracking-widest mb-4 flex items-center">
                  <Calendar size={16} className="mr-2" /> 7 Hari Terakhir
                </h3>
                
                <div className="h-48 w-full mb-4">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <BarChart data={weekly.data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                      <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="rgba(255,255,255,0.5)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={formatShortRp} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', color: 'white' }} />
                      <Bar dataKey="Pendapatan" fill="#4ade80" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                      <Bar dataKey="Pengeluaran" fill="#f87171" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/10">
                  <div>
                    <div className="text-[10px] font-bold text-white/60 uppercase">Total Bersih</div>
                    <div className="text-sm font-black text-green-400">{formatRp(weekly.totalIncome)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-bold text-white/60 uppercase">Total Bocor</div>
                    <div className="text-sm font-black text-red-400">{formatRp(weekly.totalExpense)}</div>
                  </div>
                </div>
              </div>

              {/* Monthly Chart */}
              <div className="bg-[#4A5D5A] p-4 rounded-3xl shadow-lg">
                <h3 className="text-[#F8CB1D] text-sm font-bold uppercase tracking-widest mb-4 flex items-center">
                  <Activity size={16} className="mr-2" /> 4 Minggu Terakhir
                </h3>
                
                <div className="h-48 w-full mb-4">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <BarChart data={monthly.data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                      <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="rgba(255,255,255,0.5)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={formatShortRp} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', color: 'white' }} />
                      <Bar dataKey="Pendapatan" fill="#4ade80" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                      <Bar dataKey="Pengeluaran" fill="#f87171" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/10">
                  <div>
                    <div className="text-[10px] font-bold text-white/60 uppercase">Total Bersih</div>
                    <div className="text-sm font-black text-green-400">{formatRp(monthly.totalIncome)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-bold text-white/60 uppercase">Total Bocor</div>
                    <div className="text-sm font-black text-red-400">{formatRp(monthly.totalExpense)}</div>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ORDER HISTORY TAB */}
          {activeTab === 'order' && (
            <div className="space-y-3">
              {orders.length === 0 ? (
                <div className="text-center text-[#4A5D5A]/50 py-10 text-sm font-bold uppercase">Belum ada riwayat order</div>
              ) : (
                orders.map((o) => (
                  <div key={o.id} className="bg-white p-4 rounded-2xl shadow-sm border border-[#4A5D5A]/10 flex justify-between items-center">
                    <div className="flex-1">
                      <div className="text-xs font-bold text-[#4A5D5A] uppercase">{o.type.replace('_', ' ')}</div>
                      <div className="text-[10px] text-[#474B51]/70">{formatDate(o.timestamp)} • {o.weather}</div>
                    </div>
                    <div className="text-right mr-3">
                      <div className="text-sm font-black text-green-600">+{formatRp(o.net_fare || 0)}</div>
                      <div className="text-[10px] text-red-500 font-bold">Pot. {formatRp(o.commission_cut || 0)}</div>
                    </div>
                    
                    {confirmDeleteId === o.id ? (
                      <div className="flex space-x-1">
                        <button onClick={() => setConfirmDeleteId(null)} className="p-2 text-gray-500 bg-gray-100 rounded-xl active:scale-95 transition-transform"><X size={16}/></button>
                        <button onClick={() => handleDeleteOrder(o.id)} className="p-2 text-white bg-red-500 rounded-xl active:scale-95 transition-transform"><Check size={16}/></button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => setConfirmDeleteId(o.id)}
                        className="p-2 text-red-500 bg-red-50 rounded-xl active:scale-95 transition-transform"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* EXPENSE HISTORY TAB */}
          {activeTab === 'expense' && (
            <div className="space-y-3">
              {expenses.length === 0 ? (
                <div className="text-center text-[#4A5D5A]/50 py-10 text-sm font-bold uppercase">Belum ada riwayat pengeluaran</div>
              ) : (
                expenses.map((e) => (
                  <div key={e.id} className="bg-white p-4 rounded-2xl shadow-sm border border-[#4A5D5A]/10 flex justify-between items-center">
                    <div>
                      <div className="text-xs font-bold text-[#4A5D5A] uppercase">{e.category}</div>
                      <div className="text-[10px] text-[#474B51]/70">{formatDate(e.timestamp)}</div>
                    </div>
                    <div className="text-sm font-black text-red-500">
                      -{formatRp(e.amount)}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

        </div>
      )}
    </div>
  );
}
