import { formatTime } from "../core/simulation";
import type { BattleCard, BattleLogEntry } from "../core/types";
import { getWeapon } from "../core/weapons";
import { renderCombinedRadar, renderUnitSvg, renderWeaponSvg } from "./unitVisuals";

export function renderBattleLog(entries: BattleLogEntry[]): string {
  return entries
    .map((entry) => {
      const factionClass = entry.faction ? ` style="color:${entry.faction === "red" ? "#ff9a9f" : "#9dccff"}"` : "";
      return `<div class="log-entry"><strong>${formatTime(entry.time)}</strong> <span${factionClass}>${entry.message}</span></div>`;
    })
    .join("");
}

export function renderBattleCards(cards: BattleCard[], fallbackLog: BattleLogEntry[]): string {
  const visibleCards = cards.filter((card) => card.status !== "preparing");
  if (visibleCards.length === 0) return renderBattleLog(fallbackLog);
  return visibleCards
    .map((card) => {
      const status = statusLabel(card);
      const mode = card.mode === "ai-lab" ? "AI Lab" : "Humain vs IA";
      const duration = card.duration == null ? "" : ` | ${formatTime(card.duration)}`;
      return `
        <article class="battle-card ${card.status}">
          ${card.result ? `<div class="victory-banner ${card.result}">Victoire ${card.result === "red" ? "rouge" : "bleue"}</div>` : ""}
          <header>
            <div>
              <strong>${mode} G${card.generation}</strong>
              <p class="subtle">${card.summary}</p>
            </div>
            <span class="battle-status">${status}${duration}</span>
          </header>
          <div class="battle-versus">
            ${battleSide("Rouge", card.redUnit, card.redQuantity)}
            <span class="versus">VS</span>
            ${battleSide("Bleu", card.blueUnit, card.blueQuantity)}
          </div>
        </article>
      `;
    })
    .join("");
}

function battleSide(label: string, unit: BattleCard["redUnit"], quantity: number): string {
  return `
    <div class="battle-side">
      ${renderUnitSvg(unit, 66)}
      <strong>${label}</strong>
      <span>${unit.name}</span>
      <small>Vague ${Math.max(0, quantity)} | Cout ${unit.cost}</small>
      ${renderCombinedRadar(unit, 138, "both")}
      <div class="weapon-mini compact">${renderWeaponSvg(unit.weapon ?? getWeapon("kinetic"), 48)}<span>${unit.weapon?.name ?? "Canon cinetique"}</span></div>
      <small>${unitStats(unit)}</small>
      <div class="champion-actions battle-actions">
        <button data-champion-load="${unit.id}">Charger</button>
        <button data-favorite-unit="${unit.id}">Favori +</button>
        <button data-send-red="${unit.id}">Send RED</button>
        <button data-send-blue="${unit.id}">Send BLUE</button>
      </div>
    </div>
  `;
}

function statusLabel(card: BattleCard): string {
  if (card.status === "running") return "En cours";
  if (card.status === "red-win") return "Victoire rouge";
  if (card.status === "blue-win") return "Victoire bleue";
  return "Pret";
}

function unitStats(unit: BattleCard["redUnit"]): string {
  const s = unit.stats;
  const traits = Object.entries(unit.traits)
    .filter(([, enabled]) => enabled)
    .map(([name]) => name)
    .slice(0, 3)
    .join(", ");
  return `PV ${Math.round(s.hp)} D${Math.round(s.damage)} R${s.range.toFixed(1)} V${s.speed.toFixed(1)}${traits ? ` | ${traits}` : ""}`;
}
