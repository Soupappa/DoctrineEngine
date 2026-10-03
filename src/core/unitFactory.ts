import { calculateUnitCost, normalizeStats } from "./costModel";
import type { Faction, UnitDefinition, UnitRole, UnitStats, UnitTraits, WeaponDefinition } from "./types";
import { getWeapon } from "./weapons";
import { generateUnitVisual } from "../render/unitVisuals";

const TRAIT_DEFAULTS: UnitTraits = {
  stealth: false,
  detector: false,
  flying: false,
  areaDamage: false,
  regeneration: false,
  repair: false,
  builder: false,
  suicide: false,
  jammer: false,
  decoy: false,
  slow: false,
  transport: false,
  mining: false
};

const NAME_LEFT = ["Scarabee", "Aiguille", "Mur", "Lance", "Frelon", "Bastion", "Filet", "Mirage", "Forge", "Noyau"];
const NAME_RIGHT = ["perceur", "mobile", "cendre", "longue-vue", "brouilleur", "ralentisseur", "spirale", "sentinelle", "eclat", "front"];

export interface UnitRecipe {
  id: string;
  name?: string;
  faction: Faction;
  role: UnitRole;
  stats: UnitStats;
  traits?: Partial<UnitTraits>;
  buildTime?: number;
  weaponId?: string;
  weapon?: WeaponDefinition;
}

export function createUnitDefinition(recipe: UnitRecipe): UnitDefinition {
  const weapon = recipe.weapon ?? getWeapon(recipe.weaponId);
  const stats = normalizeStats({
    ...recipe.stats,
    damage: weapon.damage,
    range: weapon.range,
    attackRate: weapon.attackRate
  });
  const traits = { ...TRAIT_DEFAULTS, ...recipe.traits };
  const buildTime = recipe.buildTime ?? deriveBuildTime(stats, traits, weapon.cost);
  const cost = calculateUnitCost({ stats, traits, buildTime, weapon }).finalCost;
  const baseDefinition = {
    id: recipe.id,
    name: recipe.name ?? generateDoctrineName(recipe.id),
    faction: recipe.faction,
    role: recipe.role,
    stats,
    weapon,
    traits,
    cost,
    buildTime
  };

  return {
    ...baseDefinition,
    visual: generateUnitVisual(baseDefinition)
  };
}

function deriveBuildTime(stats: UnitStats, traits: UnitTraits, weaponCost: number): number {
  const traitLoad = Object.values(traits).filter(Boolean).length * 0.45;
  return Math.round((2.2 + stats.hp / 85 + weaponCost / 75 + traitLoad) * 10) / 10;
}

function generateDoctrineName(seed: string): string {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `${NAME_LEFT[hash % NAME_LEFT.length]}-${NAME_RIGHT[((hash >>> 4) % NAME_RIGHT.length)]}`;
}

export function cloneForFaction(definition: UnitDefinition, faction: Faction, id: string): UnitDefinition {
  return createUnitDefinition({
    id,
    name: definition.name,
    faction,
    role: definition.role,
    stats: definition.stats,
    traits: definition.traits,
    buildTime: definition.buildTime,
    weaponId: definition.weapon?.id
  });
}
