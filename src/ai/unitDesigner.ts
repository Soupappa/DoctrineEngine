import { createUnitDefinition } from "../core/unitFactory";
import type { DoctrineId, Faction, UnitDefinition, UnitStats, UnitTraits } from "../core/types";
import { getDoctrine } from "./doctrine";

type StatKey = keyof UnitStats;
type DesignVariant = "bruiser" | "fortress" | "glass" | "skirmisher" | "sniper" | "swarmlet" | "sensor" | "disruptor" | "siegeCore";

interface VariantProfile {
  countBias: number[];
  label: string;
  multipliers: UnitStats;
  priorities: StatKey[];
  traits?: Partial<UnitTraits>;
  role?: UnitDefinition["role"];
}

export function designUnitFromDoctrine(
  faction: Faction,
  doctrineId: DoctrineId,
  generation: number,
  pressure = 0,
  enemyUnit?: UnitDefinition
): UnitDefinition {
  const doctrine = getDoctrine(doctrineId);
  const variance = seededVariance(`${faction}_${doctrineId}_${generation}_${pressure}`);
  const variant = chooseDesignVariant(doctrineId, generation, pressure, variance, enemyUnit);
  const profile = VARIANT_PROFILES[variant];
  const weaponId = chooseWeaponId(variant, doctrineId, enemyUnit, generation, variance);
  const plannedCount = chooseSquadCount(doctrineId, variant, generation, pressure, variance);
  const targetCost = Math.floor(900 / plannedCount);
  const stats = doctrine.statBias as UnitStats;
  const adjusted: UnitStats = {
    hp: stats.hp + variance(-10, 18) + pressure * 6,
    damage: stats.damage + variance(-4, 7) + pressure * 1.4,
    range: stats.range + variance(-0.7, 1.1),
    attackRate: stats.attackRate + variance(-0.18, 0.25),
    speed: stats.speed + variance(-0.55, 0.7),
    armor: stats.armor + variance(-0.5, 0.8),
    vision: stats.vision + variance(-1, 1.8)
  };
  const traits: Partial<UnitTraits> = { ...doctrine.traitBias };

  if (doctrineId === "counter-swarm") traits.areaDamage = true;
  if (doctrineId === "anti-stealth") traits.detector = true;
  if (doctrineId === "harassment" && generation % 3 === 0) traits.stealth = true;
  if (doctrineId === "economy") traits.mining = true;
  if (generation % 5 === 0 && doctrineId !== "anti-stealth") traits.decoy = true;
  if (pressure > 0 && generation % 2 === 0) traits.slow = doctrineId === "turtle" || doctrineId === "counter-swarm";
  Object.assign(traits, profile.traits ?? {});
  const shaped = applyVariantProfile(adjusted, profile);
  return tuneUnitToTargetCost({
    faction,
    doctrineId,
    variant,
    generation,
    role: profile.role ?? doctrine.preferredRole,
    stats: shaped,
    traits,
    weaponId,
    targetCost,
    plannedCount
  });
}

