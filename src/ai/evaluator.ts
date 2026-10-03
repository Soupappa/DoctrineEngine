import type { UnitDefinition } from "../core/types";

export function describeThreat(unit: UnitDefinition): string {
  const tags: string[] = [];
  if (unit.traits.stealth) tags.push("stealth");
  if (unit.traits.flying) tags.push("flying air");
  if (unit.stats.speed > 6) tags.push("fast");
  if (unit.stats.range > 7) tags.push("range artillery");
  if (unit.stats.armor > 4 || unit.stats.hp > 120) tags.push("heavy armor");
  if (unit.role === "swarm" || unit.cost < 55) tags.push("swarm fragile");
  if (unit.traits.areaDamage) tags.push("area");
  return tags.join(" ") || "balanced";
}

export function unitScore(unit: UnitDefinition): number {
  const dps = unit.stats.damage * unit.stats.attackRate;
  const durability = unit.stats.hp * (1 + unit.stats.armor / 9);
  const mobility = unit.stats.speed * 8 + unit.stats.range * 5;
  const traitBonus = Object.values(unit.traits).filter(Boolean).length * 12;
  return (dps * 4 + durability * 0.55 + mobility + traitBonus) / Math.max(35, unit.cost);
}
