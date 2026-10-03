import "../style.css";
import { calculateUnitCost } from "./core/costModel";
import {
  createSimulation,
  forceResolveBattle,
  log as addBattleLog,
  resetBattleForNextGeneration,
  startAiBattle,
  startPreparedBattle,
  syncBattleStatus,
  updateSimulation
} from "./core/simulation";
import { createUnitDefinition } from "./core/unitFactory";
import type { Faction, SimulationState, UnitDefinition, UnitRole, WeaponDefinition } from "./core/types";
import { createConfiguredWeapon, getWeapon } from "./core/weapons";
import { renderBattleCards } from "./render/battleLog";
import { type PreparedForce, renderForces } from "./render/forces";
import { type ComposerState, renderBattleStatus, renderComposerPanel, renderHud } from "./render/hud";
import { Renderer } from "./render/renderer";
import { renderCombinedRadar, renderUnitSvg, renderWeaponSvg } from "./render/unitVisuals";

interface HallEntry {
  id: string;
  unit: UnitDefinition;
  wins: number;
  losses: number;
  nemesis?: string;
  prestige?: number;
}

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Element #app introuvable");
const appRoot = app;

let state = createSimulation();
(window as unknown as { doctrineState?: SimulationState }).doctrineState = state;
let composer: ComposerState = createDefaultComposer();
let previewUnit = createPreviewUnit(composer);
let preparedForces: Partial<Record<Faction, PreparedForce>> = {};
let hallOfFame: HallEntry[] = loadHallOfFame();
let favoriteUnits: UnitDefinition[] = loadFavorites();
let lastHallWinner: SimulationState["winner"];

appRoot.innerHTML = `
  <div class="command-frame">
    <header class="topbar">
      <div class="brand">DOCTRINE ENGINE</div>
      <div class="top-tabs">
        <span>AI LAB</span>
        <span>TACTICAL TEST</span>
        <span class="active">BOTH</span>
      </div>
    </header>
    <main class="shell">
      <div id="hud"></div>
      <section class="map-column">
        <div class="map-wrap">
          <div class="battlefield-header">
            <div>
              <div class="map-title">BATTLEFIELD</div>
              <div id="battle-status"></div>
            </div>
            <div class="map-controls">
              <button id="toggle">Demarrer</button>
              <button id="reset">Reset</button>
              <select id="speed" aria-label="Vitesse">
                <option value="1">x1</option>
                <option value="2">x2</option>
                <option value="5">x5</option>
                <option value="10">x10</option>
              </select>
              <button data-ai-runs="1">IA x1</button>
              <button data-ai-runs="5">IA x5</button>
              <button data-ai-runs="10">IA x10</button>
              <button data-ai-runs="50">IA x50</button>
              <button id="resolve-battle">Terminer</button>
            </div>
          </div>
          <canvas id="battlefield" aria-label="Carte de bataille"></canvas>
          <div class="map-hint">Survol/clic : portee de l'unite</div>
        </div>
        <div id="forces"></div>
      </section>
      <aside class="intel-panel">
        <details class="collection-section hall-section" open>
          <summary>Hall of Fame</summary>
          <div class="unit-list collection-list" id="invented"></div>
        </details>
        <details class="collection-section battle-section" open>
          <summary>Journal</summary>
          <div class="battle-log" id="log"></div>
        </details>
        <details class="collection-section favorites-section" open>
          <summary>Favoris</summary>
          <div class="collection-list" id="favorites"></div>
        </details>
      </aside>
    </main>
  </div>
`;

const canvas = document.querySelector<HTMLCanvasElement>("#battlefield");
const hud = document.querySelector<HTMLDivElement>("#hud");
const log = document.querySelector<HTMLDivElement>("#log");
const invented = document.querySelector<HTMLDivElement>("#invented");
const forces = document.querySelector<HTMLDivElement>("#forces");
const battleStatus = document.querySelector<HTMLDivElement>("#battle-status");
const favorites = document.querySelector<HTMLDivElement>("#favorites");
if (!canvas || !hud || !log || !invented || !forces || !battleStatus || !favorites) throw new Error("Interface incomplete");

