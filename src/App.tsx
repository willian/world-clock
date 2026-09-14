import { type PointerEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AnimatePresence, motion, Reorder, useDragControls, useReducedMotion } from "motion/react";
import { cityKey, defaultSavedCities, homeCity, type City } from "./cities";
import { searchCities } from "./geocoding";
import { localGreeting } from "./greeting";
import { Globe } from "./Globe";
import { TitleGlobe } from "./TitleGlobe";
import { daylight } from "./solar";
import { cityTime, formatDelta, timelineInstant } from "./time";
import { formatTemperature, weatherFor, type TemperatureUnit, type Weather } from "./weather";

function SortableCity({
  children,
  city,
  onHover,
  onSave,
}: {
  children: (controls: ReturnType<typeof useDragControls>) => ReactNode;
  city: City;
  onHover: () => void;
  onSave: () => void;
}) {
  const controls = useDragControls();

  return (
    <Reorder.Item
      as="article"
      className="city-card"
      dragControls={controls}
      dragListener={false}
      onDragEnd={onSave}
      onMouseEnter={onHover}
      onPointerDown={(event) => {
        if (event.target instanceof Element && event.target.closest("button, .timeline")) return;
        controls.start(event);
      }}
      value={city}
      whileDrag={{ opacity: 0.5, scale: 1.01 }}
    >
      {children(controls)}
    </Reorder.Item>
  );
}

function TimeButton({
  hour12,
  onClick,
  period,
  time,
}: {
  hour12: boolean;
  onClick: () => void;
  period: string | null;
  time: string;
}) {
  return (
    <button
      aria-label={`Show ${hour12 ? "24-hour" : "12-hour"} time`}
      className="time-toggle"
      onClick={onClick}
      title={`Show ${hour12 ? "24-hour" : "12-hour"} time`}
      type="button"
    >
      {time}{period && <span className="meridiem">{period}</span>}
    </button>
  );
}

