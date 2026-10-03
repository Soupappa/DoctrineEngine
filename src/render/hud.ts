import { calculateUnitCost } from "../core/costModel";
import { formatTime } from "../core/simulation";
import type { ChampionRecord, DoctrineId, Faction, SimulationState, UnitDefinition, UnitRole } from "../core/types";
import { WEAPONS } from "../core/weapons";
import { factionName, renderCombinedRadar, renderUnitSvg, renderWeaponSvg } from "./unitVisuals";

export interface ComposerState {
  faction: Faction;
  name: string;
  role: UnitRole;
  hp: number;
  damage: number;
  range: number;
  attackRate: number;
  speed: number;
  armor: number;
  vision: number;
  buildTime: number;
  budget: number;
  weaponId: string;
  editMode: "body" | "weapon";
  radarMode: "both" | "body" | "weapon";
  weaponDamage: number;
  weaponRange: number;
  weaponAttackRate: number;
  weaponArmorPiercing: number;
  weaponAreaRadius: number;
  weaponTracking: number;
  traits: {
    stealth: boolean;
    detector: boolean;
    flying: boolean;
    areaDamage: boolean;
    regeneration: boolean;
    repair: boolean;
    builder: boolean;
    suicide: boolean;
    jammer: boolean;
    decoy: boolean;
    mining: boolean;
    slow: boolean;
  };
}

const ROLES: UnitRole[] = ["scout", "raider", "tank", "artillery", "support", "builder", "miner", "air", "swarm", "siege"];
const DOCTRINE_LABELS: Record<DoctrineId, string> = {
  rush: "Rush",
  turtle: "Turtle",
  swarm: "Swarm",
  artillery: "Artillery",
  stealth: "Stealth",
  "anti-stealth": "Anti-stealth",
  economy: "Economy",
  "air-control": "Air control",
  attrition: "Attrition",
  harassment: "Harassment",
  siege: "Siege",
  "counter-heavy": "Counter-heavy",
  "counter-swarm": "Counter-swarm"
};

export function renderHud(state: SimulationState): string {
  return `
    <aside class="panel">
      <div class="title">
        <div>
          <h1>Doctrine Engine</h1>
          <p class="subtle">${state.mode === "ai-lab" ? "AI Lab autonome" : "Humain contre IA"}</p>
        </div>
      </div>
    </aside>
  `;
}

export function renderBattleStatus(state: SimulationState): string {
  const status = state.winner ? `Victoire ${factionName(state.winner)}` : state.running ? "En cours" : "Pret";
  return `
    <div class="battle-status-strip">
      <div><span>GEN</span><strong>${state.generation}</strong></div>
      <div><span>TEMPS</span><strong>${formatTime(state.elapsed)}</strong></div>
      <div class="red"><span>BASE R</span><strong>${Math.max(0, Math.round(state.bases.red.hp))}</strong></div>
      <div class="blue"><span>BASE B</span><strong>${Math.max(0, Math.round(state.bases.blue.hp))}</strong></div>
      <div><span>STATUT</span><strong>${status}</strong></div>
    </div>
  `;
}

export function renderComposerPanel(composer: ComposerState, preview: UnitDefinition): string {
  return `
    ${renderComposer(composer, preview)}
  `;
}

function renderComposer(composer: ComposerState, preview: UnitDefinition): string {
  const cost = calculateUnitCost(preview);
  const overBudget = preview.cost > composer.budget;
  return `
    <section class="composer">
      <div class="composer-head">
        <div>
          <h2>Compositeur humain</h2>
          <p class="subtle">Creer une escouade et provoquer l'IA</p>
        </div>
        <div class="composer-previews">
          <div id="composer-preview-svg">${renderUnitSvg(preview, 104)}</div>
          <div id="composer-weapon-svg">${renderWeaponSvg(preview.weapon, 86)}</div>
        </div>
      </div>
      <div class="cost-readout composer-cost-top ${overBudget ? "over-budget" : ""}">
        <strong id="composer-cost-value">${preview.cost}</strong>
        <span id="composer-cost-detail">${budgetLine(composer.budget, preview.cost)}<br/>corps ${Math.round(cost.statCost)} | arme ${Math.round(preview.weapon.cost)} | traits ${Math.round(cost.traitCost)} | synergie ${Math.round(cost.synergyPenalty)}</span>
      </div>
      <div class="composer-radar combined" id="composer-radar">
        <div class="composer-radar-head">
          <span>Signature</span>
          <div class="mini-tabs">
            ${modeButton("both", "Mix", composer.radarMode)}
            ${modeButton("body", "Corps", composer.radarMode)}
            ${modeButton("weapon", "Arme", composer.radarMode)}
          </div>
        </div>
        ${renderCombinedRadar(preview, 270, composer.radarMode)}
      </div>
      <label class="field">
        <span>Nom</span>
        <input id="compose-name" value="${escapeHtml(composer.name)}" />
      </label>
      <div class="field-row">
        <label class="field">
          <span>Camp humain</span>
          <select id="compose-faction">
            <option value="red" ${composer.faction === "red" ? "selected" : ""}>Rouge</option>
            <option value="blue" ${composer.faction === "blue" ? "selected" : ""}>Bleu</option>
          </select>
        </label>
        <label class="field">
          <span>Morphologie</span>
          <select id="compose-role">
            ${ROLES.map((role) => `<option value="${role}" ${composer.role === role ? "selected" : ""}>${role}</option>`).join("")}
          </select>
        </label>
      </div>
      <label class="field">
        <span>Archetype d'arme</span>
        <select id="compose-weapon">
          ${WEAPONS.map((weapon) => `<option value="${weapon.id}" ${composer.weaponId === weapon.id ? "selected" : ""}>${weapon.name}</option>`).join("")}
        </select>
      </label>
      <div class="weapon-readout" id="composer-weapon-detail">${weaponLine(preview)}</div>
      <div class="mode-switch">
        <button data-edit-mode="body" class="${composer.editMode === "body" ? "active" : ""}">Corps</button>
        <button data-edit-mode="weapon" class="${composer.editMode === "weapon" ? "active" : ""}">Arme</button>
      </div>
      <div class="slider-grid" id="composer-sliders">
        ${slider("budget", "Credit", composer.budget, 100, 6000, 50)}
        ${composer.editMode === "body" ? bodySliders(composer) : weaponSliders(composer)}
      </div>
      <div class="trait-grid">
        ${trait("stealth", "Furtif", composer.traits.stealth)}
        ${trait("detector", "Detection", composer.traits.detector)}
        ${trait("flying", "Vol", composer.traits.flying)}
        ${trait("areaDamage", "Zone", composer.traits.areaDamage)}
        ${trait("regeneration", "Regen.", composer.traits.regeneration)}
        ${trait("repair", "Repare", composer.traits.repair)}
        ${trait("builder", "Batisseur", composer.traits.builder)}
        ${trait("mining", "Mineur", composer.traits.mining)}
        ${trait("suicide", "Suicide", composer.traits.suicide)}
        ${trait("jammer", "Brouille", composer.traits.jammer)}
        ${trait("decoy", "Leurre", composer.traits.decoy)}
        ${trait("slow", "Ralentit", composer.traits.slow)}
      </div>
      <div class="inject-pair">
        <button class="wide-button primary" id="prepare-red" ${preview.cost > composer.budget ? "disabled" : ""}>${preview.cost > composer.budget ? "Budget insuffisant" : "Send RED"}</button>
        <button class="wide-button primary" id="prepare-blue" ${preview.cost > composer.budget ? "disabled" : ""}>${preview.cost > composer.budget ? "Budget insuffisant" : "Send BLUE"}</button>
      </div>
      <button class="wide-button" id="launch-prepared">Lancer combat prepare</button>
    </section>
  `;
}

