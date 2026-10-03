import {
  BASE_HP,
  BASE_PRODUCTION_INTERVAL,
  STARTING_RESOURCES,
  TACTICAL_WAVE_INTERVAL,
  WORLD_SCALE
} from "./constants";
import { canDetect, computeDamage, distance, moveToward, rangePixels } from "./combat";
import { createEconomy, updateEconomy } from "./economy";
import { createDefaultMap } from "./map";
import type { BattleLogEntry, BaseState, Faction, RuntimeUnit, SimulationState, UnitDefinition, Vector2 } from "./types";
import { createInitialAi, designOpeningUnit, evolveAfterMatch } from "../ai/aiPlayer";

let unitSeq = 0;
let projectileSeq = 0;
let battleSeq = 0;
const AI_BATTLE_BUDGET = 900;

export function createSimulation(): SimulationState {
  const map = createDefaultMap();
  const redMemory = createInitialAi("red", "rush");
  const blueMemory = createInitialAi("blue", "turtle");
  const redUnit = designOpeningUnit("red", redMemory.currentDoctrine, 1);
  const blueUnit = designOpeningUnit("blue", blueMemory.currentDoctrine, 1);

  const state: SimulationState = {
    generation: 1,
    elapsed: 0,
    running: false,
    speed: 1,
    mode: "ai-lab",
    map,
    bases: {
      red: createBase("red", map.redBase),
      blue: createBase("blue", map.blueBase)
    },
    units: [],
    projectiles: [],
    economy: createEconomy(STARTING_RESOURCES),
    waveSize: {
      red: 1,
      blue: 1
    },
    inventedUnits: {
      red: [redUnit],
      blue: [blueUnit]
    },
    activeDesign: {
      red: redUnit,
      blue: blueUnit
    },
    memories: {
      red: redMemory,
      blue: blueMemory
    },
    log: [],
    battleCards: []
  };

  log(state, `Generation 1`);
  log(state, `Rouge invente : ${redUnit.name} | Doctrine : ${redMemory.currentDoctrine}`, "red");
  log(state, `Bleu invente : ${blueUnit.name} | Doctrine : ${blueMemory.currentDoctrine}`, "blue");
  return state;
}

export function resetBattleForNextGeneration(state: SimulationState): void {
  const previousWinner = state.winner;
  const previousRed = state.activeDesign.red;
  const previousBlue = state.activeDesign.blue;
  state.generation += 1;
  state.elapsed = 0;
  state.winner = undefined;
  state.units = [];
  state.projectiles = [];
  state.economy = createEconomy(STARTING_RESOURCES);
  state.bases.red = createBase("red", state.map.redBase);
  state.bases.blue = createBase("blue", state.map.blueBase);
  state.mode = "ai-lab";

  const redNext = previousWinner === "red" ? previousRed : evolveAfterMatch("red", state.memories.red, previousWinner, previousBlue, state.generation);
  const blueNext = previousWinner === "blue" ? previousBlue : evolveAfterMatch("blue", state.memories.blue, previousWinner, previousRed, state.generation);
  state.activeDesign.red = redNext;
  state.activeDesign.blue = blueNext;
  state.inventedUnits.red.unshift(redNext);
  state.inventedUnits.blue.unshift(blueNext);
  state.inventedUnits.red = state.inventedUnits.red.slice(0, 12);
  state.inventedUnits.blue = state.inventedUnits.blue.slice(0, 12);

  log(state, `Generation ${state.generation}`);
  log(state, previousWinner === "red" ? `Rouge conserve : ${redNext.name}` : `Rouge invente : ${redNext.name} | Doctrine : ${state.memories.red.currentDoctrine}`, "red");
  log(state, previousWinner === "blue" ? `Bleu conserve : ${blueNext.name}` : `Bleu invente : ${blueNext.name} | Doctrine : ${state.memories.blue.currentDoctrine}`, "blue");
  createBattleCard(state, "ai-lab", redNext, blueNext, 0, 0, `Generation ${state.generation} : ${previousWinner ? `${labelFaction(previousWinner)} defend son champion` : "nouvelle confrontation"}`);
}

