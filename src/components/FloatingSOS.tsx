import React, { useState, useRef, useEffect } from 'react';
import { ShieldAlert, Settings, AlertTriangle, X, Loader2 } from 'lucide-react';
import { getCurrentLocation } from '../lib/location';

export default function FloatingSOS() {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isMounted, setIsMounted] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showModal, setShowModal] = useState(false);
  
  const [waNumber, setWaNumber] = useState('');
  const [inputNumber, setInputNumber] = useState('');
  const [isLocating, setIsLocating] = useState(false);

  const dragRef = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0, isDragging: false });

  useEffect(() => {
    // Initial position: Right side, middle-bottom
    setPos({ x: window.innerWidth - 72, y: window.innerHeight - 200 });
    const savedNumber = localStorage.getItem('maxxiss_sos_number');
    if (savedNumber) {
      setWaNumber(savedNumber);
      setInputNumber(savedNumber);
    }
    setIsMounted(true);
  }, []);

  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    dragRef.current.startX = clientX;
    dragRef.current.startY = clientY;
    dragRef.current.initialX = pos.x;
    dragRef.current.initialY = pos.y;
    dragRef.current.isDragging = false;
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const dx = clientX - dragRef.current.startX;
    const dy = clientY - dragRef.current.startY;
    
    // Threshold to distinguish click from drag
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      dragRef.current.isDragging = true;
      setIsDragging(true);
      
      // Clamp to screen boundaries
      const newX = Math.max(0, Math.min(window.innerWidth - 64, dragRef.current.initialX + dx));
      const newY = Math.max(0, Math.min(window.innerHeight - 64, dragRef.current.initialY + dy));
      
      setPos({ x: newX, y: newY });
    }
  };

  const handleTouchEnd = () => {
    if (!dragRef.current.isDragging) {
      setShowModal(true);
    }
    setTimeout(() => setIsDragging(false), 100);
  };

  const saveNumber = () => {
    let formatted = inputNumber.replace(/\D/g, '');
    // Convert 08... to 628...
    if (formatted.startsWith('0')) {
      formatted = '62' + formatted.substring(1);
    }
    localStorage.setItem('maxxiss_sos_number', formatted);
    setWaNumber(formatted);
  };

  const triggerSOS = async () => {
    setIsLocating(true);
    const loc = await getCurrentLocation();
    setIsLocating(false);
    
    let text = `🚨 *DARURAT!* 🚨\nSaya driver Maxim butuh bantuan segera!`;
    if (loc) {
      text += `\n\nLokasi saya saat ini:\nhttps://maps.google.com/?q=${loc.lat},${loc.lon}`;
    } else {
      text += `\n\n(Lokasi gagal dilacak, tolong hubungi saya!)`;
    }
    
    const url = `https://wa.me/${waNumber}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
    setShowModal(false);
  };

  if (!isMounted) return null;

  return (
    <>
      {/* Draggable Floating Button */}
      <div
        className={`fixed z-[100] w-14 h-14 bg-red-600 rounded-full shadow-[0_4px_20px_rgba(220,38,38,0.6)] flex items-center justify-center border-2 border-white/20 text-white cursor-pointer ${isDragging ? 'opacity-80 scale-95' : 'opacity-100 scale-100'} transition-opacity`}
        style={{ left: pos.x, top: pos.y, touchAction: 'none' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleTouchStart}
        onMouseMove={isDragging || dragRef.current.startX ? handleTouchMove : undefined}
        onMouseUp={handleTouchEnd}
        onMouseLeave={() => {
          if (dragRef.current.startX) handleTouchEnd();
        }}
      >
        <ShieldAlert size={28} className={isDragging ? '' : 'animate-pulse'} />
      </div>

      {/* SOS Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/90 z-[110] flex flex-col justify-center p-4">
          <div className="bg-zinc-900 rounded-3xl p-6 w-full max-w-sm mx-auto border border-zinc-800 relative shadow-2xl">
            <button 
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white p-2 active:scale-90 transition-transform"
            >
              <X size={24} />
            </button>

            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center text-red-500">
                <AlertTriangle size={24} />
              </div>
              <h2 className="text-xl font-black text-white uppercase tracking-wide">Mode Darurat</h2>
            </div>

            {!waNumber ? (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <p className="text-sm text-zinc-400">Masukkan nomor WhatsApp kerabat/keluarga yang bisa dihubungi saat darurat.</p>
                <input 
                  type="tel"
                  value={inputNumber}
                  onChange={(e) => setInputNumber(e.target.value)}
                  placeholder="Contoh: 08123456789"
                  className="w-full bg-zinc-800 text-white px-4 py-4 rounded-xl text-lg font-bold border border-zinc-700 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                />
                <button 
                  onClick={saveNumber}
                  disabled={inputNumber.length < 10}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold py-4 rounded-xl text-lg active:scale-95 transition-transform"
                >
                  SIMPAN NOMOR
                </button>
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
                  <p className="text-red-400 text-sm font-bold mb-1">KIRIM PESAN SOS KE:</p>
                  <p className="text-white font-mono text-xl">{waNumber}</p>
                </div>

                <button 
                  onClick={triggerSOS}
                  disabled={isLocating}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-6 rounded-2xl text-xl active:scale-95 transition-transform shadow-[0_0_30px_rgba(220,38,38,0.3)] flex flex-col items-center justify-center space-y-2"
                >
                  {isLocating ? (
                    <>
                      <Loader2 size={32} className="animate-spin" />
                      <span className="text-sm uppercase tracking-widest">Melacak Lokasi...</span>
                    </>
                  ) : (
                    <>
                      <ShieldAlert size={36} />
                      <span>KIRIM SOS SEKARANG</span>
                    </>
                  )}
                </button>

                <button 
                  onClick={() => setWaNumber('')}
                  className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold py-4 rounded-xl text-sm active:scale-95 transition-transform flex items-center justify-center space-x-2"
                >
                  <Settings size={18} />
                  <span>Ganti Nomor Darurat</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
