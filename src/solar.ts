import * as SunCalc from "suncalc";
import type { City } from "./cities";

type SolarEvent = {
  position: number;
  time: string;
};

export type Daylight = {
  current: number;
  isDay: boolean | null;
  sunrise?: SolarEvent;
  sunset?: SolarEvent;
};

const localParts = (date: Date, timeZone: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", { ...options, timeZone }).formatToParts(date);

const minuteOfDay = (date: Date, timeZone: string) => {
  const parts = localParts(date, timeZone, {
    hour: "numeric",
    hourCycle: "h23",
    minute: "numeric",
  });
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);

  return value("hour") * 60 + value("minute");
};

const localDay = (date: Date, timeZone: string) => {
  const parts = localParts(date, timeZone, {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);

  return new Date(Date.UTC(value("year"), value("month") - 1, value("day"), 12));
};

const time = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: true,
    minute: "2-digit",
    timeZone,
  }).format(date);

export function daylight(date: Date, city: City): Daylight {
  const times = SunCalc.getTimes(localDay(date, city.ianaTimezone), city.latitude, city.longitude);
  const current = minuteOfDay(date, city.ianaTimezone);
  const neutral = { current: (current / 1_440) * 100, isDay: null };
  const { sunrise: sunriseTime, sunset: sunsetTime } = times;
  if (!sunriseTime || !sunsetTime || !Number.isFinite(sunriseTime.getTime()) || !Number.isFinite(sunsetTime.getTime())) return neutral;

  const sunrise = minuteOfDay(sunriseTime, city.ianaTimezone);
  const sunset = minuteOfDay(sunsetTime, city.ianaTimezone);

  return {
    current: (current / 1_440) * 100,
    isDay: current >= sunrise && current <= sunset,
    sunrise: {
      position: (sunrise / 1_440) * 100,
      time: time(sunriseTime, city.ianaTimezone),
    },
    sunset: {
      position: (sunset / 1_440) * 100,
      time: time(sunsetTime, city.ianaTimezone),
    },
  };
}