export function deployDesignedSquad(state: SimulationState, definition: UnitDefinition, budget: number): number {
  const quantity = Math.floor(budget / definition.cost);
  if (quantity < 1) return 0;

  state.activeDesign[definition.faction] = definition;
  state.units = state.units.filter((unit) => unit.faction !== definition.faction);
  state.waveSize[definition.faction] = quantity;
  state.economy.resources[definition.faction] = budget;
  state.bases[definition.faction].buildQueueTimer = TACTICAL_WAVE_INTERVAL;

  for (let i = 0; i < quantity; i += 1) {
    spawnUnit(state, definition);
  }

  return quantity;
}

export function startAiBattle(state: SimulationState): void {
  resetArena(state);
  state.mode = "ai-lab";
  state.winner = undefined;
  if (state.activeDesign.red.cost > AI_BATTLE_BUDGET) {
    state.activeDesign.red = designOpeningUnit("red", "swarm", state.generation + 1);
  }
  if (state.activeDesign.blue.cost > AI_BATTLE_BUDGET) {
    state.activeDesign.blue = designOpeningUnit("blue", "swarm", state.generation + 1);
  }
  const redQuantity = deployDesignedSquad(state, state.activeDesign.red, AI_BATTLE_BUDGET);
  const blueQuantity = deployDesignedSquad(state, state.activeDesign.blue, AI_BATTLE_BUDGET);
  createBattleCard(state, "ai-lab", state.activeDesign.red, state.activeDesign.blue, redQuantity, blueQuantity, `Generation ${state.generation} : test IA`);
  state.running = true;
}

export function startHumanChallenge(state: SimulationState, humanUnit: UnitDefinition, budget: number): { humanQuantity: number; aiQuantity: number; aiUnit: UnitDefinition } {
  const humanFaction = humanUnit.faction;
  const aiFaction = humanFaction === "red" ? "blue" : "red";
  resetArena(state);
  state.mode = "human-vs-ai";
  state.winner = undefined;
  state.activeDesign[humanFaction] = humanUnit;
  const aiUnit = evolveAfterMatch(aiFaction, state.memories[aiFaction], humanFaction, humanUnit, state.generation + 1);
  const affordableAiUnit = aiUnit.cost <= budget ? aiUnit : designOpeningUnit(aiFaction, "swarm", state.generation + 1);
  state.activeDesign[aiFaction] = affordableAiUnit;
  state.inventedUnits[aiFaction].unshift(affordableAiUnit);
  state.inventedUnits[aiFaction] = state.inventedUnits[aiFaction].slice(0, 12);
  const humanQuantity = deployDesignedSquad(state, humanUnit, budget);
  const aiQuantity = deployDesignedSquad(state, affordableAiUnit, budget);
  createBattleCard(
    state,
    "human-vs-ai",
    state.activeDesign.red,
    state.activeDesign.blue,
    state.activeDesign.red.faction === humanFaction ? humanQuantity : aiQuantity,
    state.activeDesign.blue.faction === humanFaction ? humanQuantity : aiQuantity,
    `Test humain : ${labelFaction(humanFaction)} provoque l'IA ${labelFaction(aiFaction)}`
  );
  state.running = humanQuantity > 0 && aiQuantity > 0;
  return { humanQuantity, aiQuantity, aiUnit: affordableAiUnit };
}