const renderer = new Renderer(canvas);
const hudPanel = hud;
const logPanel = log;
const inventedPanel = invented;
const forcesPanel = forces;
const battleStatusPanel = battleStatus;
const favoritesPanel = favorites;
let last = performance.now();
let lastUiSync = 0;
let lastFrameAt = performance.now();
let frameScheduled = false;
let autoGenerationsRemaining = 0;
let lastReportedWinner: SimulationState["winner"];
let autoAdvanceAt = 0;

function bindControls(): void {
  appRoot.addEventListener("click", (event) => {
    const rawTarget = event.target;
    if (!(rawTarget instanceof HTMLElement)) return;
    const target = rawTarget.closest("button") ?? rawTarget;

    if (target.id === "toggle") {
      if (!state.running && hasPreparedForces()) {
        launchPreparedBattle();
        lastReportedWinner = undefined;
        lastHallWinner = undefined;
        autoAdvanceAt = 0;
      } else if (!state.running && !state.winner && state.units.length === 0) {
        startAiBattle(state);
        lastReportedWinner = undefined;
        lastHallWinner = undefined;
      } else if (!state.running && state.winner) {
        resetBattleForNextGeneration(state);
        if (hasPreparedForces()) {
          launchPreparedBattle();
        } else {
          startAiBattle(state);
        }
        lastReportedWinner = undefined;
        lastHallWinner = undefined;
      } else {
        state.running = !state.running;
      }
      syncBattleStatus(state);
      syncUi(true);
    }

    if (target.id === "reset") {
      state = createSimulation();
      (window as unknown as { doctrineState?: SimulationState }).doctrineState = state;
      autoGenerationsRemaining = 0;
      autoAdvanceAt = 0;
      lastReportedWinner = undefined;
      lastHallWinner = undefined;
      preparedForces = {};
      syncUi(true);
    }

    if (target.id === "resolve-battle") {
      forceResolveBattle(state);
      syncUi(true);
    }

    const aiRuns = target.getAttribute("data-ai-runs");
    if (aiRuns) {
      autoGenerationsRemaining = Math.max(0, Number(aiRuns) - 1);
      autoAdvanceAt = 0;
      if (Number(aiRuns) > 1) state.speed = 10;
      if (state.winner) resetBattleForNextGeneration(state);
      startAiBattle(state);
      lastReportedWinner = undefined;
      lastHallWinner = undefined;
      syncUi(true);
    }

    if (target.id === "prepare-unit") {
      prepareComposedUnit(composer.faction);
      syncUi(true);
    }

    if (target.id === "prepare-red") {
      prepareComposedUnit("red");
      syncUi(true);
    }

    if (target.id === "prepare-blue") {
      prepareComposedUnit("blue");
      syncUi(true);
    }

    if (target.id === "launch-prepared") {
      launchPreparedBattle();
      syncUi(true);
    }

    const editMode = target.getAttribute("data-edit-mode");
    if (editMode === "body" || editMode === "weapon") {
      composer.editMode = editMode;
      syncUi(true);
    }

    const radarMode = target.getAttribute("data-radar-mode");
    if (radarMode === "both" || radarMode === "body" || radarMode === "weapon") {
      composer.radarMode = radarMode;
      syncUi(true);
    }

    const loadChampion = target.getAttribute("data-champion-load");
    if (loadChampion) {
      loadChampionIntoComposer(loadChampion);
      syncUi(true);
    }

    const sendRed = target.getAttribute("data-send-red");
    if (sendRed) {
      prepareUnitForFaction(sendRed, "red");
      syncUi(true);
    }

    const sendBlue = target.getAttribute("data-send-blue");
    if (sendBlue) {
      prepareUnitForFaction(sendBlue, "blue");
      syncUi(true);
    }

    const favoriteUnit = target.getAttribute("data-favorite-unit");
    if (favoriteUnit) {
      toggleFavorite(favoriteUnit);
      syncUi(true);
    }
  });

  appRoot.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement) && !(target instanceof HTMLInputElement)) return;

    if (target instanceof HTMLSelectElement && target.id === "speed") {
      state.speed = Number(target.value);
      syncUi(true);
      return;
    }

    updateComposerWithBudgetGuard(target);
    refreshComposerPreview();
  });

  appRoot.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    updateComposerWithBudgetGuard(target);
    refreshComposerPreview();
  });
}

