import { useEffect, useRef } from "react";
import { geoGraticule, geoOrthographic, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import atlas from "world-atlas/land-110m.json";
import type { City } from "./cities";
import { focusRotation } from "./projection";

const land = feature(atlas as never, atlas.objects.land as never);
const graticule = geoGraticule().step([30, 30])();
const degrees = (radians: number) => (radians * 180) / Math.PI;

export function TitleGlobe({ city }: { city: City }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const draw = () => {
      const size = 28;
      const scale = window.devicePixelRatio;
      element.width = size * scale;
      element.height = size * scale;
      const context = element.getContext("2d");
      if (!context) return;
      context.scale(scale, scale);
      const colors = getComputedStyle(document.documentElement);
      const rotation = focusRotation(city);
      const projection = geoOrthographic()
        .clipAngle(90)
        .rotate([degrees(rotation.yaw), -degrees(rotation.pitch)])
        .scale(12)
        .translate([14, 14]);
      const path = geoPath(projection, context);

      context.fillStyle = colors.getPropertyValue("--base");
      context.beginPath();
      context.arc(14, 14, 12, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = colors.getPropertyValue("--sky");
      context.lineWidth = 1.5;
      context.stroke();
      context.strokeStyle = colors.getPropertyValue("--overlay");
      context.lineWidth = 0.5;
      context.globalAlpha = 0.6;
      context.beginPath();
      path(graticule);
      context.stroke();
      context.globalAlpha = 1;
      context.fillStyle = colors.getPropertyValue("--text");
      context.beginPath();
      path(land);
      context.fill();
      const point = projection([city.longitude, city.latitude]);
      if (!point) return;
      context.fillStyle = colors.getPropertyValue("--sky");
      context.beginPath();
      context.arc(point[0], point[1], 2.5, 0, Math.PI * 2);
      context.fill();
    };

    draw();
    const appearance = window.matchMedia("(prefers-color-scheme: light)");
    appearance.addEventListener("change", draw);
    return () => appearance.removeEventListener("change", draw);
  }, [city]);

  return <canvas aria-hidden="true" ref={canvas} />;
}