export function startPreparedBattle(
  state: SimulationState,
  prepared: Partial<Record<Faction, UnitDefinition>>,
  budgets: Partial<Record<Faction, number>>
): { redQuantity: number; blueQuantity: number } {
  const redUnit = prepared.red ?? evolveAfterMatch("red", state.memories.red, "blue", prepared.blue ?? state.activeDesign.blue, state.generation + 1);
  const blueUnit = prepared.blue ?? evolveAfterMatch("blue", state.memories.blue, "red", prepared.red ?? state.activeDesign.red, state.generation + 1);

  resetArena(state);
  state.mode = prepared.red && prepared.blue ? "human-vs-ai" : "human-vs-ai";
  state.winner = undefined;
  state.activeDesign.red = redUnit;
  state.activeDesign.blue = blueUnit;

  if (!prepared.red) {
    state.inventedUnits.red.unshift(redUnit);
    state.inventedUnits.red = state.inventedUnits.red.slice(0, 12);
  }
  if (!prepared.blue) {
    state.inventedUnits.blue.unshift(blueUnit);
    state.inventedUnits.blue = state.inventedUnits.blue.slice(0, 12);
  }

  const redBudget = budgets.red ?? budgets.blue ?? AI_BATTLE_BUDGET;
  const blueBudget = budgets.blue ?? budgets.red ?? AI_BATTLE_BUDGET;
  const redQuantity = deployDesignedSquad(state, redUnit, redBudget);
  const blueQuantity = deployDesignedSquad(state, blueUnit, blueBudget);
  createBattleCard(
    state,
    "human-vs-ai",
    redUnit,
    blueUnit,
    redQuantity,
    blueQuantity,
    prepared.red && prepared.blue ? "Test manuel : deux doctrines injectees" : "Test humain : l'IA complete le camp manquant"
  );
  state.running = redQuantity > 0 && blueQuantity > 0;
  return { redQuantity, blueQuantity };
}

export function updateSimulation(state: SimulationState, frameDt: number): void {
  if (!state.running || state.winner) return;
  const dt = Math.min(0.08, frameDt) * state.speed;
  state.elapsed += dt;
  updateEconomy(state, dt);
  produceUnits(state, dt);
  updateUnits(state, dt);
  updateProjectiles(state, dt);
  checkVictory(state);
  syncBattleStatus(state);
}

export function forceResolveBattle(state: SimulationState): Faction | undefined {
  if (state.winner) return state.winner;
  if (!state.currentBattleId) return undefined;
  const redPower = state.bases.red.hp + state.units.filter((unit) => unit.faction === "red").reduce((total, unit) => total + unit.hp, 0);
  const bluePower = state.bases.blue.hp + state.units.filter((unit) => unit.faction === "blue").reduce((total, unit) => total + unit.hp, 0);
  const winner = redPower >= bluePower ? "red" : "blue";
  endBattle(state, winner);
  log(state, `Arbitrage manuel : ${winner === "red" ? "Rouge" : "Bleu"} gagne aux points`, winner);
  return winner;
}

function createBase(faction: Faction, position: Vector2): BaseState {
  return {
    faction,
    position: { ...position },
    hp: BASE_HP,
    maxHp: BASE_HP,
    buildQueueTimer: 0
  };
}

function resetArena(state: SimulationState): void {
  state.elapsed = 0;
  state.units = [];
  state.projectiles = [];
  state.economy = createEconomy(STARTING_RESOURCES);
  state.waveSize = { red: 1, blue: 1 };
  state.bases.red = createBase("red", state.map.redBase);
  state.bases.blue = createBase("blue", state.map.blueBase);
}

function produceUnits(state: SimulationState, dt: number): void {
  accelerateMiningSpawns(state, dt);
  for (const faction of ["red", "blue"] as Faction[]) {
    const base = state.bases[faction];
    const definition = state.activeDesign[faction];

    base.buildQueueTimer -= dt;
    if (base.buildQueueTimer > 0) continue;

    base.buildQueueTimer = Math.max(BASE_PRODUCTION_INTERVAL, TACTICAL_WAVE_INTERVAL);
    const quantity = Math.max(1, state.waveSize[faction]);
    for (let i = 0; i < quantity; i += 1) {
      spawnUnit(state, definition);
    }
  }
}