function updateComposerWithBudgetGuard(target: HTMLInputElement | HTMLSelectElement): void {
  const before = cloneComposer(composer);
  const beforeUnit = createPreviewUnit(before);
  updateComposerFromElement(target);
  const afterUnit = createPreviewUnit(composer);
  const changedNumber = target instanceof HTMLInputElement ? target.dataset.composeNumber : undefined;
  const isBudgetChange = changedNumber === "budget";
  const isFreeText = target.id === "compose-name" || target.id === "compose-faction" || target.id === "compose-role";
  if (!isBudgetChange && !isFreeText && beforeUnit.cost <= before.budget && afterUnit.cost > composer.budget) {
    const keepMode = { editMode: composer.editMode, radarMode: composer.radarMode };
    composer = { ...before, ...keepMode };
  }
}

function cloneComposer(source: ComposerState): ComposerState {
  return {
    ...source,
    traits: { ...source.traits }
  };
}

function syncUi(force = false): void {
  const now = performance.now();
  if (!force && now - lastUiSync < 250) return;
  lastUiSync = now;
  const hudScroll = hudPanel.scrollTop;
  const squadWasOpen = hudPanel.querySelector<HTMLDetailsElement>(".squad-config")?.open ?? true;
  const activeId = document.activeElement instanceof HTMLElement ? document.activeElement.id : "";
  previewUnit = createPreviewUnit(composer);
  syncBattleStatus(state);
  updateHallOfFameFromWinner();
  if (force) {
    hudPanel.innerHTML = renderHud(state).replace("</aside>", `${renderComposerPanel(composer, previewUnit)}</aside>`);
    const squad = hudPanel.querySelector<HTMLDetailsElement>(".squad-config");
    if (squad) squad.open = squadWasOpen;
    hudPanel.scrollTop = hudScroll;
    if (activeId) {
      const nextActive = hudPanel.querySelector<HTMLElement>(`#${CSS.escape(activeId)}`);
      nextActive?.focus({ preventScroll: true });
    }
  }
  battleStatusPanel.innerHTML = renderBattleStatus(state);
  logPanel.innerHTML = renderBattleCards(state.battleCards, state.log);
  if (force) {
    const openRows = new Set(
      Array.from(inventedPanel.querySelectorAll<HTMLDetailsElement>("details.champion-row[open]"))
        .map((row) => row.dataset.rowId)
        .filter(Boolean)
    );
    inventedPanel.innerHTML = renderHallOfFame();
    for (const row of inventedPanel.querySelectorAll<HTMLDetailsElement>("details.champion-row")) {
      if (row.dataset.rowId && openRows.has(row.dataset.rowId)) row.open = true;
    }
  }
  favoritesPanel.innerHTML = renderFavorites();
  forcesPanel.innerHTML = renderForces(state.activeDesign, preparedForces, currentBattle(), favoriteIds());
  syncMapControls();
}

function currentBattle() {
  return state.battleCards.find((card) => card.id === state.currentBattleId) ?? state.battleCards[0];
}

function syncMapControls(): void {
  const toggle = document.querySelector<HTMLButtonElement>("#toggle");
  const speed = document.querySelector<HTMLSelectElement>("#speed");
  if (toggle) toggle.textContent = state.running ? "Pause" : "Demarrer";
  if (speed && speed.value !== String(state.speed)) speed.value = String(state.speed);
}

function createDefaultComposer(): ComposerState {
  return {
    faction: "red",
    name: "Prototype tactique",
    role: "raider",
    hp: 54,
    damage: 13,
    range: 4.2,
    attackRate: 1.1,
    speed: 5.6,
    armor: 1.2,
    vision: 6.5,
    buildTime: 4.2,
    budget: 900,
    weaponId: "kinetic",
    editMode: "body",
    radarMode: "both",
    weaponDamage: 15,
    weaponRange: 4.2,
    weaponAttackRate: 1.05,
    weaponArmorPiercing: 0.08,
    weaponAreaRadius: 0,
    weaponTracking: 0.45,
    traits: {
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
      mining: false,
      slow: false
    }
  };
}

