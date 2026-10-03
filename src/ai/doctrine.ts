import doctrinesData from "../data/doctrines.json";
import type { Doctrine, DoctrineId } from "../core/types";

export const DOCTRINES = doctrinesData as Doctrine[];

export function getDoctrine(id: DoctrineId): Doctrine {
  return DOCTRINES.find((doctrine) => doctrine.id === id) ?? DOCTRINES[0];
}

export function counterDoctrineFor(pattern: string): DoctrineId {
  if (pattern.includes("stealth")) return "anti-stealth";
  if (pattern.includes("flying") || pattern.includes("air")) return "air-control";
  if (pattern.includes("swarm") || pattern.includes("fragile")) return "counter-swarm";
  if (pattern.includes("heavy") || pattern.includes("armor")) return "counter-heavy";
  if (pattern.includes("range") || pattern.includes("artillery")) return "rush";
  if (pattern.includes("fast")) return "turtle";
  return "attrition";
}

export function doctrineRotation(id: DoctrineId): DoctrineId {
  const order = DOCTRINES.map((doctrine) => doctrine.id);
  const index = order.indexOf(id);
  return order[(index + 1) % order.length];
}
