import type { City } from "./cities";

export type Rotation = { pitch: number; yaw: number };

export type ProjectedPoint = { x: number; y: number; z: number };

const radians = (degrees: number) => (degrees * Math.PI) / 180;

export function project(latitude: number, longitude: number, rotation: Rotation): ProjectedPoint {
  const lat = radians(latitude);
  const lon = radians(longitude) + rotation.yaw;
  return {
    x: Math.cos(lat) * Math.sin(lon),
    y: Math.sin(lat) * Math.cos(rotation.pitch) - Math.cos(lat) * Math.cos(lon) * Math.sin(rotation.pitch),
    z: Math.sin(lat) * Math.sin(rotation.pitch) + Math.cos(lat) * Math.cos(lon) * Math.cos(rotation.pitch),
  };
}

export function focusRotation(city: City): Rotation {
  return { pitch: radians(city.latitude), yaw: -radians(city.longitude) };
}