function createPreviewUnit(source: ComposerState): UnitDefinition {
  const weapon = createConfiguredWeapon(source.weaponId, {
    damage: source.weaponDamage,
    range: source.weaponRange,
    attackRate: source.weaponAttackRate,
    armorPiercing: source.weaponArmorPiercing,
    areaRadius: source.weaponAreaRadius,
    tracking: source.weaponTracking
  });
  return createUnitDefinition({
    id: `manual_preview_${source.faction}`,
    name: source.name.trim() || "Prototype sans nom",
    faction: source.faction,
    role: source.role,
    stats: {
      hp: source.hp,
      damage: source.damage,
      range: source.range,
      attackRate: source.attackRate,
      speed: source.speed,
      armor: source.armor,
      vision: source.vision
    },
    traits: source.traits,
    weapon
  });
}

function updateComposerFromElement(target: HTMLInputElement | HTMLSelectElement): void {
  if (target.id === "compose-name" && target instanceof HTMLInputElement) {
    composer.name = target.value;
    return;
  }
  if (target.id === "compose-faction" && target instanceof HTMLSelectElement) {
    composer.faction = target.value as Faction;
    return;
  }
  if (target.id === "compose-role" && target instanceof HTMLSelectElement) {
    composer.role = target.value as UnitRole;
    return;
  }
  if (target.id === "compose-weapon" && target instanceof HTMLSelectElement) {
    composer.weaponId = target.value;
    const weapon = getWeapon(target.value);
    composer.weaponDamage = weapon.damage;
    composer.weaponRange = weapon.range;
    composer.weaponAttackRate = weapon.attackRate;
    composer.weaponArmorPiercing = weapon.armorPiercing;
    composer.weaponAreaRadius = weapon.areaRadius;
    composer.weaponTracking = weapon.tracking;
    return;
  }

  if (target instanceof HTMLInputElement && target.dataset.composeNumber) {
    const key = target.dataset.composeNumber as keyof Omit<ComposerState, "faction" | "name" | "role" | "traits" | "weaponId" | "editMode" | "radarMode">;
    composer[key] = Number(target.value);
  }

  if (target instanceof HTMLInputElement && target.dataset.composeTrait) {
    const key = target.dataset.composeTrait as keyof ComposerState["traits"];
    composer.traits[key] = target.checked;
  }
}

function refreshComposerPreview(): void {
  previewUnit = createPreviewUnit(composer);
  const cost = calculateUnitCost(previewUnit);
  const preview = document.querySelector<HTMLElement>("#composer-preview-svg");
  const radar = document.querySelector<HTMLElement>("#composer-radar");
  const weaponPreview = document.querySelector<HTMLElement>("#composer-weapon-svg");
  const costValue = document.querySelector<HTMLElement>("#composer-cost-value");
  const costDetail = document.querySelector<HTMLElement>("#composer-cost-detail");
  const weaponDetail = document.querySelector<HTMLElement>("#composer-weapon-detail");
  const prepareRed = document.querySelector<HTMLButtonElement>("#prepare-red");
  const prepareBlue = document.querySelector<HTMLButtonElement>("#prepare-blue");

  if (preview) preview.innerHTML = renderUnitSvg(previewUnit, 104);
  if (radar) {
    radar.innerHTML = `
      <div class="composer-radar-head">
        <span>Signature</span>
        <div class="mini-tabs">
          <button data-radar-mode="both" class="${composer.radarMode === "both" ? "active" : ""}">Mix</button>
          <button data-radar-mode="body" class="${composer.radarMode === "body" ? "active" : ""}">Corps</button>
          <button data-radar-mode="weapon" class="${composer.radarMode === "weapon" ? "active" : ""}">Arme</button>
        </div>
      </div>
      ${renderCombinedRadar(previewUnit, 270, composer.radarMode)}
    `;
  }
  if (weaponPreview) weaponPreview.innerHTML = renderWeaponSvg(previewUnit.weapon, 86);
  if (costValue) costValue.textContent = String(previewUnit.cost);
  if (costDetail) {
    costDetail.innerHTML = `${budgetLineLocal(composer.budget, previewUnit.cost)}<br/>corps ${Math.round(cost.statCost)} | arme ${Math.round(previewUnit.weapon.cost)} | traits ${Math.round(cost.traitCost)} | synergie ${Math.round(cost.synergyPenalty)}`;
  }
  document.querySelector<HTMLElement>(".composer-cost-top")?.classList.toggle("over-budget", previewUnit.cost > composer.budget);
  if (weaponDetail) {
    weaponDetail.textContent = `Arme : ${previewUnit.weapon.name} | degats ${previewUnit.weapon.damage} | portee ${previewUnit.weapon.range} | cadence ${previewUnit.weapon.attackRate} | percage ${Math.round(previewUnit.weapon.armorPiercing * 100)}% | zone ${previewUnit.weapon.areaRadius}`;
  }

  for (const button of [prepareRed, prepareBlue]) {
    if (!button) continue;
    button.disabled = previewUnit.cost > composer.budget;
    button.textContent = previewUnit.cost > composer.budget ? "Budget insuffisant" : button.id === "prepare-red" ? "Send RED" : "Send BLUE";
  }

  for (const value of document.querySelectorAll<HTMLElement>("[data-compose-value]")) {
    const key = value.dataset.composeValue as keyof Omit<ComposerState, "faction" | "name" | "role" | "traits" | "weaponId" | "editMode" | "radarMode">;
    const raw = composer[key];
    value.textContent = Number(raw).toFixed(key === "hp" || key === "weaponDamage" || key === "weaponAreaRadius" || key === "budget" ? 0 : key === "weaponArmorPiercing" || key === "weaponTracking" || key === "weaponAttackRate" ? 2 : 1);
  }
}

