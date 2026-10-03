export type Faction = "red" | "blue";

export type UnitRole =
  | "scout"
  | "raider"
  | "tank"
  | "artillery"
  | "support"
  | "builder"
  | "miner"
  | "air"
  | "swarm"
  | "siege";

export type VisualShape = "triangle" | "hexagon" | "diamond" | "circle" | "square" | "cluster";

export interface Vector2 {
  x: number;
  y: number;
}

export interface UnitStats {
  hp: number;
  damage: number;
  range: number;
  attackRate: number;
  speed: number;
  armor: number;
  vision: number;
}

export interface UnitTraits {
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
  slow?: boolean;
  transport?: boolean;
  mining?: boolean;
}

export type DamageType = "kinetic" | "explosive" | "energy" | "emp" | "piercing" | "flak";

export interface WeaponDefinition {
  id: string;
  name: string;
  damageType: DamageType;
  damage: number;
  range: number;
  attackRate: number;
  armorPiercing: number;
  areaRadius: number;
  tracking: number;
  cost: number;
  tags: string[];
}

export interface UnitVisual {
  shape: VisualShape;
  size: number;
  strokeWidth: number;
  opacity: number;
  dashed: boolean;
  halo: boolean;
  shadow: boolean;
  trail: boolean;
  antenna: boolean;
  areaRing: boolean;
  detectorRing: boolean;
  jammerRings: boolean;
  ghostCopies: number;
  accent: string;
  icon: string;
}

export interface UnitDefinition {
  id: string;
  name: string;
  faction: Faction;
  role: UnitRole;
  stats: UnitStats;
  weapon: WeaponDefinition;
  traits: UnitTraits;
  cost: number;
  buildTime: number;
  visual: UnitVisual;
}

export interface CostBreakdown {
  baseCost: number;
  statCost: number;
  traitCost: number;
  synergyPenalty: number;
  weaknessDiscount: number;
  finalCost: number;
  notes: string[];
}

export interface RuntimeUnit {
  id: string;
  definition: UnitDefinition;
  faction: Faction;
  position: Vector2;
  targetPosition: Vector2;
  hp: number;
  cooldown: number;
  slowUntil?: number;
  jammedUntil?: number;
  state: "moving" | "attacking" | "idle";
  selected: boolean;
}

export interface BaseState {
  faction: Faction;
  position: Vector2;
  hp: number;
  maxHp: number;
  buildQueueTimer: number;
}

export interface Projectile {
  id: string;
  faction: Faction;
  from: Vector2;
  to: Vector2;
  life: number;
  maxLife: number;
  area: boolean;
}

export interface BattleLogEntry {
  time: number;
  generation: number;
  message: string;
  faction?: Faction;
}

export type GameMode = "ai-lab" | "human-vs-ai";
export type BattleStatus = "preparing" | "running" | "red-win" | "blue-win";

export interface BattleCard {
  id: string;
  generation: number;
  mode: GameMode;
  status: BattleStatus;
  redUnit: UnitDefinition;
  blueUnit: UnitDefinition;
  redQuantity: number;
  blueQuantity: number;
  result?: Faction;
  duration?: number;
  summary: string;
}

export interface ChampionRecord {
  id: string;
  unit: UnitDefinition;
  wins: number;
  losses: number;
  lastSeenGeneration: number;
}

export interface MapObstacle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GameMap {
  width: number;
  height: number;
  redBase: Vector2;
  blueBase: Vector2;
  resourceZone: { position: Vector2; radius: number };
  obstacles: MapObstacle[];
}

export interface EconomyState {
  resources: Record<Faction, number>;
  incomePerSecond: Record<Faction, number>;
}

export interface AiMemory {
  matchesPlayed: number;
  wins: number;
  losses: number;
  enemyPatterns: string[];
  successfulUnits: string[];
  championUnits: ChampionRecord[];
  failedUnits: string[];
  currentDoctrine: DoctrineId;
}

export type DoctrineId =
  | "rush"
  | "turtle"
  | "swarm"
  | "artillery"
  | "stealth"
  | "anti-stealth"
  | "economy"
  | "air-control"
  | "attrition"
  | "harassment"
  | "siege"
  | "counter-heavy"
  | "counter-swarm";

export interface Doctrine {
  id: DoctrineId;
  label: string;
  preferredRole: UnitRole;
  statBias: Partial<UnitStats>;
  traitBias: Partial<UnitTraits>;
  description: string;
}

export interface SimulationState {
  generation: number;
  elapsed: number;
  running: boolean;
  speed: number;
  winner?: Faction;
  mode: GameMode;
  currentBattleId?: string;
  map: GameMap;
  bases: Record<Faction, BaseState>;
  units: RuntimeUnit[];
  projectiles: Projectile[];
  economy: EconomyState;
  waveSize: Record<Faction, number>;
  inventedUnits: Record<Faction, UnitDefinition[]>;
  activeDesign: Record<Faction, UnitDefinition>;
  memories: Record<Faction, AiMemory>;
  log: BattleLogEntry[];
  battleCards: BattleCard[];
}
