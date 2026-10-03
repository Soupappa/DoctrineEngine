import type { GameMap } from "./types";

export function createDefaultMap(): GameMap {
  return {
    width: 980,
    height: 600,
    redBase: { x: 92, y: 300 },
    blueBase: { x: 888, y: 300 },
    resourceZone: {
      position: { x: 490, y: 300 },
      radius: 82
    },
    obstacles: [
      { x: 420, y: 132, width: 48, height: 112 },
      { x: 512, y: 356, width: 50, height: 110 }
    ]
  };
}
