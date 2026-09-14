export type City = {
  country: string;
  ianaTimezone: string;
  latitude: number;
  locale: string;
  longitude: number;
  name: string;
};

export const homeCity: City = {
  country: "Brazil",
  ianaTimezone: "America/Sao_Paulo",
  latitude: -23.2237,
  locale: "pt-BR",
  longitude: -45.9009,
  name: "São José dos Campos",
};

export const defaultSavedCities: City[] = [
  {
    country: "United States",
    ianaTimezone: "America/Chicago",
    latitude: 41.8781,
    locale: "en-US",
    longitude: -87.6298,
    name: "Chicago",
  },
  {
    country: "Japan",
    ianaTimezone: "Asia/Tokyo",
    latitude: 35.6762,
    locale: "ja-JP",
    longitude: 139.6503,
    name: "Tokyo",
  },
];

export const cityKey = (city: City) => `${city.latitude},${city.longitude}`;
