import type { City } from "./cities";

type TimeOfDay = "morning" | "afternoon" | "evening" | "night";

const countryLanguages: Record<string, string> = {
  Brazil: "pt",
  Denmark: "da",
  France: "fr",
  Germany: "de",
  Italy: "it",
  Japan: "ja",
  Portugal: "pt",
  Spain: "es",
};

const greetings: Record<string, Record<TimeOfDay, string>> = {
  da: { afternoon: "God eftermiddag", evening: "Godaften", morning: "Godmorgen", night: "Godnat" },
  de: { afternoon: "Guten Tag", evening: "Guten Abend", morning: "Guten Morgen", night: "Gute Nacht" },
  en: { afternoon: "Good afternoon", evening: "Good evening", morning: "Good morning", night: "Good night" },
  es: { afternoon: "Buenas tardes", evening: "Buenas noches", morning: "Buenos días", night: "Buenas noches" },
  fr: { afternoon: "Bon après-midi", evening: "Bonsoir", morning: "Bonjour", night: "Bonne nuit" },
  it: { afternoon: "Buon pomeriggio", evening: "Buonasera", morning: "Buongiorno", night: "Buonanotte" },
  ja: { afternoon: "こんにちは", evening: "こんばんは", morning: "おはようございます", night: "おやすみなさい" },
  pt: { afternoon: "Boa tarde", evening: "Boa noite", morning: "Bom dia", night: "Boa noite" },
};

export function localGreeting(date: Date, city: City) {
  const hour = Number(new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hourCycle: "h23",
    timeZone: city.ianaTimezone,
  }).format(date));
  const timeOfDay: TimeOfDay = hour < 5 ? "night" : hour < 12 ? "morning" : hour < 17 ? "afternoon" : hour < 22 ? "evening" : "night";
  const language = countryLanguages[city.country] ?? city.locale.split("-")[0];
  return (greetings[language] ?? greetings.en)[timeOfDay];
}
