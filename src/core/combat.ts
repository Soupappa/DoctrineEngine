import { DETECTION_VISION_THRESHOLD, STEALTH_CYCLE_DURATION, STEALTH_VISIBLE_DURATION, WORLD_SCALE } from "./constants";
import type { RuntimeUnit, UnitDefinition, Vector2 } from "./types";

export function distance(a: Vector2, b: Vector2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function moveToward(position: Vector2, target: Vector2, speed: number, dt: number): Vector2 {
  const dist = distance(position, target);
  if (dist < 0.001) return position;
  const step = Math.min(dist, speed * WORLD_SCALE * dt);
  return {
    x: position.x + ((target.x - position.x) / dist) * step,
    y: position.y + ((target.y - position.y) / dist) * step
  };
}

export function rangePixels(definition: UnitDefinition): number {
  return definition.stats.range * WORLD_SCALE;
}

export function computeDamage(attacker: UnitDefinition, target: RuntimeUnit | { armor: number }): number {
  const armor = "definition" in target ? target.definition.stats.armor : target.armor;
  const weapon = attacker.weapon;
  const effectiveArmor = Math.max(0, armor * (1 - weapon.armorPiercing));
  const flyingReduction = "definition" in target && target.definition.traits.flying && weapon.areaRadius > 0 ? 0.58 : 1;
  const mitigation = effectiveArmor / (effectiveArmor + 8);
  const raw = weapon.damage * (attacker.traits.suicide ? 2.4 : 1);
  return Math.max(1, raw * (1 - mitigation) * flyingReduction);
}

export function canDetect(attacker: UnitDefinition, target: UnitDefinition, elapsed = 0): boolean {
  if (!target.traits.stealth) return true;
  return attacker.traits.detector || attacker.traits.jammer || attacker.stats.vision > DETECTION_VISION_THRESHOLD || isStealthRevealed(target, elapsed);
}

export function isStealthRevealed(target: UnitDefinition, elapsed: number): boolean {
  if (!target.traits.stealth) return true;
  const offset = stealthOffset(target.id);
  return (elapsed + offset) % STEALTH_CYCLE_DURATION < STEALTH_VISIBLE_DURATION;
}

function stealthOffset(seed: string): number {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return (hash % 1000) / 1000 * STEALTH_CYCLE_DURATION;
}
