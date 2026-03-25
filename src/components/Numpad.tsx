import React, { useState } from 'react';

interface NumpadProps {
  onConfirm: (value: number) => void;
  onCancel: () => void;
  title: string;
  type?: 'income' | 'expense' | 'topup';
}

export const Numpad: React.FC<NumpadProps> = ({ onConfirm, onCancel, title, type = 'income' }) => {
  const [value, setValue] = useState<string>('');
  const [showManual, setShowManual] = useState(false);

  // Preset nominal yang sering muncul di Maxim Bandung
  const presets = [8900, 10000, 11200, 15000, 20000, 25000];

  const handlePress = (num: string) => {
    setValue(prev => prev + num);
  };

  const handleDelete = () => {
    setValue(prev => prev.slice(0, -1));
  };

  const handleConfirm = () => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue > 0) {
      onConfirm(numValue);
    }
  };

  // Determine colors based on type
  const isExpense = type === 'expense';
  const isTopup = type === 'topup';
  
  const textColor = isExpense ? 'text-red-400' : isTopup ? 'text-[#F8CB1D]' : 'text-emerald-400';
  const confirmBgColor = isExpense ? 'bg-red-500 hover:bg-red-600 text-white' : isTopup ? 'bg-[#F8CB1D] hover:bg-[#e5b810] text-[#4A5D5A]' : 'bg-emerald-500 hover:bg-emerald-600 text-white';

  if (!showManual) {
    return (
      <div className="fixed inset-0 bg-black/80 z-50 flex flex-col justify-end">
        <div className="bg-zinc-900 rounded-t-3xl p-4 sm:p-6 w-full max-w-md mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-white">{title}</h3>
            <button onClick={onCancel} className="text-zinc-400 hover:text-white p-2 text-sm font-bold">BATAL</button>
          </div>
          
          <div className="grid grid-cols-2 gap-3 mb-4">
            {presets.map(p => (
              <button 
                key={p}
                onClick={() => onConfirm(p)}
                className={`bg-zinc-800 hover:bg-zinc-700 ${textColor} text-xl font-bold py-4 rounded-2xl active:scale-95 transition-transform`}
              >
                Rp {p.toLocaleString('id-ID')}
              </button>
            ))}
          </div>
          
          <button 
            onClick={() => setShowManual(true)}
            className="w-full bg-zinc-800 hover:bg-zinc-700 text-white text-lg font-bold py-4 rounded-2xl active:scale-95 transition-transform"
          >
            KETIK MANUAL
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col justify-end">
      <div className="bg-zinc-900 rounded-t-3xl p-4 sm:p-6 w-full max-w-md mx-auto max-h-[90dvh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4 sm:mb-6">
          <h3 className="text-lg sm:text-xl font-bold text-white">{title}</h3>
          <button onClick={() => setShowManual(false)} className="text-zinc-400 hover:text-white p-2 text-sm sm:text-base font-bold">
            KEMBALI
          </button>
        </div>

        <div className="bg-zinc-800 rounded-xl p-3 sm:p-4 mb-4 sm:mb-6 text-right">
          <span className={`text-2xl sm:text-3xl font-mono ${textColor} font-bold`}>
            Rp {value ? parseInt(value, 10).toLocaleString('id-ID') : '0'}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button
              key={num}
              onClick={() => handlePress(num.toString())}
              className="bg-zinc-800 hover:bg-zinc-700 text-white text-2xl sm:text-3xl font-bold py-4 sm:py-6 rounded-2xl active:scale-95 transition-transform"
            >
              {num}
            </button>
          ))}
          <button
            onClick={() => handlePress('000')}
            className="bg-zinc-800 hover:bg-zinc-700 text-white text-xl sm:text-2xl font-bold py-4 sm:py-6 rounded-2xl active:scale-95 transition-transform"
          >
            000
          </button>
          <button
            onClick={() => handlePress('0')}
            className="bg-zinc-800 hover:bg-zinc-700 text-white text-2xl sm:text-3xl font-bold py-4 sm:py-6 rounded-2xl active:scale-95 transition-transform"
          >
            0
          </button>
          <button
            onClick={handleDelete}
            className="bg-red-500/20 hover:bg-red-500/30 text-red-500 text-xl sm:text-2xl font-bold py-4 sm:py-6 rounded-2xl active:scale-95 transition-transform"
          >
            DEL
          </button>
        </div>

        <button
          onClick={handleConfirm}
          disabled={!value || parseInt(value, 10) <= 0}
          className={`w-full ${confirmBgColor} disabled:opacity-50 disabled:cursor-not-allowed text-lg sm:text-xl font-bold py-4 sm:py-5 rounded-2xl active:scale-95 transition-transform`}
        >
          KONFIRMASI
        </button>
      </div>
    </div>
  );
};