function budgetLineLocal(budget: number, cost: number): string {
  const quantity = Math.floor(budget / cost);
  const remainder = budget - quantity * cost;
  if (quantity < 1) return `credit ${budget} | hors budget`;
  return `credit ${budget} | ${quantity} unite${quantity > 1 ? "s" : ""} | reste ${remainder}`;
}

function makeComposedUnit(faction = composer.faction): UnitDefinition {
  const weapon = createConfiguredWeapon(composer.weaponId, {
    damage: composer.weaponDamage,
    range: composer.weaponRange,
    attackRate: composer.weaponAttackRate,
    armorPiercing: composer.weaponArmorPiercing,
    areaRadius: composer.weaponAreaRadius,
    tracking: composer.weaponTracking
  });
  return createUnitDefinition({
    id: `manual_${faction}_${Date.now()}`,
    name: composer.name.trim() || "Prototype sans nom",
    faction,
    role: composer.role,
    stats: {
      hp: composer.hp,
      damage: composer.damage,
      range: composer.range,
      attackRate: composer.attackRate,
      speed: composer.speed,
      armor: composer.armor,
      vision: composer.vision
    },
    traits: composer.traits,
    weapon
  });
}

function prepareComposedUnit(faction = composer.faction): void {
  const unit = makeComposedUnit(faction);
  if (unit.cost > composer.budget) {
    addBattleLog(
      state,
      `${faction === "red" ? "Rouge" : "Bleu"} refuse : ${unit.name} | cout ${unit.cost} > credit ${composer.budget}`,
      faction
    );
    return;
  }

  preparedForces[faction] = {
    unit,
    budget: composer.budget
  };
  state.activeDesign[faction] = unit;
  state.inventedUnits[faction].unshift(unit);
  state.inventedUnits[faction] = state.inventedUnits[faction].slice(0, 12);
  addBattleLog(state, `${faction === "red" ? "Rouge" : "Bleu"} prepare : ${unit.name}`, faction);
}

function findChampion(id: string): UnitDefinition | undefined {
  const records = [...state.memories.red.championUnits, ...state.memories.blue.championUnits];
  const champion = records.find((record) => record.id === id)?.unit;
  if (champion) return champion;
  const hall = hallOfFame.find((entry) => entry.id === id)?.unit;
  if (hall) return hall;
  const favorite = favoriteUnits.find((unit) => unit.id === id);
  if (favorite) return favorite;
  const battleUnit = state.battleCards
    .flatMap((card) => [card.redUnit, card.blueUnit])
    .find((unit) => unit.id === id);
  if (battleUnit) return battleUnit;
  return [...state.inventedUnits.red, ...state.inventedUnits.blue].find((unit) => unit.id === id);
}

