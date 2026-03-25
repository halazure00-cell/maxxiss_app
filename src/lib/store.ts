import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserSettings {
  commissionRate: number;
  virtualBalance: number;
  vehicleType: 'motor' | 'mobil';
  dailyTarget: number;
  setCommissionRate: (rate: number) => void;
  setVirtualBalance: (balance: number) => void;
  setVehicleType: (type: 'motor' | 'mobil') => void;
  setDailyTarget: (target: number) => void;
  addVirtualBalance: (amount: number) => void;
  deductVirtualBalance: (amount: number) => void;
}

export const useStore = create<UserSettings>()(
  persist(
    (set) => ({
      commissionRate: 15, // Default Maxim commission is around 10-15%
      virtualBalance: 0,
      vehicleType: 'motor',
      dailyTarget: 150000, // Default target 150k
      setCommissionRate: (rate) => set({ commissionRate: rate }),
      setVirtualBalance: (balance) => set({ virtualBalance: balance }),
      setVehicleType: (type) => set({ vehicleType: type }),
      setDailyTarget: (target) => set({ dailyTarget: target }),
      addVirtualBalance: (amount) => set((state) => ({ virtualBalance: state.virtualBalance + amount })),
      deductVirtualBalance: (amount) => set((state) => ({ virtualBalance: state.virtualBalance - amount })),
    }),
    {
      name: 'maxxiss-storage',
    }
  )
);
