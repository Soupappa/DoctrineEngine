import type { AiMemory, DoctrineId, Faction, UnitDefinition } from "../core/types";
import { counterDoctrineFor, doctrineRotation } from "./doctrine";
import { describeThreat } from "./evaluator";
import { createMemory, rememberPattern } from "./memory";
import { designUnitFromDoctrine } from "./unitDesigner";

export function createInitialAi(_faction: Faction, doctrine: DoctrineId): AiMemory {
  return createMemory(doctrine);
}

export function designOpeningUnit(faction: Faction, doctrine: DoctrineId, generation: number): UnitDefinition {
  return designUnitFromDoctrine(faction, doctrine, generation);
}

export function evolveAfterMatch(
  faction: Faction,
  memory: AiMemory,
  winner: Faction | undefined,
  enemyUnit: UnitDefinition,
  generation: number
): UnitDefinition {
  const lost = winner !== faction;
  const pattern = describeThreat(enemyUnit);
  rememberPattern(memory, pattern);

  if (lost) {
    memory.currentDoctrine = counterDoctrineFor(pattern);
  } else if (generation % 4 === 0) {
    memory.currentDoctrine = doctrineRotation(memory.currentDoctrine);
  }

  return designUnitFromDoctrine(faction, memory.currentDoctrine, generation, lost ? 1 : 0, enemyUnit);
}
