import assert from "node:assert/strict";
import test from "node:test";
import { defaultSavedCities, homeCity } from "../src/cities.ts";
import { parseCityResults } from "../src/geocoding.ts";
import { localGreeting } from "../src/greeting.ts";
import { focusRotation, project } from "../src/projection.ts";
import { daylight } from "../src/solar.ts";
import { cityTime, formatDelta, timelineInstant } from "../src/time.ts";
import { formatTemperature, parseWeather } from "../src/weather.ts";

test("uses the same DST-aware instant for every city", () => {
  const instant = new Date("2026-09-11T21:25:00Z");
  const chicago = cityTime(instant, defaultSavedCities[0], homeCity);
  const tokyo = cityTime(instant, defaultSavedCities[1], homeCity);

  assert.deepEqual(chicago, {
    date: "Fri Sep 11",
    offset: "-2h",
    period: "PM",
    time: "4:25",
    tomorrow: false,
    utcOffset: "UTC-5",
    zone: "CDT",
  });
  assert.equal(tokyo.offset, "+12h");
  assert.equal(tokyo.tomorrow, true);
  assert.equal(tokyo.zone, "GMT+9");
  const chicago24 = cityTime(instant, defaultSavedCities[0], homeCity, false);
  assert.equal(chicago24.period, null);
  assert.equal(chicago24.time, "16:25");
});

test("places Tokyo daylight events within Tokyo's local day", () => {
  const solar = daylight(new Date("2026-09-11T21:25:00Z"), defaultSavedCities[1]);

  assert.ok(solar);
  assert.ok(solar.sunrise.position < solar.sunset.position);
  assert.ok(solar.current > 0 && solar.current < 100);
  assert.equal(solar.isDay, true);
});

test("keeps a neutral timeline when a polar city has no sunrise or sunset", () => {
  const solar = daylight(new Date("2026-06-21T12:00:00Z"), {
    country: "Norway",
    ianaTimezone: "Arctic/Longyearbyen",
    latitude: 78.2232,
    locale: "en-US",
    longitude: 15.6469,
    name: "Longyearbyen",
  });

  assert.equal(solar.isDay, null);
  assert.equal(solar.sunrise, undefined);
  assert.equal(solar.sunset, undefined);
});

test("parses weather responses without trusting malformed data", () => {
  assert.deepEqual(parseWeather({ current: { is_day: 1, temperature_2m: 24.6, weather_code: 0 } }), {
    condition: "Clear",
    icon: "☀",
    temperature: 25,
  });
  assert.equal(parseWeather({ current: { temperature_2m: "24" } }), null);
  assert.equal(formatTemperature(25, "C"), "25°C");
  assert.equal(formatTemperature(25, "F"), "77°F");
});

test("formats timeline deltas and keeps one selected instant", () => {
  const instant = new Date("2026-09-11T12:00:00Z");

  assert.equal(formatDelta(104 * 60_000), "+1h 44m");
  assert.equal(formatDelta(-44 * 60_000), "-44m");
  assert.equal(timelineInstant(instant, 50, 75).toISOString(), "2026-09-11T18:00:00.000Z");
});

test("parses valid worldwide city results", () => {
  assert.deepEqual(parseCityResults({ results: [{
    country: "Brazil",
    latitude: -23.5505,
    longitude: -46.6333,
    name: "São Paulo",
    timezone: "America/Sao_Paulo",
  }] }), [{
    country: "Brazil",
    ianaTimezone: "America/Sao_Paulo",
    latitude: -23.5505,
    locale: "en-US",
    longitude: -46.6333,
    name: "São Paulo",
  }]);
  assert.deepEqual(parseCityResults({ results: [null, { name: "São Paulo" }] }), []);
});

test("uses each city's local time and language for hover greetings", () => {
  const instant = new Date("2026-09-13T12:00:00Z");

  assert.equal(localGreeting(instant, homeCity), "Bom dia");
  assert.equal(localGreeting(instant, defaultSavedCities[0]), "Good morning");
  assert.equal(localGreeting(instant, defaultSavedCities[1]), "こんばんは");
});

test("centers a selected city on the globe", () => {
  const point = project(
    defaultSavedCities[1].latitude,
    defaultSavedCities[1].longitude,
    focusRotation(defaultSavedCities[1]),
  );

  assert.ok(Math.abs(point.x) < 0.0001);
  assert.ok(Math.abs(point.y) < 0.0001);
  assert.ok(Math.abs(point.z - 1) < 0.0001);
});