function bodySliders(composer: ComposerState): string {
  return `
    ${slider("hp", "PV", composer.hp, 10, 240, 1)}
    ${slider("speed", "Vitesse", composer.speed, 0.8, 8.5, 0.1)}
    ${slider("armor", "Armure", composer.armor, 0, 10, 0.1)}
    ${slider("vision", "Vision", composer.vision, 2, 14, 0.1)}
  `;
}

function weaponSliders(composer: ComposerState): string {
  return `
    ${slider("weaponDamage", "Degats", composer.weaponDamage, 1, 70, 1)}
    ${slider("weaponRange", "Portee", composer.weaponRange, 0.8, 12, 0.1)}
    ${slider("weaponAttackRate", "Cadence", composer.weaponAttackRate, 0.25, 3, 0.05)}
    ${slider("weaponArmorPiercing", "Percage", composer.weaponArmorPiercing, 0, 0.8, 0.01)}
    ${slider("weaponAreaRadius", "Zone", composer.weaponAreaRadius, 0, 42, 1)}
    ${slider("weaponTracking", "Tracking", composer.weaponTracking, 0, 1, 0.01)}
  `;
}

function slider(id: keyof Omit<ComposerState, "faction" | "name" | "role" | "traits" | "weaponId" | "editMode" | "radarMode">, label: string, value: number, min: number, max: number, step: number): string {
  return `
    <label class="slider-field">
      <span>${label} <strong data-compose-value="${id}">${Number(value).toFixed(step < 1 ? 1 : 0)}</strong></span>
      <input data-compose-number="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}" />
    </label>
  `;
}

function modeButton(mode: ComposerState["radarMode"], label: string, current: ComposerState["radarMode"]): string {
  return `<button data-radar-mode="${mode}" class="${current === mode ? "active" : ""}">${label}</button>`;
}

function trait(id: keyof ComposerState["traits"], label: string, checked: boolean): string {
  return `
    <label class="trait-pill">
      <input data-compose-trait="${id}" type="checkbox" ${checked ? "checked" : ""} />
      <span>${label}</span>
    </label>
  `;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };
    return entities[char];
  });
}

function budgetLine(budget: number, cost: number): string {
  const quantity = Math.floor(budget / cost);
  const remainder = budget - quantity * cost;
  if (quantity < 1) return `credit ${budget} | hors budget`;
  return `credit ${budget} | ${quantity} unite${quantity > 1 ? "s" : ""} | reste ${remainder}`;
}

function statLine(unit: UnitDefinition): string {
  const s = unit.stats;
  return `PV ${Math.round(s.hp)} · Arme ${unit.weapon?.name ?? "Canon cinetique"} · R ${s.range.toFixed(1)} · Cad ${s.attackRate.toFixed(2)} · Vit ${s.speed.toFixed(1)} · Arm ${s.armor.toFixed(1)} · Vis ${s.vision.toFixed(1)}`;
}

function weaponLine(unit: UnitDefinition): string {
  const weapon = unit.weapon;
  return `Arme : ${weapon.name} | degats ${weapon.damage} | portee ${weapon.range} | cadence ${weapon.attackRate} | percage ${Math.round(weapon.armorPiercing * 100)}% | zone ${weapon.areaRadius}`;
}
