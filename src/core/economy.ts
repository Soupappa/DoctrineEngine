import { MAX_UNITS_PER_FACTION, PASSIVE_INCOME, RESOURCE_ZONE_BONUS_RADIUS } from "./constants";
import { distance } from "./combat";
import type { EconomyState, Faction, RuntimeUnit, SimulationState } from "./types";

export function createEconomy(resources: number): EconomyState {
  return {
    resources: { red: resources, blue: resources },
    incomePerSecond: { red: PASSIVE_INCOME, blue: PASSIVE_INCOME }
  };
}

export function updateEconomy(state: SimulationState, dt: number): void {
  for (const faction of ["red", "blue"] as Faction[]) {
    const centerPresence = state.units.some(
      (unit) =>
        unit.faction === faction &&
        distance(unit.position, state.map.resourceZone.position) < RESOURCE_ZONE_BONUS_RADIUS &&
        unit.definition.traits.mining
    );
    const income = PASSIVE_INCOME + (centerPresence ? 6 : 0);
    state.economy.incomePerSecond[faction] = income;
    state.economy.resources[faction] += income * dt;
  }
}

export function canProduce(state: SimulationState, faction: Faction): boolean {
  const count = state.units.filter((unit) => unit.faction === faction).length;
  return count < MAX_UNITS_PER_FACTION && state.economy.resources[faction] >= state.activeDesign[faction].cost;
}
