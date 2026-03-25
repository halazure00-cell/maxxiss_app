import { getAllRadarLogs } from './db';
import { getCurrentLocation, getWeather } from './location';

// Helper to get area name from coordinates using OpenStreetMap Nominatim
async function getAreaName(lat: number, lon: number): Promise<string> {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=14`, {
      headers: {
        'Accept-Language': 'id'
      },
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      const data = await res.json();
      // Try to get the most relevant local area name
      return data.address?.suburb || data.address?.village || data.address?.town || data.address?.city_district || 'Area Sekitar';
    }
  } catch (error) {
    console.error("Geocoding error:", error);
  }
  return 'Area Sekitar';
}

// Haversine distance in km
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
  return R * c;
}

export async function getRuleBasedRecommendation(): Promise<string> {
  try {
    // 1. Get Current Environment (Module B)
    const loc = await getCurrentLocation();
    if (!loc) {
      return "Sistem lokal: Gagal melacak lokasi. Pastikan GPS aktif untuk rekomendasi akurat.";
    }

    const [weather, currentArea] = await Promise.all([
      getWeather(loc.lat, loc.lon),
      getAreaName(loc.lat, loc.lon)
    ]);

    // 2. Get Historical Data (Module A)
    const logs = await getAllRadarLogs();
    
    // 3. Rule-Based Evaluation
    const now = new Date();
    const currentHour = now.getHours();
    
    // Filter logs within +/- 3 hours of current time
    const relevantLogs = logs.filter(log => {
      if (!log.lat || !log.lon) return false;
      const logDate = new Date(log.timestamp);
      const logHour = logDate.getHours();
      let hourDiff = Math.abs(currentHour - logHour);
      if (hourDiff > 12) hourDiff = 24 - hourDiff; // Handle midnight wrap
      return hourDiff <= 3;
    });

    // If we don't have enough historical data, use generic rules based on weather and time
    if (relevantLogs.length < 3) {
      if (weather.includes('Hujan') || weather.includes('Gerimis')) {
        return `Cuaca ${weather} di ${currentArea}. Potensi orderan Food/Delivery tinggi, standby di pusat kuliner terdekat.`;
      }
      if (currentHour >= 6 && currentHour <= 9) {
        return `Pagi hari di ${currentArea}. Fokus ke area perumahan atau stasiun untuk orderan Bike (kantoran/sekolah).`;
      }
      if (currentHour >= 16 && currentHour <= 19) {
        return `Sore hari di ${currentArea}. Geser ke area perkantoran atau pusat kota untuk jam pulang kerja.`;
      }
      return `Cuaca ${weather} di ${currentArea}. Tetap standby, perhatikan pergerakan orderan di peta.`;
    }

    // Analyze hotspots from relevant logs
    const hotspots: { lat: number, lon: number, count: number, income: number, type: string }[] = [];
    
    relevantLogs.forEach(log => {
      // Find if this log is close to an existing hotspot (within 2km)
      const existing = hotspots.find(h => getDistance(h.lat, h.lon, log.lat!, log.lon!) < 2);
      if (existing) {
        existing.count += 1;
        existing.income += (log.net_fare || 0);
      } else {
        hotspots.push({
          lat: log.lat!,
          lon: log.lon!,
          count: 1,
          income: log.net_fare || 0,
          type: log.type
        });
      }
    });

    // Sort hotspots by income/count
    hotspots.sort((a, b) => b.income - a.income);
    const bestHotspot = hotspots[0];

    const distToHotspot = getDistance(loc.lat, loc.lon, bestHotspot.lat, bestHotspot.lon);

    // If we are already at the hotspot (within 2km)
    if (distToHotspot < 2) {
      return `Cuaca ${weather} di ${currentArea}. Anda sudah di area potensial. Fokus orderan ${bestHotspot.type.replace('_', ' ')}.`;
    }

    // If the hotspot is far, suggest moving
    const targetArea = await getAreaName(bestHotspot.lat, bestHotspot.lon);
    
    // Determine direction
    let direction = '';
    if (bestHotspot.lat > loc.lat) direction += 'utara ';
    else direction += 'selatan ';
    if (bestHotspot.lon > loc.lon) direction += 'timur';
    else direction += 'barat';

    return `Cuaca ${weather} di ${currentArea}. Tinggalkan ${currentArea}, geser ke ${direction.trim()} (${targetArea}) untuk potensi ${bestHotspot.type.replace('_', ' ')}.`;

  } catch (error) {
    console.error("Recommendation Engine Error:", error);
    return "Sistem lokal: Sedang mengkalkulasi data historis, silakan tunggu beberapa saat.";
  }
}
