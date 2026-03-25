import { useState, useEffect, ReactNode } from 'react';
import { addTransaction, getTodayTransactions, getUserSettings, updateUserSettings, getTodayRadarLogs, resetTodayData } from '../lib/db';
import { 
  Coffee, 
  Fuel, 
  CircleParking, 
  Utensils, 
  Cigarette, 
  Plus, 
  ArrowDownToLine, 
  ArrowUpFromLine,
  Trash2,
  Wallet,
  Share2,
  Loader2
} from 'lucide-react';
import { Numpad } from './Numpad';
import { toast } from 'sonner';
import { playSound } from '../lib/audio';
import { syncDataToServer } from '../lib/sync';

export default function Finance() {
  const [balance, setBalance] = useState(0);
  const [income, setIncome] = useState(0);
  const [expense, setExpense] = useState(0);
  const [isSurplus, setIsSurplus] = useState(true);
  const [virtualBalance, setVirtualBalance] = useState(0);
  const [numpadAction, setNumpadAction] = useState<{ type: 'topup' } | { type: 'income', category: string } | { type: 'expense', category: string } | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const loadData = async () => {
    const txs = await getTodayTransactions();
    const radarLogs = await getTodayRadarLogs();
    
    let totalIncome = 0;
    let totalExpense = 0;

    txs.forEach(tx => {
      if (tx.type === 'income') totalIncome += tx.amount;
      if (tx.type === 'expense') totalExpense += tx.amount;
    });

    radarLogs.forEach(log => {
      totalIncome += (log.net_fare || 0);
    });

    setIncome(totalIncome);
    setExpense(totalExpense);
    const currentBalance = totalIncome - totalExpense;
    setBalance(currentBalance);
    setIsSurplus(currentBalance >= 0);

    const settings = await getUserSettings();
    setVirtualBalance(settings.current_virtual_balance);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddTransaction = async (type: 'income' | 'expense', category: string, amount: number) => {
    // Optimistic UI update for immediate feedback
    if (type === 'income') {
      setIncome(prev => prev + amount);
      setBalance(prev => prev + amount);
      setIsSurplus(balance + amount >= 0);
    } else {
      setExpense(prev => prev + amount);
      setBalance(prev => prev - amount);
      setIsSurplus(balance - amount >= 0);
    }

    await addTransaction({ type, category, amount });
    await syncDataToServer();
    playSound('success');
    toast.success(`${type === 'income' ? 'Pemasukan' : 'Pengeluaran'} dicatat!`, {
      description: `${category}: Rp ${amount.toLocaleString('id-ID')}`
    });
    // Reload to ensure sync
    loadData();
  };

  const handleTopUp = async (amount: number) => {
    setNumpadAction(null);
    
    // Update virtual balance
    const settings = await getUserSettings();
    const newBalance = settings.current_virtual_balance + amount;
    await updateUserSettings({ current_virtual_balance: newBalance });
    setVirtualBalance(newBalance);

    // Add to expense log (Top-Up Saldo Maxim)
    await handleAddTransaction('expense', 'Top-Up Saldo Maxim', amount);
    toast.success('Top-Up Saldo Maxim berhasil!');
  };

  const handleReset = async () => {
    playSound('warning');
    setShowResetConfirm(true);
  };

  const confirmReset = async () => {
    await resetTodayData();
    await syncDataToServer();
    loadData();
    setShowResetConfirm(false);
    toast.success('Data hari ini berhasil direset.');
  };

  // Format currency
  const formatRp = (num: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
  };

  const generateReceiptImage = async (): Promise<Blob> => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not supported');

    // Receipt dimensions
    const width = 400;
    const height = 550;
    canvas.width = width;
    canvas.height = height;

    // Background (Paper color)
    ctx.fillStyle = '#F8F9FA';
    ctx.fillRect(0, 0, width, height);

    // Ink color
    ctx.fillStyle = '#474B51';
    
    // Helper for dashed lines
    const drawDashedLine = (y: number) => {
      ctx.beginPath();
      ctx.setLineDash([6, 6]);
      ctx.moveTo(20, y);
      ctx.lineTo(width - 20, y);
      ctx.strokeStyle = '#474B51';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);
    };

    // Header
    ctx.textAlign = 'center';
    ctx.font = 'bold 36px "Courier New", Courier, monospace';
    ctx.fillText('MAXXISS', width / 2, 60);

    ctx.font = 'bold 16px "Courier New", Courier, monospace';
    ctx.fillText('BUKTI SETORAN HARIAN', width / 2, 90);

    drawDashedLine(115);

    // Date & Time
    const now = new Date();
    const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    ctx.textAlign = 'left';
    ctx.font = '14px "Courier New", Courier, monospace';
    ctx.fillText(`Tanggal : ${dateStr}`, 20, 150);
    ctx.fillText(`Waktu   : ${timeStr}`, 20, 175);

    drawDashedLine(205);

    // Content
    ctx.font = 'bold 16px "Courier New", Courier, monospace';
    ctx.fillText('TOTAL PEMASUKAN', 20, 250);
    ctx.textAlign = 'right';
    ctx.fillText(`Rp ${income.toLocaleString('id-ID')}`, width - 20, 250);

    ctx.textAlign = 'left';
    ctx.fillText('TOTAL PENGELUARAN', 20, 290);
    ctx.textAlign = 'right';
    ctx.fillText(`Rp ${expense.toLocaleString('id-ID')}`, width - 20, 290);

    drawDashedLine(330);

    // Total
    ctx.textAlign = 'left';
    ctx.font = 'bold 22px "Courier New", Courier, monospace';
    ctx.fillText('SALDO BERSIH', 20, 380);
    
    ctx.textAlign = 'right';
    // Color code the total
    ctx.fillStyle = balance >= 0 ? '#4A5D5A' : '#D32F2F';
    ctx.fillText(`Rp ${balance.toLocaleString('id-ID')}`, width - 20, 380);

    // Reset ink color
    ctx.fillStyle = '#474B51';
    drawDashedLine(420);

    // Footer
    ctx.textAlign = 'center';
    ctx.font = '14px "Courier New", Courier, monospace';
    ctx.fillText('Terima kasih atas kerja kerasnya!', width / 2, 460);
    ctx.fillText('Tetap semangat & hati-hati di jalan.', width / 2, 485);
    
    ctx.font = 'bold 14px "Courier New", Courier, monospace';
    ctx.fillText('--- MAXXISS APP ---', width / 2, 520);

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to create blob'));
      }, 'image/png');
    });
  };

  const handleShareReceipt = async () => {
    setIsSharing(true);
    try {
      const blob = await generateReceiptImage();
      const file = new File([blob], `Maxxiss-Rekap-${Date.now()}.png`, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'Rekap Harian Maxxiss',
          text: 'Alhamdulillah, rekap hasil narik hari ini.',
          files: [file]
        });
      } else {
        // Fallback for browsers that don't support file sharing
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        alert('Struk berhasil disimpan ke galeri HP!');
      }
    } catch (error) {
      console.error('Error sharing receipt:', error);
      alert('Gagal membagikan struk. Coba lagi nanti.');
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Virtual Wallet Panel */}
      <button 
        onClick={() => setNumpadAction({ type: 'topup' })}
        className="tour-virtual-wallet w-full bg-[#F8CB1D] hover:bg-[#e5b810] text-[#4A5D5A] rounded-2xl p-4 flex items-center justify-between shadow-lg active:scale-95 transition-transform"
      >
        <div className="flex items-center space-x-2 sm:space-x-3 overflow-hidden pr-2">
          <div className="bg-[#4A5D5A] p-2 rounded-xl text-[#F8CB1D] shrink-0">
            <Wallet size={24} className="sm:w-7 sm:h-7" />
          </div>
          <div className="text-left overflow-hidden">
            <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider opacity-80 truncate">Saldo Maxim</div>
            <div className="text-xl sm:text-2xl font-black truncate">{formatRp(virtualBalance)}</div>
          </div>
        </div>
        <div className="bg-[#4A5D5A] text-white text-[10px] sm:text-xs font-bold px-2 sm:px-3 py-2 rounded-lg uppercase shrink-0">
          Top-Up
        </div>
      </button>

      {/* ROI Indicator Panel */}
      <div className="tour-roi-panel relative p-5 sm:p-6 rounded-3xl flex flex-col justify-between transition-colors duration-300 shadow-lg bg-[#4A5D5A] min-h-[160px]">
        {/* Top Row: Title and Actions */}
        <div className="flex justify-between items-center w-full">
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-white/80 mt-0.5">
            {isSurplus ? 'Hasil Bersih' : 'Tekor Harian'}
          </span>
          <div className="flex items-center space-x-1">
            <button 
              onClick={handleShareReceipt}
              disabled={isSharing}
              className="p-1.5 opacity-90 hover:opacity-100 text-[#F8CB1D] disabled:opacity-30 transition-opacity"
              aria-label="Bagikan Struk"
            >
              {isSharing ? <Loader2 size={18} className="animate-spin" /> : <Share2 size={18} />}
            </button>
            <button 
              onClick={handleReset}
              className="p-1.5 opacity-50 hover:opacity-100 text-white transition-opacity"
              aria-label="Reset Data"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
        
        {/* Center: Main Balance */}
        <div className="flex justify-center items-center my-2">
          <h2 className={`text-4xl sm:text-5xl font-black tracking-tighter truncate ${isSurplus ? 'text-[#F8CB1D]' : 'text-red-400'}`}>
            {isSurplus ? '+' : ''}{formatRp(balance)}
          </h2>
        </div>

        {/* Bottom Row: Income & Expense */}
        <div className="flex w-full justify-between mt-4 text-[10px] sm:text-xs font-bold opacity-90 text-white">
          <div className="flex items-center space-x-1.5 truncate">
            <ArrowUpFromLine size={14} className="shrink-0 text-white/70" />
            <span className="truncate">Masuk: {formatRp(income)}</span>
          </div>
          <div className="flex items-center space-x-1.5 truncate">
            <ArrowDownToLine size={14} className="shrink-0 text-white/70" />
            <span className="truncate">Keluar: {formatRp(expense)}</span>
          </div>
        </div>
      </div>

      {/* Income Section */}
      <div className="flex-1">
        <h3 className="text-sm font-bold text-[#474B51] mb-3 uppercase tracking-wider">Argo Masuk</h3>
        <div className="grid grid-cols-3 gap-3">
          <IncomeBtn amount={10000} onClick={() => handleAddTransaction('income', 'Argo', 10000)} />
          <IncomeBtn amount={15000} onClick={() => handleAddTransaction('income', 'Argo', 15000)} />
          <IncomeBtn amount={20000} onClick={() => handleAddTransaction('income', 'Argo', 20000)} />
          <IncomeBtn amount={30000} onClick={() => handleAddTransaction('income', 'Argo', 30000)} />
          <IncomeBtn amount={50000} onClick={() => handleAddTransaction('income', 'Argo', 50000)} />
          <button 
            onClick={() => setNumpadAction({ type: 'income', category: 'Argo Manual' })}
            className="bg-[#4A5D5A] border border-[#4A5D5A]/30 rounded-xl flex flex-col items-center justify-center p-3 active:scale-95 transition-transform shadow-md"
          >
            <Plus size={24} className="text-[#F8CB1D] mb-1" />
            <span className="text-xs font-bold text-white">Lainnya</span>
          </button>
        </div>
      </div>

      {/* Expense Section */}
      <div className="flex-1">
        <h3 className="text-sm font-bold text-[#474B51] mb-3 uppercase tracking-wider">Bocor Halus</h3>
        <div className="grid grid-cols-3 gap-3">
          <ExpenseBtn 
            icon={<Fuel size={28} />} 
            label="Bensin" 
            amount={20000} 
            onClick={() => handleAddTransaction('expense', 'Bensin', 20000)} 
          />
          <ExpenseBtn 
            icon={<Utensils size={28} />} 
            label="Makan" 
            amount={15000} 
            onClick={() => handleAddTransaction('expense', 'Makan', 15000)} 
          />
          <ExpenseBtn 
            icon={<CircleParking size={28} />} 
            label="Parkir" 
            amount={2000} 
            onClick={() => handleAddTransaction('expense', 'Parkir', 2000)} 
          />
          <button 
            onClick={() => setNumpadAction({ type: 'expense', category: 'Lainnya' })}
            className="bg-[#FFE5E5] border border-[#FFB3B3] rounded-xl flex flex-col items-center justify-center p-3 active:scale-95 transition-transform shadow-md"
            style={{ minHeight: '80px' }}
          >
            <Plus size={24} className="text-[#D32F2F] mb-1" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#D32F2F]">Lainnya</span>
          </button>
        </div>
      </div>

      {numpadAction && (
        <Numpad 
          title={numpadAction.type === 'topup' ? "NOMINAL TOP-UP SALDO" : numpadAction.type === 'income' ? "NOMINAL ARGO MASUK" : "NOMINAL PENGELUARAN"}
          type={numpadAction.type}
          onConfirm={(amount) => {
            if (numpadAction.type === 'topup') {
              handleTopUp(amount);
            } else {
              handleAddTransaction(numpadAction.type, numpadAction.category, amount);
              setNumpadAction(null);
            }
          }}
          onCancel={() => setNumpadAction(null)}
        />
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 rounded-3xl p-6 w-full max-w-sm mx-auto shadow-2xl border border-zinc-800">
            <h3 className="text-xl font-bold text-white mb-2">Hapus Semua Data?</h3>
            <p className="text-zinc-400 text-sm mb-6">
              Ini akan menghapus semua catatan argo dan pengeluaran hari ini. Saldo Virtual tidak akan terhapus.
            </p>
            <div className="flex space-x-3">
              <button 
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl active:scale-95 transition-transform"
              >
                BATAL
              </button>
              <button 
                onClick={confirmReset}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl active:scale-95 transition-transform"
              >
                HAPUS
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function IncomeBtn({ amount, onClick }: { amount: number, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="bg-[#4A5D5A] border border-[#4A5D5A]/30 rounded-xl flex flex-col items-center justify-center p-3 active:scale-95 transition-transform shadow-md"
      style={{ minHeight: '80px' }}
    >
      <span className="text-[#F8CB1D] font-black text-lg">+{amount / 1000}k</span>
    </button>
  );
}

function ExpenseBtn({ icon, label, amount, onClick }: { icon: ReactNode, label: string, amount: number, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="bg-[#FFE5E5] border border-[#FFB3B3] rounded-xl flex flex-col items-center justify-center p-3 active:scale-95 transition-transform space-y-1 shadow-md"
      style={{ minHeight: '80px' }}
    >
      <div className="text-[#D32F2F]">{icon}</div>
      <span className="text-[10px] font-bold uppercase tracking-wider text-[#D32F2F]">{label}</span>
      <span className="text-xs font-black text-[#D32F2F]">-{amount / 1000}k</span>
    </button>
  );
}