const VARIANT_PROFILES: Record<DesignVariant, VariantProfile> = {
  bruiser: {
    countBias: [2, 3],
    label: "Briseur",
    multipliers: { hp: 1.18, damage: 1.08, range: 0.82, attackRate: 1.04, speed: 0.76, armor: 1.35, vision: 0.75 },
    priorities: ["hp", "armor", "damage", "attackRate"]
  },
  fortress: {
    countBias: [1, 2],
    label: "Forteresse",
    multipliers: { hp: 1.55, damage: 0.78, range: 0.72, attackRate: 0.75, speed: 0.48, armor: 1.85, vision: 0.7 },
    priorities: ["hp", "armor", "hp", "armor"],
    traits: { regeneration: true },
    role: "tank"
  },
  glass: {
    countBias: [2, 3, 4],
    label: "Aiguille",
    multipliers: { hp: 0.58, damage: 1.72, range: 0.95, attackRate: 1.38, speed: 1.0, armor: 0.25, vision: 0.85 },
    priorities: ["damage", "attackRate", "damage", "range"]
  },
  skirmisher: {
    countBias: [4, 5, 6],
    label: "Escarmouche",
    multipliers: { hp: 0.72, damage: 0.82, range: 1.22, attackRate: 1.08, speed: 1.65, armor: 0.28, vision: 1.15 },
    priorities: ["speed", "range", "attackRate", "vision"],
    role: "scout"
  },
  sniper: {
    countBias: [2, 3],
    label: "Longue-vue",
    multipliers: { hp: 0.62, damage: 1.42, range: 1.9, attackRate: 0.58, speed: 0.82, armor: 0.35, vision: 1.35 },
    priorities: ["range", "damage", "vision", "range"],
    role: "artillery"
  },
  swarmlet: {
    countBias: [6, 9],
    label: "Nuage",
    multipliers: { hp: 0.46, damage: 0.62, range: 0.72, attackRate: 1.56, speed: 1.38, armor: 0.05, vision: 0.82 },
    priorities: ["attackRate", "speed", "damage", "hp"],
    role: "swarm"
  },
  sensor: {
    countBias: [3, 4, 5],
    label: "Vigie",
    multipliers: { hp: 0.86, damage: 0.55, range: 1.05, attackRate: 0.9, speed: 1.18, armor: 0.45, vision: 2.05 },
    priorities: ["vision", "speed", "range", "hp"],
    traits: { detector: true },
    role: "support"
  },
  disruptor: {
    countBias: [3, 4],
    label: "Brouilleur",
    multipliers: { hp: 0.78, damage: 0.78, range: 1.38, attackRate: 1.04, speed: 1.08, armor: 0.35, vision: 1.22 },
    priorities: ["range", "vision", "speed", "attackRate"],
    traits: { jammer: true, slow: true },
    role: "support"
  },
  siegeCore: {
    countBias: [1, 2],
    label: "Siege",
    multipliers: { hp: 1.05, damage: 1.78, range: 1.55, attackRate: 0.48, speed: 0.42, armor: 1.0, vision: 1.0 },
    priorities: ["damage", "range", "hp", "armor"],
    traits: { areaDamage: true },
    role: "siege"
  }
};

function chooseDesignVariant(
  doctrineId: DoctrineId,
  generation: number,
  pressure: number,
  variance: (min: number, max: number) => number,
  enemyUnit?: UnitDefinition
): DesignVariant {
  const counterVariants = counterVariantsFor(enemyUnit, pressure);
  if (counterVariants.length > 0) {
    const index = Math.abs(Math.floor(variance(0, counterVariants.length * 4)) + generation) % counterVariants.length;
    return counterVariants[index];
  }

  const variants: Partial<Record<DoctrineId, DesignVariant[]>> = {
    rush: ["skirmisher", "swarmlet", "glass"],
    swarm: ["swarmlet", "skirmisher", "glass"],
    harassment: ["skirmisher", "disruptor", "glass", "sensor"],
    artillery: ["sniper", "siegeCore", "glass"],
    turtle: ["fortress", "bruiser", "disruptor"],
    siege: ["siegeCore", "sniper", "fortress"],
    attrition: ["bruiser", "fortress", "disruptor"],
    "air-control": ["skirmisher", "sensor", "sniper"],
    "counter-heavy": ["glass", "sniper", "disruptor"],
    "counter-swarm": ["disruptor", "bruiser", "sensor"],
    "anti-stealth": ["sensor", "skirmisher", "disruptor"],
    economy: ["sensor", "swarmlet", "bruiser"],
    stealth: ["glass", "skirmisher", "disruptor"]
  };
  const options = variants[doctrineId] ?? ["bruiser", "skirmisher", "glass", "sniper"];
  const pressureOffset = pressure > 0 ? 2 : 0;
  const index = Math.abs(Math.floor(variance(0, options.length * 4)) + generation + pressureOffset) % options.length;
  return options[index];
}

function counterVariantsFor(enemyUnit: UnitDefinition | undefined, pressure: number): DesignVariant[] {
  if (!enemyUnit || pressure <= 0) return [];
  const enemy = enemyUnit.stats;
  const enemyDps = enemy.damage * enemy.attackRate;
  const enemyIsArmorWall = enemy.hp > 95 && enemy.armor > 4;
  const enemyIsSlowBrick = enemyIsArmorWall && enemy.speed < 3.2 && enemy.range < 4.2;
  const enemyIsGlass = enemy.hp < 45 && enemy.armor < 1.2 && enemyDps > 18;
  const enemyIsSwarm = enemyUnit.cost <= 180 || enemy.hp < 35;
  const enemyOutranges = enemy.range > 6.5;
  const enemyIsStealth = enemyUnit.traits.stealth || enemyUnit.traits.decoy;

  if (enemyIsSlowBrick) return ["sniper", "disruptor", "glass", "skirmisher"];
  if (enemyIsArmorWall) return ["glass", "sniper", "siegeCore", "disruptor"];
  if (enemyIsSwarm) return ["disruptor", "bruiser", "sensor", "siegeCore"];
  if (enemyIsGlass) return ["swarmlet", "skirmisher", "sensor"];
  if (enemyOutranges) return ["skirmisher", "sensor", "swarmlet"];
  if (enemyIsStealth) return ["sensor", "disruptor", "skirmisher"];
  return [];
}

