import type { City } from "./cities";

type GeocodingResult = {
  country?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  name?: unknown;
  timezone?: unknown;
};

export function parseCityResults(value: unknown): City[] {
  if (!value || typeof value !== "object") return [];
  const results = (value as { results?: unknown }).results;
  if (!Array.isArray(results)) return [];

  return results.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const result = value as GeocodingResult;
    return typeof result.name === "string" &&
      typeof result.country === "string" &&
      typeof result.timezone === "string" &&
      typeof result.latitude === "number" && Number.isFinite(result.latitude) &&
      typeof result.longitude === "number" && Number.isFinite(result.longitude)
      ? [{
        country: result.country,
        ianaTimezone: result.timezone,
        latitude: result.latitude,
        locale: "en-US",
        longitude: result.longitude,
        name: result.name,
      }]
      : [];
  });
}

export async function searchCities(query: string) {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.search = new URLSearchParams({ count: "5", language: "en", name: query }).toString();
  const response = await fetch(url);
  if (!response.ok) throw new Error(`City search failed: ${response.status}`);
  return parseCityResults(await response.json());
}