function toggleFavorite(id: string): void {
  const unit = findChampion(id);
  if (!unit) return;
  const index = favoriteUnits.findIndex((favorite) => favoriteKey(favorite) === favoriteKey(unit));
  if (index >= 0) {
    favoriteUnits.splice(index, 1);
  } else {
    favoriteUnits.unshift(unit);
    favoriteUnits = favoriteUnits.slice(0, 24);
  }
  saveFavorites();
}

function favoriteIds(): Set<string> {
  return new Set(favoriteUnits.map((unit) => unit.id));
}

function loadChampionIntoComposer(id: string): void {
  const unit = findChampion(id);
  if (!unit) return;
  composer = {
    ...composer,
    faction: unit.faction,
    name: `${unit.name} mod`,
    role: unit.role,
    hp: unit.stats.hp,
    damage: unit.stats.damage,
    range: unit.stats.range,
    attackRate: unit.stats.attackRate,
    speed: unit.stats.speed,
    armor: unit.stats.armor,
    vision: unit.stats.vision,
    buildTime: unit.buildTime,
    weaponId: baseWeaponId(unit.weapon),
    editMode: composer.editMode,
    radarMode: composer.radarMode,
    weaponDamage: unit.weapon?.damage ?? getWeapon("kinetic").damage,
    weaponRange: unit.weapon?.range ?? getWeapon("kinetic").range,
    weaponAttackRate: unit.weapon?.attackRate ?? getWeapon("kinetic").attackRate,
    weaponArmorPiercing: unit.weapon?.armorPiercing ?? getWeapon("kinetic").armorPiercing,
    weaponAreaRadius: unit.weapon?.areaRadius ?? getWeapon("kinetic").areaRadius,
    weaponTracking: unit.weapon?.tracking ?? getWeapon("kinetic").tracking,
    budget: Math.max(composer.budget, unit.cost),
    traits: {
      stealth: unit.traits.stealth,
      detector: unit.traits.detector,
      flying: unit.traits.flying,
      areaDamage: unit.traits.areaDamage,
      regeneration: unit.traits.regeneration,
      repair: unit.traits.repair,
      builder: unit.traits.builder,
      suicide: unit.traits.suicide,
      jammer: unit.traits.jammer,
      decoy: unit.traits.decoy,
      mining: Boolean(unit.traits.mining),
      slow: Boolean(unit.traits.slow)
    }
  };
}

function prepareUnitForFaction(id: string, faction: Faction): void {
  const unit = findChampion(id);
  if (!unit) return;
  const copy = createUnitDefinition({
    id: `${unit.id}_${faction}_copy`,
    name: unit.name,
    faction,
    role: unit.role,
    stats: unit.stats,
    traits: unit.traits,
    buildTime: unit.buildTime,
    weapon: unit.weapon ?? getWeapon("kinetic")
  });
  preparedForces[faction] = {
    unit: copy,
    budget: Math.max(composer.budget, unit.cost)
  };
  state.activeDesign[faction] = copy;
  addBattleLog(state, `${faction === "red" ? "Rouge" : "Bleu"} charge collection : ${copy.name}`, faction);
}

function updateHallOfFameFromWinner(): void {
  if (!state.winner || state.winner === lastHallWinner) return;
  lastHallWinner = state.winner;
  const winner = state.activeDesign[state.winner];
  const loserFaction = state.winner === "red" ? "blue" : "red";
  const loser = state.activeDesign[loserFaction];
  const loserRank = hallOfFame.findIndex((entry) => entry.unit.name === loser.name && entry.unit.faction === loser.faction);
  const upsetPrestige = loserRank >= 0 ? Math.max(1, 10 - loserRank) : 0;
  const existing = hallOfFame.find((entry) => entry.unit.name === winner.name && entry.unit.faction === winner.faction);
  if (existing) {
    existing.wins += 1;
    existing.unit = winner;
    existing.nemesis = loser.name;
    existing.prestige = (existing.prestige ?? 0) + upsetPrestige;
  } else {
    hallOfFame.push({ id: winner.id, unit: winner, wins: 1, losses: 0, nemesis: loser.name, prestige: upsetPrestige });
  }
  const loserEntry = hallOfFame.find((entry) => entry.unit.name === loser.name && entry.unit.faction === loser.faction);
  if (loserEntry) loserEntry.losses += 1;
  hallOfFame = hallOfFame
    .sort((a, b) => scoreHall(b) - scoreHall(a))
    .slice(0, 10);
  const winnerEntry = hallOfFame.find((entry) => entry.unit.name === winner.name && entry.unit.faction === winner.faction);
  if (!winnerEntry && upsetPrestige > 0) {
    hallOfFame[hallOfFame.length - 1] = { id: winner.id, unit: winner, wins: 1, losses: 0, nemesis: loser.name, prestige: upsetPrestige };
    hallOfFame = hallOfFame.sort((a, b) => scoreHall(b) - scoreHall(a)).slice(0, 10);
  }
  saveHallOfFame();
}