function chooseWeaponId(
  variant: DesignVariant,
  doctrineId: DoctrineId,
  enemyUnit: UnitDefinition | undefined,
  generation: number,
  variance: (min: number, max: number) => number
): string {
  const enemy = enemyUnit?.stats;
  if (enemy && enemy.hp > 100 && enemy.armor > 4) {
    const antiHeavy = ["beam", "cannon", "missile"];
    return antiHeavy[(generation + Math.floor(variance(0, 6))) % antiHeavy.length];
  }
  if (enemy && (enemyUnit.cost < 180 || enemy.hp < 40)) {
    const antiSwarm = ["grenade", "flak", "laser"];
    return antiSwarm[(generation + Math.floor(variance(0, 6))) % antiSwarm.length];
  }
  if (enemyUnit?.traits.flying) return generation % 2 === 0 ? "flak" : "laser";
  if (enemyUnit?.traits.stealth) return "emp";

  const byVariant: Record<DesignVariant, string[]> = {
    bruiser: ["kinetic", "cannon", "beam"],
    fortress: ["cannon", "kinetic", "emp"],
    glass: ["beam", "cannon", "laser"],
    skirmisher: ["laser", "kinetic", "emp"],
    sniper: ["missile", "cannon", "laser"],
    swarmlet: ["kinetic", "flak", "laser"],
    sensor: ["laser", "emp", "flak"],
    disruptor: ["emp", "laser", "missile"],
    siegeCore: ["missile", "grenade", "cannon"]
  };
  const options = byVariant[variant] ?? ["kinetic"];
  if (doctrineId === "counter-swarm") return generation % 2 === 0 ? "grenade" : "flak";
  if (doctrineId === "counter-heavy") return generation % 2 === 0 ? "beam" : "cannon";
  return options[(generation + Math.floor(variance(0, options.length * 3))) % options.length];
}

function applyVariantProfile(stats: UnitStats, profile: VariantProfile): UnitStats {
  return {
    hp: stats.hp * profile.multipliers.hp,
    damage: stats.damage * profile.multipliers.damage,
    range: stats.range * profile.multipliers.range,
    attackRate: stats.attackRate * profile.multipliers.attackRate,
    speed: stats.speed * profile.multipliers.speed,
    armor: stats.armor * profile.multipliers.armor,
    vision: stats.vision * profile.multipliers.vision
  };
}

function chooseSquadCount(
  doctrineId: DoctrineId,
  variant: DesignVariant,
  generation: number,
  pressure: number,
  variance: (min: number, max: number) => number
): number {
  const plans: Partial<Record<DoctrineId, number[]>> = {
    rush: [4, 5, 6, 9],
    swarm: [5, 6, 9],
    harassment: [3, 5, 6],
    artillery: [2, 3, 4],
    turtle: [1, 2, 3],
    siege: [1, 2, 3],
    attrition: [2, 3, 4, 5],
    "air-control": [2, 3, 4],
    "counter-heavy": [3, 4, 5],
    "counter-swarm": [3, 4, 6],
    "anti-stealth": [3, 4, 5],
    economy: [4, 5, 6],
    stealth: [2, 3, 5]
  };
  const options = VARIANT_PROFILES[variant].countBias.length > 0 ? VARIANT_PROFILES[variant].countBias : plans[doctrineId] ?? [2, 3, 4, 5];
  const pressureShift = pressure > 0 ? 1 : 0;
  const index = Math.abs(Math.floor(variance(0, options.length * 3)) + generation + pressureShift) % options.length;
  return options[index];
}

