export async function getCurrentLocation(): Promise<{lat: number, lon: number} | null> {
  if (!navigator.geolocation) {
    console.warn("Geolocation is not supported by this browser.");
    return null;
  }

  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true, // Use GPS for better accuracy
        timeout: 10000,           // 10 seconds timeout
        maximumAge: 60000         // 1 minute cache
      });
    });
    return {
      lat: position.coords.latitude,
      lon: position.coords.longitude
    };
  } catch (error) {
    let errorMessage = "Unknown error";
    if (error instanceof GeolocationPositionError) {
      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorMessage = "Permission denied";
          break;
        case error.POSITION_UNAVAILABLE:
          errorMessage = "Position unavailable";
          break;
        case error.TIMEOUT:
          errorMessage = "Timeout";
          break;
      }
    }
    console.error("Error getting location:", errorMessage, error);
    return null;
  }
}

export const getWeatherDescription = (code: number): string => {
  if (code === 0) return 'Cerah';
  if (code >= 1 && code <= 3) return 'Berawan';
  if (code === 45 || code === 48) return 'Kabut';
  if (code >= 51 && code <= 67) return 'Hujan/Gerimis';
  if (code >= 80 && code <= 82) return 'Hujan Lebat';
  if (code >= 95) return 'Badai';
  return 'Tidak Diketahui';
};

export async function getWeather(lat: number, lon: number): Promise<string> {
  try {
    const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`, {
      signal: AbortSignal.timeout(5000)
    });
    if (weatherRes.ok) {
      const weatherData = await weatherRes.json();
      return getWeatherDescription(weatherData.current_weather.weathercode);
    }
  } catch (err) {
    console.error("Error fetching weather:", err);
  }
  return 'Tidak Diketahui';
}