export function App() {
  const [now, setNow] = useState(() => new Date());
  const [selected, setSelected] = useState<Date | null>(null);
  const [cities, setCities] = useState(defaultSavedCities);
  const [homeCityState, setHomeCityState] = useState(homeCity);
  const [picker, setPicker] = useState<"add" | "jump" | null>(null);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<City[]>([]);
  const [temperatureUnit, setTemperatureUnit] = useState<TemperatureUnit>("C");
  const [hour12, setHour12] = useState(true);
  const [timezoneMode, setTimezoneMode] = useState<"local" | "utc">("local");
  const [weather, setWeather] = useState<Record<string, Weather>>({});
  const [view, setView] = useState<"globe" | "list">("list");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showMenuBar, setShowMenuBar] = useState(true);
  const [renderedView, setRenderedView] = useState<"globe" | "list">("list");
  const [highlightedCity, setHighlightedCity] = useState<City | null>(null);
  const reducedMotion = useReducedMotion();
  const drag = useRef<{ current: number; instant: Date } | null>(null);
  const citiesRef = useRef(cities);
  const instant = selected ?? now;
  const home = cityTime(instant, homeCityState, homeCityState, hour12);

  useEffect(() => {
    let timer = 0;
    const update = () => {
      setNow(new Date());
      timer = window.setTimeout(update, 60_000 - (Date.now() % 60_000));
    };

    update();
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const height = Math.max(
      340,
      selected ? 372 : 340,
      picker ? 500 : 0,
      view === "globe" ? 500 : 172 + Math.min(cities.length, 5) * 112,
    );
    void invoke("resize_panel", { height });
  }, [cities.length, picker, selected, view]);

  useEffect(() => {
    void invoke<City[] | null>("load_cities").then((saved) => {
      if (saved) {
        citiesRef.current = saved;
        setCities(saved);
      }
    }).catch(() => {});
    void invoke<City | null>("load_home_city").then((saved) => {
      if (saved) {
        setHomeCityState(saved);
      } else {
        void invoke("save_home_city", { city: homeCity });
      }
    }).catch(() => {});
    void invoke<{ showMenuBar: boolean }>("load_settings").then((settings) => {
      setShowMenuBar(settings.showMenuBar);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || drag.current) return;
      event.preventDefault();
      if (picker) {
        setPicker(null);
        setSearch("");
      } else {
        void invoke("hide_panel");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [picker]);

  const selectTime = (event: PointerEvent<HTMLDivElement>, date: Date, current: number) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const target = Math.min(100, Math.max(0, ((event.clientX - bounds.left) / bounds.width) * 100));
    setSelected(timelineInstant(date, current, target));
  };

  useEffect(() => {
    let cancelled = false;
    const update = async () => {
      const readings = await Promise.all(
        [homeCityState, ...cities].map(async (city) => {
          try {
            return [cityKey(city), await weatherFor(city)] as const;
          } catch {
            return null;
          }
        }),
      );
      const available = readings.filter(
        (reading): reading is readonly [string, Weather] => reading !== null,
      );
      if (!cancelled) setWeather((current) => ({ ...current, ...Object.fromEntries(available) }));
    };

    update();
    const timer = window.setInterval(update, 15 * 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [cities, homeCityState]);

  useEffect(() => {
    const query = search.trim();
    if (!picker || query.length < 2) {
      setResults([]);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void searchCities(query).then((found) => {
        if (!cancelled) setResults(picker === "add"
          ? found.filter((city) => !cities.some((saved) => cityKey(saved) === cityKey(city)))
          : found);
      }).catch(() => {
        if (!cancelled) setResults([]);
      });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [cities, picker, search]);

  const persistCities = (next: City[]) => {
    citiesRef.current = next;
    setCities(next);
    void invoke("save_cities", { cities: next }).catch(() => {});
  };

  const reorderCities = (next: City[]) => {
    citiesRef.current = next;
    setCities(next);
  };

  const addCity = (city: City) => {
    if (cities.some((saved) => cityKey(saved) === cityKey(city))) return;
    persistCities([...cities, city]);
    setHighlightedCity(city);
    setPicker(null);
    setSearch("");
  };

  const jumpToCity = (city: City) => {
    setHighlightedCity(city);
    setPicker(null);
    setSearch("");
  };

  const toggleTemperatureUnit = () => {
    setTemperatureUnit((unit) => (unit === "C" ? "F" : "C"));
  };

  const toggleTimeFormat = () => {
    setHour12((current) => !current);
  };

  const toggleTimezoneMode = () => {
    setTimezoneMode((current) => (current === "local" ? "utc" : "local"));
  };

  const toggleView = () => {
    if (view === "list") {
      setHighlightedCity(homeCityState);
      setView("globe");
      setRenderedView("globe");
    } else {
      setRenderedView("list");
    }
  };

  return (
    <main className="panel">
      <button
        aria-controls="settings-popover"
        aria-expanded={settingsOpen}
        aria-label="Settings"
        className="settings-toggle"
        onClick={() => setSettingsOpen((open) => !open)}
        type="button"
      >⚙</button>
      <AnimatePresence>
        {settingsOpen && <motion.section
          animate={{ opacity: 1, scale: 1 }}
          aria-label="Settings"
          className="settings-menu"
          exit={{ opacity: 0, scale: 0.96 }}
          id="settings-popover"
          initial={{ opacity: 0, scale: 0.96 }}
          role="dialog"
          transition={reducedMotion ? { duration: 0 } : { duration: 0.12 }}
        >
          <label>
            <span>Show menu bar icon</span>
            <input
              checked={showMenuBar}
              onChange={(event) => {
                const visible = event.target.checked;
                setShowMenuBar(visible);
                void invoke("set_menu_bar_visible", { visible }).catch(() => setShowMenuBar(!visible));
              }}
              type="checkbox"
            />
          </label>
        </motion.section>}
      </AnimatePresence>
      <header>
        <p className="home-time">
          It's <TimeButton hour12={hour12} onClick={toggleTimeFormat} period={home.period} time={home.time} /> here in {homeCityState.name}{selected && `  ${formatDelta(selected.getTime() - now.getTime())}`}
          {weather[cityKey(homeCityState)] && <>
            {" - "}<button
              aria-label={`Switch to degrees ${temperatureUnit === "C" ? "Fahrenheit" : "Celsius"}`}
              className="weather"
              onClick={toggleTemperatureUnit}
              title={weather[cityKey(homeCityState)].condition}
              type="button"
            >
              {formatTemperature(weather[cityKey(homeCityState)].temperature, temperatureUnit)} {weather[cityKey(homeCityState)].icon}
            </button>
          </>}
        </p>
        <div className="title">
          <h1>
            World <button
              aria-label={view === "list" ? "Show globe" : "Close globe"}
              className={`globe-toggle${view === "globe" ? " close-globe" : ""}`}
              onClick={toggleView}
              title={view === "list" ? "Show globe" : "Close globe"}
              type="button"
            >{view === "list" ? <TitleGlobe city={homeCityState} /> : "×"}</button> Clock
          </h1>
          {selected && <button className="now" onClick={() => setSelected(null)} type="button">Now</button>}
        </div>
      </header>

      <AnimatePresence
        initial={false}
        mode="wait"
        onExitComplete={() => {
          if (renderedView === "list" && view === "globe") setView("list");
        }}
      >
      {renderedView === "globe" ? (
        <motion.div
          animate={{ opacity: 1, scale: 1 }}
          className="view-transition"
          exit={{ opacity: 0, scale: 0.96 }}
          initial={reducedMotion ? false : { opacity: 0, scale: 0.96 }}
          key="globe"
          transition={reducedMotion ? { duration: 0 } : { duration: 0.18, ease: "easeOut" }}
        >
          <Globe
            cities={cities}
            home={homeCityState}
            onSelect={setHighlightedCity}
            selected={highlightedCity ?? homeCityState}
          />
        </motion.div>
      ) : <motion.div
        animate={{ opacity: 1, scale: 1 }}
        className="view-transition"
        exit={{ opacity: 0, scale: 0.96 }}
        initial={reducedMotion ? false : { opacity: 0, scale: 0.96 }}
        key="cities"
        transition={reducedMotion ? { duration: 0 } : { duration: 0.18, ease: "easeOut" }}
      ><Reorder.Group
        as="section"
        axis="y"
        className="cities"
        layoutScroll
        onReorder={reorderCities}
        values={cities}
      >
        {cities.map((city) => {
          const local = cityTime(instant, city, homeCityState, hour12);
          const solar = daylight(instant, city);
          const cityWeather = weather[cityKey(city)];
          const markerClass = (position: number) =>
            `sun-marker${Math.abs(solar.current - position) < 2 ? " is-current" : ""}`;
          return (
            <SortableCity
              city={city}
              key={cityKey(city)}
              onHover={() => setHighlightedCity(city)}
              onSave={() => void invoke("save_cities", { cities: citiesRef.current }).catch(() => {})}
            >
              {(controls) => <>
              <div className="city-summary">
                <div>
                  <div className="city-title">
                    <h2>{city.name}</h2>
                    {cityWeather && (
                      <button
                        aria-label={`Switch to degrees ${temperatureUnit === "C" ? "Fahrenheit" : "Celsius"}`}
                        className="weather"
                        onClick={toggleTemperatureUnit}
                        title={cityWeather.condition}
                        type="button"
                      >
                        {formatTemperature(cityWeather.temperature, temperatureUnit)} {cityWeather.icon}
                      </button>
                    )}
                    <button
                      aria-label={`Remove ${city.name}`}
                      className="remove-city"
                      onClick={() => persistCities(cities.filter((saved) => cityKey(saved) !== cityKey(city)))}
                      type="button"
                    >
                      ×
                    </button>
                  </div>
                  <p className="city-date">{local.date}{local.tomorrow && " · Tomorrow"}</p>
                  <p className="city-greeting">{localGreeting(instant, city)}</p>
                </div>
                <div className="city-time">
                  <TimeButton hour12={hour12} onClick={toggleTimeFormat} period={local.period} time={local.time} />
                  <button
                    aria-label={`Show ${timezoneMode === "local" ? "UTC" : "local"} offset`}
                    className="timezone-toggle"
                    onClick={toggleTimezoneMode}
                    title={`Show ${timezoneMode === "local" ? "UTC" : "local"} offset`}
                    type="button"
                  >
                    {local.zone}{timezoneMode === "local" ? ` ${local.offset}` : ` - ${local.utcOffset}`}
                  </button>
                </div>
              </div>
              <div
                  className="timeline"
                  onPointerDown={(event) => {
                    if (event.target instanceof Element && event.target.closest("button")) return;
                    event.currentTarget.setPointerCapture(event.pointerId);
                    drag.current = { current: solar.current, instant };
                    selectTime(event, instant, solar.current);
                  }}
                  onPointerMove={(event) => {
                    if (event.currentTarget.hasPointerCapture(event.pointerId) && drag.current) {
                      selectTime(event, drag.current.instant, drag.current.current);
                    }
                  }}
                  onPointerUp={(event) => {
                    drag.current = null;
                    event.currentTarget.releasePointerCapture(event.pointerId);
                  }}
                  onPointerCancel={() => {
                    drag.current = null;
                  }}
                >
                  {solar.sunrise && solar.sunset && <>
                    <span
                      className="daylight"
                      style={{
                        left: `${solar.sunrise.position}%`,
                        width: `${solar.sunset.position - solar.sunrise.position}%`,
                      }}
                    />
                    <button
                      aria-label={`Sunrise ${solar.sunrise.time}`}
                      className={markerClass(solar.sunrise.position)}
                      style={{ left: `${solar.sunrise.position}%` }}
                      type="button"
                    >
                      <span className="tooltip">Sunrise {solar.sunrise.time}</span>
                    </button>
                    <button
                      aria-label={`Sunset ${solar.sunset.time}`}
                      className={markerClass(solar.sunset.position)}
                      style={{ left: `${solar.sunset.position}%` }}
                      type="button"
                    >
                      <span className="tooltip">Sunset {solar.sunset.time}</span>
                    </button>
                  </>}
                  <span
                    className={`current-marker ${solar.isDay === null ? "is-neutral" : solar.isDay ? "is-day" : "is-night"}`}
                    style={{ left: `${solar.current}%` }}
                  />
              </div>
              </>}
            </SortableCity>
          );
        })}
      </Reorder.Group></motion.div>
      }
      </AnimatePresence>

      <footer className="city-footer">
        {picker ? (
          <section className="city-picker">
            <input
              autoFocus
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search cities..."
              value={search}
            />
            <button className="cancel" onClick={() => { setPicker(null); setSearch(""); }} type="button">
              Cancel
            </button>
            {search.trim().length >= 2 && (
              <div className="results">
                {results.map((city) => (
                  <button
                    className="search-result"
                    key={cityKey(city)}
                    onClick={() => picker === "add" ? addCity(city) : jumpToCity(city)}
                    type="button"
                  >
                    <strong>{city.name}</strong>
                    <span>{city.country} · {city.ianaTimezone} · {cityTime(instant, city, homeCityState, hour12).utcOffset}</span>
                  </button>
                ))}
                {!results.length && <p>No matching city</p>}
              </div>
            )}
          </section>
        ) : (
          <button
            className="add-city"
            onClick={() => setPicker(view === "globe" ? "jump" : "add")}
            type="button"
          >{view === "globe" ? "Jump to a city" : "+ Add city"}</button>
        )}
      </footer>
    </main>
  );
}
