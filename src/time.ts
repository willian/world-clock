import type { City } from "./cities";

export type CityTime = {
  date: string;
  offset: string;
  period: string | null;
  time: string;
  tomorrow: boolean;
  utcOffset: string;
  zone: string;
};

const parts = (date: Date, timeZone: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", { ...options, timeZone }).formatToParts(date);

const value = (date: Date, timeZone: string, type: Intl.DateTimeFormatPartTypes) =>
  parts(date, timeZone, {
    day: "numeric",
    month: "short",
    timeZoneName: "short",
    weekday: "short",
    year: "numeric",
  }).find((part) => part.type === type)?.value;

const offsetMinutes = (date: Date, timeZone: string) => {
  const offset = parts(date, timeZone, { timeZoneName: "longOffset" }).find(
    (part) => part.type === "timeZoneName",
  )?.value ?? "GMT";
  const match = offset.match(/^GMT([+-])(\d{2}):(\d{2})$/);
  if (!match) return 0;

  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === "+" ? minutes : -minutes;
};

const day = (date: Date, timeZone: string) => {
  const dateParts = parts(date, timeZone, {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
  const number = (type: Intl.DateTimeFormatPartTypes) =>
    Number(dateParts.find((part) => part.type === type)?.value);

  return Date.UTC(number("year"), number("month") - 1, number("day"));
};

const relativeOffset = (difference: number) => {
  if (difference === 0) return "same time";

  const hours = Math.floor(Math.abs(difference) / 60);
  const minutes = Math.abs(difference) % 60;
  return `${difference > 0 ? "+" : "-"}${hours}h${minutes ? ` ${minutes}m` : ""}`;
};

const utcOffset = (minutes: number) => {
  if (minutes === 0) return "UTC";

  const absolute = Math.abs(minutes);
  const hours = Math.floor(absolute / 60);
  const remainder = absolute % 60;
  return `UTC${minutes > 0 ? "+" : "-"}${hours}${remainder ? `:${String(remainder).padStart(2, "0")}` : ""}`;
};

export function formatDelta(milliseconds: number) {
  const minutes = Math.round(Math.abs(milliseconds) / 60_000);
  const hours = Math.floor(minutes / 60);
  return `${milliseconds >= 0 ? "+" : "-"}${hours ? `${hours}h ` : ""}${minutes % 60}m`;
}

export function timelineInstant(date: Date, current: number, target: number) {
  return new Date(date.getTime() + ((target - current) / 100) * 86_400_000);
}

export function cityTime(date: Date, city: City, home: City, hour12 = true): CityTime {
  const dateParts = parts(date, city.ianaTimezone, {
    day: "numeric",
    month: "short",
    weekday: "short",
  });

  const timeParts = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12,
    minute: "2-digit",
    timeZone: city.ianaTimezone,
  }).formatToParts(date);
  const cityOffset = offsetMinutes(date, city.ianaTimezone);

  return {
    date: ["weekday", "month", "day"]
      .map((type) => dateParts.find((part) => part.type === type)?.value)
      .join(" "),
    offset: relativeOffset(cityOffset - offsetMinutes(date, home.ianaTimezone)),
    period: timeParts.find((part) => part.type === "dayPeriod")?.value ?? null,
    time: timeParts.filter((part) => ["hour", "literal", "minute"].includes(part.type))
      .map((part) => part.value).join("").trim(),
    tomorrow: day(date, city.ianaTimezone) - day(date, home.ianaTimezone) === 86_400_000,
    utcOffset: utcOffset(cityOffset),
    zone: value(date, city.ianaTimezone, "timeZoneName") ?? city.ianaTimezone,
  };
}