function scoreHall(entry: HallEntry): number {
  const ratio = entry.wins / Math.max(1, entry.wins + entry.losses);
  return entry.wins * 120 + ratio * 120 + (entry.prestige ?? 0) * 90;
}

function renderHallOfFame(): string {
  if (hallOfFame.length === 0) return `<div class="unit-row"><p class="subtle">Aucun champion persistant.</p></div>`;
  return hallOfFame
    .map((entry, index) => `
      <details class="unit-row champion-row" data-row-id="${entry.id}">
        <summary>
          <div class="unit-identity">${renderUnitSvg(entry.unit, 50)}<div><strong>#${index + 1} ${entry.unit.name}</strong><p class="subtle">W ${entry.wins} / L ${entry.losses} | nemesis ${entry.nemesis ?? "-"}</p></div></div>
          <span>${entry.unit.cost}</span>
        </summary>
        <div class="unit-detail">Score ${Math.round(scoreHall(entry))} · prestige ${entry.prestige ?? 0} · ${entry.unit.role}</div>
        ${renderCombinedRadar(entry.unit, 178, "both")}
        <div class="weapon-mini">${renderWeaponSvg(unitWeapon(entry.unit), 58)}<span>${weaponSummary(entry.unit)}</span></div>
        <div class="champion-actions">
          <button data-champion-load="${entry.id}">Charger</button>
          <button data-favorite-unit="${entry.id}">${favoriteIds().has(entry.unit.id) ? "Favori -" : "Favori +"}</button>
          <button data-send-red="${entry.id}">Send RED</button>
          <button data-send-blue="${entry.id}">Send BLUE</button>
        </div>
      </details>
    `)
    .join("");
}

function loadHallOfFame(): HallEntry[] {
  try {
    const raw = localStorage.getItem("doctrine_hall_of_fame");
    if (!raw) return [];
    return (JSON.parse(raw) as HallEntry[]).map((entry) => ({ ...entry, prestige: entry.prestige ?? 0 }));
  } catch {
    return [];
  }
}

function saveHallOfFame(): void {
  localStorage.setItem("doctrine_hall_of_fame", JSON.stringify(hallOfFame));
}

function renderFavorites(): string {
  if (favoriteUnits.length === 0) return `<div class="unit-row"><p class="subtle">Aucun favori pour l'instant.</p></div>`;
  return favoriteUnits
    .map((unit) => `
      <details class="unit-row champion-row" data-row-id="${unit.id}">
        <summary>
          <div class="unit-identity">${renderUnitSvg(unit, 50)}<div><strong>${unit.name}</strong><p class="subtle">${unit.faction === "red" ? "Rouge" : "Bleu"} | cout ${unit.cost}</p></div></div>
          <span>${unit.cost}</span>
        </summary>
        <div class="unit-detail">${unit.role} · PV ${Math.round(unit.stats.hp)} · D ${Math.round(unit.stats.damage)} · R ${unit.stats.range.toFixed(1)} · Arm ${unit.stats.armor.toFixed(1)}</div>
        ${renderCombinedRadar(unit, 178, "both")}
        <div class="weapon-mini">${renderWeaponSvg(unitWeapon(unit), 58)}<span>${weaponSummary(unit)}</span></div>
        <div class="champion-actions">
          <button data-champion-load="${unit.id}">Charger</button>
          <button data-favorite-unit="${unit.id}">Favori -</button>
          <button data-send-red="${unit.id}">Send RED</button>
          <button data-send-blue="${unit.id}">Send BLUE</button>
        </div>
      </details>
    `)
    .join("");
}