function accelerateMiningSpawns(state: SimulationState, dt: number): void {
  for (const faction of ["red", "blue"] as Faction[]) {
    const hasMinerAtCenter = state.units.some(
      (unit) =>
        unit.faction === faction &&
        unit.definition.traits.mining &&
        distance(unit.position, state.map.resourceZone.position) < state.map.resourceZone.radius
    );
    if (hasMinerAtCenter) state.bases[faction].buildQueueTimer -= dt * 0.55;
  }
}

function spawnUnit(state: SimulationState, definition: UnitDefinition): void {
  const base = state.bases[definition.faction];
  const direction = definition.faction === "red" ? 1 : -1;
  const offset = state.units.filter((unit) => unit.faction === definition.faction).length % 8;
  const unit: RuntimeUnit = {
    id: `u_${++unitSeq}`,
    definition,
    faction: definition.faction,
    position: {
      x: base.position.x + direction * 42,
      y: base.position.y + (offset - 3.5) * 16
    },
    targetPosition: definition.faction === "red" ? state.bases.blue.position : state.bases.red.position,
    hp: definition.stats.hp,
    cooldown: Math.random() * 0.4,
    state: "moving",
    selected: false
  };
  state.units.push(unit);
}

function updateUnits(state: SimulationState, dt: number): void {
  for (const unit of state.units) {
    if (unit.definition.traits.regeneration) {
      unit.hp = Math.min(unit.definition.stats.hp, unit.hp + dt * 1.6);
    }

    unit.cooldown = Math.max(0, unit.cooldown - dt);
    if (tryRepair(state, unit, dt)) continue;
    const target = findTarget(state, unit);
    if (target) {
      unit.state = "attacking";
      unit.targetPosition = target.position;
      if (unit.cooldown <= 0) {
        attackUnit(state, unit, target);
      }
    } else {
      const enemyBase = state.bases[unit.faction === "red" ? "blue" : "red"];
      const baseDistance = distance(unit.position, enemyBase.position);
      if (baseDistance <= rangePixels(unit.definition) + 34 && unit.cooldown <= 0) {
        attackBase(state, unit, enemyBase.faction);
      } else {
        unit.state = "moving";
        unit.targetPosition = enemyBase.position;
        unit.position = moveToward(unit.position, unit.targetPosition, effectiveSpeed(unit, state.elapsed), dt);
      }
    }
  }

  state.units = state.units.filter((unit) => unit.hp > 0);
}

function tryRepair(state: SimulationState, unit: RuntimeUnit, dt: number): boolean {
  if (!unit.definition.traits.repair && !unit.definition.traits.builder) return false;
  const repairRadius = Math.max(72, unit.definition.stats.vision * WORLD_SCALE * 0.55);
  const ally = state.units
    .filter((candidate) => candidate.faction === unit.faction && candidate.id !== unit.id && candidate.hp < candidate.definition.stats.hp)
    .map((candidate) => ({ candidate, dist: distance(unit.position, candidate.position) }))
    .filter(({ dist }) => dist <= repairRadius)
    .sort((a, b) => a.dist - b.dist)[0]?.candidate;

  if (ally) {
    unit.state = "idle";
    ally.hp = Math.min(ally.definition.stats.hp, ally.hp + dt * (unit.definition.traits.builder ? 3.2 : 5.4));
    return true;
  }

  if (unit.definition.traits.builder) {
    const base = state.bases[unit.faction];
    if (base.hp < base.maxHp && distance(unit.position, base.position) <= repairRadius + 40) {
      unit.state = "idle";
      base.hp = Math.min(base.maxHp, base.hp + dt * 4.4);
      return true;
    }
  }
  return false;
}

function findTarget(state: SimulationState, unit: RuntimeUnit): RuntimeUnit | undefined {
  const enemies = state.units
    .filter((candidate) => candidate.faction !== unit.faction && canDetect(unit.definition, candidate.definition, state.elapsed))
    .map((candidate) => ({ candidate, dist: distance(unit.position, candidate.position) }))
    .filter(({ dist }) => dist <= rangePixels(unit.definition))
    .sort((a, b) => targetPriority(b.candidate) - targetPriority(a.candidate) || a.dist - b.dist);
  return enemies[0]?.candidate;
}

