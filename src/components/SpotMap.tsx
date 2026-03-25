import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const SPOT_GACOR = [
  { name: 'Stasiun Bandung', lat: -6.9143, lon: 107.6022, type: 'ride', desc: 'Ramai penumpang kereta datang/pergi.' },
  { name: 'Dipatiukur (Unpad)', lat: -6.8906, lon: 107.6163, type: 'food', desc: 'Banyak orderan makanan mahasiswa.' },
  { name: 'Braga / Asia Afrika', lat: -6.9175, lon: 107.6090, type: 'ride', desc: 'Pusat wisata dan perkantoran.' },
  { name: 'Pasteur (Tol Gate)', lat: -6.8938, lon: 107.5857, type: 'ride', desc: 'Titik jemput travel dan bus.' },
  { name: 'Lengkong Kecil', lat: -6.9234, lon: 107.6133, type: 'food', desc: 'Pusat kuliner malam hari.' },
  { name: 'Cihampelas Walk', lat: -6.8955, lon: 107.6045, type: 'ride', desc: 'Pusat belanja dan wisata.' }
];

export default function SpotMap() {
  const bandungCenter: [number, number] = [-6.9175, 107.6191];

  return (
    <div className="h-64 w-full rounded-2xl overflow-hidden shadow-md border border-[#4A5D5A]/10 relative z-0">
      <MapContainer center={bandungCenter} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {SPOT_GACOR.map((spot, idx) => (
          <Circle 
            key={idx}
            center={[spot.lat, spot.lon]} 
            radius={400}
            pathOptions={{ 
              color: spot.type === 'food' ? '#F8CB1D' : '#4A5D5A', 
              fillColor: spot.type === 'food' ? '#F8CB1D' : '#4A5D5A', 
              fillOpacity: 0.4 
            }}
          >
            <Popup>
              <div className="font-bold text-[#4A5D5A]">{spot.name}</div>
              <div className="text-xs text-gray-600">{spot.desc}</div>
              <div className="text-[10px] uppercase font-bold mt-1 text-[#F8CB1D] bg-[#4A5D5A] inline-block px-1 rounded">
                Dominan: {spot.type === 'food' ? 'Food/Delivery' : 'Ride/Penumpang'}
              </div>
            </Popup>
          </Circle>
        ))}
      </MapContainer>
    </div>
  );
}