function loadFavorites(): UnitDefinition[] {
  try {
    const raw = localStorage.getItem("doctrine_favorites");
    if (!raw) return [];
    return JSON.parse(raw) as UnitDefinition[];
  } catch {
    return [];
  }
}

function saveFavorites(): void {
  localStorage.setItem("doctrine_favorites", JSON.stringify(favoriteUnits));
}

function favoriteKey(unit: UnitDefinition): string {
  return `${unit.name}_${unit.cost}_${unit.role}_${Math.round(unit.stats.hp)}_${Math.round(unit.stats.damage)}_${unit.stats.range.toFixed(1)}_${unit.stats.armor.toFixed(1)}_${Object.entries(unit.traits).filter(([, enabled]) => enabled).map(([trait]) => trait).join("-")}`;
}

function unitWeapon(unit: UnitDefinition): WeaponDefinition {
  return unit.weapon ?? getWeapon("kinetic");
}

function baseWeaponId(weapon?: WeaponDefinition): string {
  if (!weapon) return "kinetic";
  const exact = getWeapon(weapon.id);
  if (exact.id === weapon.id) return weapon.id;
  const prefix = weapon.id.split("_custom_")[0];
  return getWeapon(prefix).id;
}

function weaponSummary(unit: UnitDefinition): string {
  const weapon = unitWeapon(unit);
  return `${weapon.name} | D${Math.round(weapon.damage)} R${weapon.range.toFixed(1)} C${weapon.attackRate.toFixed(2)} AP${Math.round(weapon.armorPiercing * 100)}%`;
}

function launchPreparedBattle(): void {
  const preparedUnits: Partial<Record<Faction, UnitDefinition>> = {
    red: preparedForces.red?.unit,
    blue: preparedForces.blue?.unit
  };
  const budgets: Partial<Record<Faction, number>> = {
    red: preparedForces.red?.budget,
    blue: preparedForces.blue?.budget
  };

  if (!preparedUnits.red && !preparedUnits.blue) {
    startAiBattle(state);
    lastReportedWinner = undefined;
    lastHallWinner = undefined;
    autoAdvanceAt = 0;
    return;
  }

  const result = startPreparedBattle(state, preparedUnits, budgets);
  lastHallWinner = undefined;
  addBattleLog(
    state,
    `Combat prepare lance | Rouge ${result.redQuantity} unite${result.redQuantity > 1 ? "s" : ""} | Bleu ${result.blueQuantity} unite${result.blueQuantity > 1 ? "s" : ""}`
  );
  preparedForces = {};
  lastReportedWinner = undefined;
  autoAdvanceAt = 0;
}

function hasPreparedForces(): boolean {
  return Boolean(preparedForces.red || preparedForces.blue);
}

function loop(now: number): void {
  frameScheduled = false;
  lastFrameAt = now;
  const dt = (now - last) / 1000;
  last = now;
  updateSimulation(state, dt);
  syncBattleStatus(state);
  renderer.syncHover(state);
  renderer.render(state);

  if (state.winner && autoGenerationsRemaining > 0) {
    updateHallOfFameFromWinner();
    if (autoAdvanceAt === 0) {
      autoAdvanceAt = now + 1700;
      lastReportedWinner = state.winner;
      syncUi(true);
    }
    if (now < autoAdvanceAt) {
      syncUi();
      scheduleFrame();
      return;
    }
    autoGenerationsRemaining -= 1;
    autoAdvanceAt = 0;
    resetBattleForNextGeneration(state);
    startAiBattle(state);
    lastReportedWinner = undefined;
    lastHallWinner = undefined;
    syncUi(true);
  } else if (state.winner && state.winner !== lastReportedWinner) {
    lastReportedWinner = state.winner;
    syncUi(true);
  }

  syncUi();
  scheduleFrame();
}

function scheduleFrame(): void {
  if (frameScheduled) return;
  frameScheduled = true;
  requestAnimationFrame(loop);
}

bindControls();
syncUi(true);
renderer.render(state);
scheduleFrame();
window.setInterval(() => {
  if (performance.now() - lastFrameAt > 600) {
    last = performance.now();
    loop(last);
  }
}, 500);