function targetPriority(unit: RuntimeUnit): number {
  let priority = 0;
  if (unit.definition.traits.decoy) priority += 5;
  if (unit.definition.traits.repair || unit.definition.traits.builder) priority += 1.5;
  if (unit.definition.traits.jammer) priority += 1;
  return priority;
}

function attackUnit(state: SimulationState, attacker: RuntimeUnit, target: RuntimeUnit): void {
  attacker.cooldown = attackCooldown(attacker, state.elapsed);
  const damage = computeDamage(attacker.definition, target);
  const areaRadius = attacker.definition.weapon.areaRadius;
  if (attacker.definition.traits.areaDamage || areaRadius > 0) {
    for (const unit of state.units) {
      if (unit.faction !== attacker.faction && distance(unit.position, target.position) < Math.max(32, areaRadius)) {
        unit.hp -= damage * 0.72;
      }
    }
  } else {
    target.hp -= damage;
  }
  if (attacker.definition.traits.slow || attacker.definition.weapon.tags.includes("slow")) {
    target.cooldown += 0.12;
    if (!target.definition.traits.flying) target.slowUntil = Math.max(target.slowUntil ?? 0, state.elapsed + 1.4);
  }
  if (attacker.definition.traits.jammer || attacker.definition.weapon.damageType === "emp") target.jammedUntil = Math.max(target.jammedUntil ?? 0, state.elapsed + 1.6);
  if (attacker.definition.traits.suicide) attacker.hp = 0;
  fireProjectile(state, muzzlePoint(attacker, target.position), target.position, attacker.faction, attacker.definition.traits.areaDamage || areaRadius > 0);
}

function attackBase(state: SimulationState, attacker: RuntimeUnit, targetFaction: Faction): void {
  attacker.cooldown = attackCooldown(attacker, state.elapsed);
  const damage = Math.max(1, attacker.definition.weapon.damage * (attacker.definition.role === "siege" ? 1.55 : 1));
  state.bases[targetFaction].hp -= damage;
  if (attacker.definition.traits.suicide) attacker.hp = 0;
  fireProjectile(state, muzzlePoint(attacker, state.bases[targetFaction].position), state.bases[targetFaction].position, attacker.faction, attacker.definition.traits.areaDamage);
}

function attackCooldown(unit: RuntimeUnit, elapsed: number): number {
  const jammed = (unit.jammedUntil ?? 0) > elapsed;
  return (1 / unit.definition.weapon.attackRate) * (jammed ? 1.38 : 1);
}

function effectiveSpeed(unit: RuntimeUnit, elapsed: number): number {
  let speed = unit.definition.stats.speed;
  if (unit.definition.traits.flying) speed *= 1.12;
  if ((unit.slowUntil ?? 0) > elapsed) speed *= 0.55;
  if ((unit.jammedUntil ?? 0) > elapsed) speed *= 0.88;
  return speed;
}

function fireProjectile(state: SimulationState, from: Vector2, to: Vector2, faction: Faction, area: boolean): void {
  state.projectiles.push({
    id: `p_${++projectileSeq}`,
    faction,
    from: { ...from },
    to: { ...to },
    life: 0,
    maxLife: 0.22,
    area
  });
}

function muzzlePoint(attacker: RuntimeUnit, target: Vector2): Vector2 {
  const dx = target.x - attacker.position.x;
  const dy = target.y - attacker.position.y;
  const length = Math.max(0.001, Math.hypot(dx, dy));
  const barrel = attacker.definition.visual.size * 0.78 + Math.max(12, Math.min(36, attacker.definition.weapon.range * 3.1));
  return {
    x: attacker.position.x + (dx / length) * barrel,
    y: attacker.position.y + (dy / length) * barrel
  };
}

function updateProjectiles(state: SimulationState, dt: number): void {
  for (const projectile of state.projectiles) projectile.life += dt;
  state.projectiles = state.projectiles.filter((projectile) => projectile.life < projectile.maxLife);
}

