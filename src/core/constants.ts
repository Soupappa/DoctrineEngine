import type { Faction } from "./types";

export const FACTION_COLORS: Record<Faction, string> = {
  red: "#e14d57",
  blue: "#4aa0ff"
};

export const FACTION_ACCENTS: Record<Faction, string> = {
  red: "#ffb05f",
  blue: "#7be3ff"
};

export const BASE_HP = 900;
export const STARTING_RESOURCES = 190;
export const PASSIVE_INCOME = 8;
export const MIN_UNIT_COST = 25;
export const MAX_UNITS_PER_FACTION = 38;
export const BASE_PRODUCTION_INTERVAL = 2.4;
export const TACTICAL_WAVE_INTERVAL = 5;
export const RESOURCE_ZONE_BONUS_RADIUS = 92;
export const STEALTH_VISIBLE_DURATION = 1;
export const STEALTH_CYCLE_DURATION = 3;
export const DETECTION_VISION_THRESHOLD = 10;

export const STAT_LIMITS = {
  hp: { min: 10, max: 240 },
  damage: { min: 0, max: 70 },
  range: { min: 0.8, max: 12 },
  attackRate: { min: 0.25, max: 3 },
  speed: { min: 0.8, max: 8.5 },
  armor: { min: 0, max: 10 },
  vision: { min: 2, max: 14 }
} as const;

export const WORLD_SCALE = 42;
