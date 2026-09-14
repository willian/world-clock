import { type PointerEvent, useEffect, useRef, useState } from "react";
import { geoGraticule, geoOrthographic, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import atlas from "world-atlas/land-110m.json";
import { cityKey, type City } from "./cities";
import { focusRotation, project, type Rotation } from "./projection";

type GlobeProps = {
  cities: City[];
  home: City;
  selected: City | null;
  onSelect: (city: City) => void;
};

type Drag = { pitch: number; startX: number; startY: number; yaw: number };

const land = feature(atlas as never, atlas.objects.land as never);
const graticule = geoGraticule().step([30, 30])();
const degrees = (radians: number) => (radians * 180) / Math.PI;

const projectionFor = (rotation: Rotation, radius: number, x: number, y: number) =>
  geoOrthographic()
    .clipAngle(90)
    .precision(0.5)
    .rotate([degrees(rotation.yaw), -degrees(rotation.pitch)])
    .scale(radius)
    .translate([x, y]);

export function Globe({ cities, home, selected, onSelect }: GlobeProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<Drag | null>(null);
  const [rotation, setRotation] = useState<Rotation>(() => focusRotation(selected ?? home));
  const globeCities = [...cities, home];
  if (selected && !globeCities.some((city) => cityKey(city) === cityKey(selected))) {
    globeCities.push(selected);
  }

  useEffect(() => {
    setRotation(focusRotation(selected ?? home));
  }, [selected, home]);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const draw = () => {
      const bounds = element.getBoundingClientRect();
      const scale = window.devicePixelRatio;
      element.width = Math.round(bounds.width * scale);
      element.height = Math.round(bounds.height * scale);
      const context = element.getContext("2d");
      if (!context) return;
      context.scale(scale, scale);

      const radius = Math.min(bounds.width, bounds.height) / 2 - 12;
      const x = bounds.width / 2;
      const y = bounds.height / 2;
      const projection = projectionFor(rotation, radius, x, y);
      const path = geoPath(projection, context);
      context.clearRect(0, 0, bounds.width, bounds.height);
      context.fillStyle = "#181825";
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = "#89dceb";
      context.lineWidth = 2;
      context.stroke();

      context.strokeStyle = "#6c7086";
      context.lineWidth = 1;
      context.globalAlpha = 0.6;
      context.beginPath();
      path(graticule);
      context.stroke();
      context.globalAlpha = 1;
      context.fillStyle = "#45475a";
      context.beginPath();
      path(land);
      context.fill();
      context.strokeStyle = "#a6adc8";
      context.lineWidth = 1;
      context.stroke();
      context.font = '10px "CaskaydiaCove Nerd Font", monospace';
      const labels: { width: number; x: number; y: number }[] = [];

      globeCities.forEach((city) => {
        if (project(city.latitude, city.longitude, rotation).z <= 0) return;
        const point = projection([city.longitude, city.latitude]);
        if (!point) return;
        const [px, py] = point;
        const isHome = cityKey(city) === cityKey(home);
        const isSelected = cityKey(city) === cityKey(selected ?? home);
        context.fillStyle = isHome || isSelected ? "#89dceb" : "#a6adc8";
        context.beginPath();
        context.arc(px, py, isHome ? 4 : 3, 0, Math.PI * 2);
        context.fill();
        if (isSelected) {
          context.strokeStyle = "#cdd6f4";
          context.lineWidth = 2;
          context.beginPath();
          context.arc(px, py, 6, 0, Math.PI * 2);
          context.stroke();
        }
        context.fillStyle = "#cdd6f4";
        const label = isHome ? "Home" : city.name;
        const x = px + 9;
        const width = context.measureText(label).width;
        const y = [py - 7, py + 7, py - 21, py + 21].find((candidate) =>
          !labels.some((other) => Math.abs(candidate - other.y) < 12
            && x < other.x + other.width + 4 && x + width + 4 > other.x),
        ) ?? py - 7;
        labels.push({ width, x, y });
        context.fillText(label, x, y);
      });
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(element);
    return () => observer.disconnect();
  }, [cities, home, rotation, selected]);

  const selectMarker = (event: PointerEvent<HTMLCanvasElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const radius = Math.min(bounds.width, bounds.height) / 2 - 12;
    const projection = projectionFor(rotation, radius, bounds.width / 2, bounds.height / 2);
    const city = globeCities.find((candidate) => {
      if (project(candidate.latitude, candidate.longitude, rotation).z <= 0) return false;
      const point = projection([candidate.longitude, candidate.latitude]);
      return point && Math.hypot(event.clientX - bounds.left - point[0], event.clientY - bounds.top - point[1]) < 12;
    });
    if (city) onSelect(city);
  };

  return (
    <section className="globe-view">
      <canvas
        aria-label="Interactive globe. Drag to rotate; click a city marker to focus it."
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { pitch: rotation.pitch, startX: event.clientX, startY: event.clientY, yaw: rotation.yaw };
        }}
        onPointerMove={(event) => {
          if (!drag.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
          setRotation({
            pitch: Math.max(-1.3, Math.min(1.3, drag.current.pitch + (event.clientY - drag.current.startY) / 180)),
            yaw: drag.current.yaw + (event.clientX - drag.current.startX) / 180,
          });
        }}
        onPointerUp={(event) => {
          if (drag.current && Math.hypot(event.clientX - drag.current.startX, event.clientY - drag.current.startY) < 4) selectMarker(event);
          drag.current = null;
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        ref={canvas}
      />
    </section>
  );
}