function checkVictory(state: SimulationState): void {
  if (state.bases.red.hp <= 0) endBattle(state, "blue");
  if (state.bases.blue.hp <= 0) endBattle(state, "red");
  if (!state.winner && state.elapsed > 360) {
    endBattle(state, state.bases.red.hp > state.bases.blue.hp ? "red" : "blue");
  }
}

function endBattle(state: SimulationState, winner: Faction): void {
  state.winner = winner;
  const loser = winner === "red" ? "blue" : "red";
  state.memories[winner].matchesPlayed += 1;
  state.memories[winner].wins += 1;
  state.memories[loser].matchesPlayed += 1;
  state.memories[loser].losses += 1;
  state.memories[winner].successfulUnits.unshift(state.activeDesign[winner].name);
  recordChampionWin(state, winner);
  recordChampionLoss(state, loser);
  state.memories[loser].failedUnits.unshift(state.activeDesign[loser].name);
  log(state, `${winner === "red" ? "Rouge" : "Bleu"} gagne en ${formatTime(state.elapsed)}`, winner);
  finishCurrentBattleCard(state, winner);
  state.running = false;
}

function recordChampionWin(state: SimulationState, faction: Faction): void {
  const unit = state.activeDesign[faction];
  const records = state.memories[faction].championUnits;
  const existing = records.find((record) => record.id === unit.id || record.unit.name === unit.name);
  if (existing) {
    existing.wins += 1;
    existing.lastSeenGeneration = state.generation;
    existing.unit = unit;
  } else {
    records.unshift({
      id: unit.id,
      unit,
      wins: 1,
      losses: 0,
      lastSeenGeneration: state.generation
    });
  }
  state.memories[faction].championUnits = records.sort((a, b) => b.wins - a.wins || b.lastSeenGeneration - a.lastSeenGeneration).slice(0, 12);
}

function recordChampionLoss(state: SimulationState, faction: Faction): void {
  const unit = state.activeDesign[faction];
  const existing = state.memories[faction].championUnits.find((record) => record.id === unit.id || record.unit.name === unit.name);
  if (existing) {
    existing.losses += 1;
    existing.lastSeenGeneration = state.generation;
  }
}

function createBattleCard(
  state: SimulationState,
  mode: SimulationState["mode"],
  redUnit: UnitDefinition,
  blueUnit: UnitDefinition,
  redQuantity: number,
  blueQuantity: number,
  summary: string
): void {
  const card = {
    id: `battle_${++battleSeq}`,
    generation: state.generation,
    mode,
    status: "preparing" as const,
    redUnit,
    blueUnit,
    redQuantity,
    blueQuantity,
    summary
  };
  state.currentBattleId = card.id;
  state.battleCards.unshift(card);
  state.battleCards = state.battleCards.slice(0, 18);
}

function finishCurrentBattleCard(state: SimulationState, winner: Faction): void {
  const card = state.battleCards.find((item) => item.id === state.currentBattleId);
  if (!card) return;
  card.status = winner === "red" ? "red-win" : "blue-win";
  card.result = winner;
  card.duration = state.elapsed;
}

function updateCurrentBattleCard(state: SimulationState): void {
  const card = state.battleCards.find((item) => item.id === state.currentBattleId);
  if (!card || state.winner) return;
  card.status = state.running ? "running" : "preparing";
}

export function log(state: SimulationState, message: string, faction?: Faction): BattleLogEntry {
  const entry = {
    time: state.elapsed,
    generation: state.generation,
    message,
    faction
  };
  state.log.unshift(entry);
  state.log = state.log.slice(0, 160);
  return entry;
}

export function syncBattleStatus(state: SimulationState): void {
  updateCurrentBattleCard(state);
}

function labelFaction(faction: Faction): string {
  return faction === "red" ? "Rouge" : "Bleu";
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}m${secs.toString().padStart(2, "0")}`;
}
