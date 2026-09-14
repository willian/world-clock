import { cityKey, type City } from "./cities.ts";

export type Weather = {
  condition: string;
  icon: string;
  temperature: number;
};

export type TemperatureUnit = "C" | "F";

const CACHE_MS = 15 * 60_000;
const cache = new Map<string, { expires: number; value: Promise<Weather> }>();

const condition = (code: number, isDay: boolean) => {
  if (code === 0) return isDay ? ["Clear", "☀"] : ["Clear", "☾"];
  if ([1, 2].includes(code)) return ["Partly cloudy", isDay ? "⛅" : "☁"];
  if (code === 3) return ["Overcast", "☁"];
  if ([45, 48].includes(code)) return ["Fog", "≋"];
  if ([51, 53, 55, 56, 57].includes(code)) return ["Drizzle", "☂"];
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return ["Rain", "☔"];
  if ([71, 73, 75, 77, 85, 86].includes(code)) return ["Snow", "❄"];
  if ([95, 96, 99].includes(code)) return ["Thunderstorm", "ϟ"];
  return ["Unknown", "?"];
};

export function parseWeather(value: unknown): Weather | null {
  if (!value || typeof value !== "object") return null;
  const current = (value as { current?: Record<string, unknown> }).current;
  if (
    !current ||
    typeof current.temperature_2m !== "number" ||
    typeof current.weather_code !== "number" ||
    !Number.isFinite(current.temperature_2m) ||
    !Number.isFinite(current.weather_code)
  ) {
    return null;
  }

  const [label, icon] = condition(current.weather_code, current.is_day === 1);
  return {
    condition: label,
    icon,
    temperature: Math.round(current.temperature_2m),
  };
}

export function formatTemperature(temperature: number, unit: TemperatureUnit) {
  return `${unit === "F" ? Math.round((temperature * 9) / 5 + 32) : temperature}°${unit}`;
}

export function weatherFor(city: City) {
  const key = cityKey(city);
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    current: "temperature_2m,weather_code,is_day",
    latitude: String(city.latitude),
    longitude: String(city.longitude),
    temperature_unit: "celsius",
  }).toString();

  const value = fetch(url)
    .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
    .then((response) => {
      const weather = parseWeather(response);
      if (!weather) throw new Error("Invalid weather response");
      return weather;
    });
  cache.set(key, { expires: Date.now() + CACHE_MS, value });
  value.catch(() => cache.delete(key));
  return value;
}
