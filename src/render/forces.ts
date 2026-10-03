import type { BattleCard, Faction, UnitDefinition } from "../core/types";
import { getWeapon } from "../core/weapons";
import { factionName, renderCombinedRadar, renderUnitSvg, renderWeaponSvg } from "./unitVisuals";

export interface PreparedForce {
  unit: UnitDefinition;
  budget: number;
}

export function renderForces(
  active: Record<Faction, UnitDefinition>,
  prepared: Partial<Record<Faction, PreparedForce>>,
  currentBattle?: BattleCard,
  favorites = new Set<string>()
): string {
  return `
    <div class="forces-panel">
      <div class="forces-title">Forces en presence</div>
      <div class="forces-grid">
        ${forceSide("red", prepared.red, active.red, currentBattle, favorites)}
        ${forceSide("blue", prepared.blue, active.blue, currentBattle, favorites)}
      </div>
    </div>
  `;
}

function forceSide(faction: Faction, prepared: PreparedForce | undefined, active: UnitDefinition, battle: BattleCard | undefined, favorites: Set<string>): string {
  const battleUnit = battle ? (faction === "red" ? battle.redUnit : battle.blueUnit) : undefined;
  const battleIsActive = battle?.status === "running";
  const unit = battleIsActive ? battleUnit ?? active : prepared?.unit ?? battleUnit ?? active;
  const budget = prepared?.budget;
  const quantity = !battleIsActive && budget ? Math.floor(budget / unit.cost) : battle ? (faction === "red" ? battle.redQuantity : battle.blueQuantity) : 0;
  const caption = battleIsActive
    ? `engage : ${quantity}x | en cours`
    : prepared
      ? `prepare : ${quantity}x | credit ${budget}`
      : battle
        ? `engage : ${quantity}x | termine`
        : "doctrine active IA";
  return `
    <section class="force-side ${faction}">
      <div class="force-main">
        ${renderUnitSvg(unit, 84)}
        <div class="force-radars">${renderCombinedRadar(unit, 150, "both")}</div>
      </div>
      <div class="force-info">
        <strong>${factionName(faction)}</strong>
        <span>${unit.name}</span>
        <small>${caption}</small>
        <div class="tags">
          <span class="tag">PV ${Math.round(unit.stats.hp)}</span>
          <span class="tag">D ${Math.round(unit.stats.damage)}</span>
          <span class="tag">R ${unit.stats.range.toFixed(1)}</span>
          <span class="tag">Vit ${unit.stats.speed.toFixed(1)}</span>
          <span class="tag">Arm ${unit.stats.armor.toFixed(1)}</span>
          <span class="tag">Cout ${unit.cost}</span>
          <span class="tag">${unit.weapon?.name ?? "Canon cinetique"}</span>
        </div>
        <div class="weapon-mini">${renderWeaponSvg(unit.weapon ?? getWeapon("kinetic"), 54)}<span>${weaponSummary(unit)}</span></div>
        <div class="champion-actions force-actions">
          <button data-champion-load="${unit.id}">Charger</button>
          <button data-favorite-unit="${unit.id}">${favorites.has(unit.id) ? "Favori -" : "Favori +"}</button>
          <button data-send-red="${unit.id}">Send RED</button>
          <button data-send-blue="${unit.id}">Send BLUE</button>
        </div>
      </div>
    </section>
  `;
}

function weaponSummary(unit: UnitDefinition): string {
  const weapon = unit.weapon ?? getWeapon("kinetic");
  return `Arme D${Math.round(weapon.damage)} R${weapon.range.toFixed(1)} C${weapon.attackRate.toFixed(2)}`;
}