function tuneUnitToTargetCost(input: {
  faction: Faction;
  doctrineId: DoctrineId;
  variant: DesignVariant;
  generation: number;
  role: UnitDefinition["role"];
  stats: UnitStats;
  traits: Partial<UnitTraits>;
  weaponId: string;
  targetCost: number;
  plannedCount: number;
}): UnitDefinition {
  let low = 0.45;
  let high = 2.35;
  let best = makeCandidate(input, 1);
  for (let i = 0; i < 18; i += 1) {
    const scale = (low + high) / 2;
    const candidate = makeCandidate(input, scale);
    if (candidate.cost <= input.targetCost) {
      best = candidate;
      low = scale;
    } else {
      high = scale;
    }
  }

  const fineScales = [0.92, 0.96, 1, 1.04, 1.08, 1.12];
  for (const scale of fineScales) {
    const candidate = makeCandidate(input, low * scale);
    if (candidate.cost <= input.targetCost && input.targetCost - candidate.cost < input.targetCost - best.cost) {
      best = candidate;
    }
  }

  return maximizeUnderTarget(input, best);
}

function maximizeUnderTarget(
  input: {
    faction: Faction;
    doctrineId: DoctrineId;
    variant: DesignVariant;
    generation: number;
    role: UnitDefinition["role"];
    stats: UnitStats;
    traits: Partial<UnitTraits>;
    weaponId: string;
    targetCost: number;
    plannedCount: number;
  },
  start: UnitDefinition
): UnitDefinition {
  let best = start;
  for (let i = 0; i < 180; i += 1) {
    const upgrades = statUpgradesFor(input.variant, best.stats)
      .map((stats) => createUnitDefinition({
        id: `${input.faction}_gen_${input.generation}_${input.doctrineId}_x${input.plannedCount}`,
        faction: input.faction,
        role: input.role,
        stats,
        traits: input.traits,
        weaponId: input.weaponId,
        buildTime: Math.max(2.2, 3 + stats.hp / 95 + stats.damage / 24 + Object.values(input.traits).filter(Boolean).length * 0.55)
      }))
      .filter((candidate) => candidate.cost <= input.targetCost && candidate.cost > best.cost)
      .sort((a, b) => b.cost - a.cost);
    const next = upgrades[0];
    if (!next) break;
    best = next;
    if (input.targetCost - best.cost <= 3) break;
  }
  return best;
}

function statUpgradesFor(variant: DesignVariant, stats: UnitStats): UnitStats[] {
  const increments: Record<StatKey, number> = {
    hp: 4,
    damage: 0,
    range: 0,
    attackRate: 0,
    speed: 0.18,
    armor: 0.16,
    vision: 0.28
  };
  const priorities = VARIANT_PROFILES[variant].priorities
    .filter((key) => key !== "damage" && key !== "range" && key !== "attackRate")
    .concat(["hp", "armor", "speed", "vision"]);
  return priorities.map((key) => ({ ...stats, [key]: stats[key] + increments[key] }));
}

function makeCandidate(
  input: {
    faction: Faction;
    doctrineId: DoctrineId;
    variant: DesignVariant;
    generation: number;
    role: UnitDefinition["role"];
    stats: UnitStats;
    traits: Partial<UnitTraits>;
    weaponId: string;
    targetCost: number;
    plannedCount: number;
  },
  scale: number
): UnitDefinition {
  const stats = input.stats;
  const scaled: UnitStats = {
    hp: stats.hp * scale,
    damage: stats.damage * scale,
    range: stats.range * scale,
    attackRate: stats.attackRate * scale,
    speed: stats.speed * scale,
    armor: stats.armor * scale,
    vision: stats.vision * scale
  };
  return createUnitDefinition({
    id: `${input.faction}_gen_${input.generation}_${input.doctrineId}_${input.variant}_x${input.plannedCount}`,
    name: `${VARIANT_PROFILES[input.variant].label}-${input.plannedCount}`,
    faction: input.faction,
    role: input.role,
    stats: scaled,
    traits: input.traits,
    weaponId: input.weaponId,
    buildTime: Math.max(2.2, 3 + scaled.hp / 95 + scaled.damage / 24 + Object.values(input.traits).filter(Boolean).length * 0.55)
  });
}

function seededVariance(seed: string): (min: number, max: number) => number {
  let hash = 2166136261;
  for (const char of seed) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (min: number, max: number) => {
    hash += 0x6d2b79f5;
    let t = hash;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return min + (max - min) * value;
  };
}
