import type { AiMemory, DoctrineId } from "../core/types";

export function createMemory(initialDoctrine: DoctrineId): AiMemory {
  return {
    matchesPlayed: 0,
    wins: 0,
    losses: 0,
    enemyPatterns: [],
    successfulUnits: [],
    championUnits: [],
    failedUnits: [],
    currentDoctrine: initialDoctrine
  };
}

export function rememberPattern(memory: AiMemory, pattern: string): void {
  memory.enemyPatterns.unshift(pattern);
  memory.enemyPatterns = memory.enemyPatterns.slice(0, 8);
}
