import { FACTION_ACCENTS, FACTION_COLORS, TACTICAL_WAVE_INTERVAL, WORLD_SCALE } from "../core/constants";
import { distance, isStealthRevealed, rangePixels } from "../core/combat";
import type { Faction, RuntimeUnit, SimulationState, UnitVisual, UnitDefinition, Vector2 } from "../core/types";
import { getUnitPixelCells } from "./unitVisuals";

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private hoveredUnit?: RuntimeUnit;
  private selectedUnit?: RuntimeUnit;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D indisponible");
    this.canvas = canvas;
    this.ctx = ctx;
    this.canvas.addEventListener("mousemove", (event) => this.onPointerMove(event));
    this.canvas.addEventListener("click", () => {
      this.selectedUnit = this.hoveredUnit;
    });
  }

  render(state: SimulationState): void {
    this.resize();
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.save();
    ctx.scale(this.canvas.width / state.map.width, this.canvas.height / state.map.height);
    drawMap(ctx, state);
    for (const projectile of state.projectiles) drawProjectile(ctx, projectile.from, projectile.to, projectile.faction, projectile.life / projectile.maxLife, projectile.area);
    const time = performance.now() / 1000;
    for (const unit of state.units) drawUnit(ctx, unit, unit === this.hoveredUnit || unit === this.selectedUnit, time, state.elapsed);
    const focus = this.selectedUnit ?? this.hoveredUnit;
    if (focus) drawRange(ctx, focus);
    if (state.winner) drawBattleResult(ctx, state, time);
    ctx.restore();
  }

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(rect.width * ratio));
    const height = Math.max(1, Math.floor(rect.height * ratio));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  syncHover(state: SimulationState): void {
    if (!this.hoveredUnit) return;
    this.hoveredUnit = state.units.find((unit) => unit.id === this.hoveredUnit?.id);
  }

  private onPointerMove(event: MouseEvent): void {
    const state = (window as unknown as { doctrineState?: SimulationState }).doctrineState;
    if (!state) return;
    const rect = this.canvas.getBoundingClientRect();
    const point = {
      x: ((event.clientX - rect.left) / rect.width) * state.map.width,
      y: ((event.clientY - rect.top) / rect.height) * state.map.height
    };
    this.hoveredUnit = state.units.find((unit) => distance(point, unit.position) <= unit.definition.visual.size + 6);
  }
}

function drawMap(ctx: CanvasRenderingContext2D, state: SimulationState): void {
  const { map } = state;
  ctx.fillStyle = "#102016";
  ctx.fillRect(0, 0, map.width, map.height);

  drawPixelPrairie(ctx, map.width, map.height);
  drawControlBands(ctx, map.width, map.height);
  drawTerrainFeatures(ctx, map.width, map.height);
  drawTacticalGrid(ctx, map.width, map.height);

  drawBase(ctx, state.bases.red.position, state.bases.red.hp / state.bases.red.maxHp, "red", state);
  drawBase(ctx, state.bases.blue.position, state.bases.blue.hp / state.bases.blue.maxHp, "blue", state);
}

function drawPixelPrairie(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const cell = 10;
  for (let y = 0; y < height; y += cell) {
    for (let x = 0; x < width; x += cell) {
      const n = terrainNoise(x, y);
      const moisture = terrainNoise(x + 311, y - 97);
      const r = 19 + n * 16;
      const g = 38 + n * 36 + moisture * 10;
      const b = 24 + moisture * 18;
      ctx.fillStyle = `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
      ctx.fillRect(x, y, cell, cell);
    }
  }

  ctx.fillStyle = "rgba(195, 166, 88, 0.08)";
  for (let i = 0; i < 150; i += 1) {
    const x = (i * 73) % width;
    const y = (i * 137) % height;
    const len = 8 + ((i * 17) % 18);
    ctx.fillRect(x, y, len, 2);
  }
}

function drawControlBands(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const red = ctx.createLinearGradient(0, 0, width * 0.42, 0);
  red.addColorStop(0, "rgba(225, 77, 87, 0.16)");
  red.addColorStop(1, "rgba(225, 77, 87, 0)");
  ctx.fillStyle = red;
  ctx.fillRect(0, 0, width * 0.48, height);

  const blue = ctx.createLinearGradient(width, 0, width * 0.58, 0);
  blue.addColorStop(0, "rgba(74, 160, 255, 0.16)");
  blue.addColorStop(1, "rgba(74, 160, 255, 0)");
  ctx.fillStyle = blue;
  ctx.fillRect(width * 0.52, 0, width * 0.48, height);

  ctx.strokeStyle = "rgba(255, 216, 77, 0.18)";
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 8]);
  ctx.beginPath();
  ctx.moveTo(width / 2, 24);
  ctx.lineTo(width / 2, height - 24);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawTerrainFeatures(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  drawPatch(ctx, width * 0.32, height * 0.28, 92, 48, "rgba(38, 70, 48, 0.55)");
  drawPatch(ctx, width * 0.36, height * 0.72, 120, 38, "rgba(32, 63, 45, 0.46)");
  drawPatch(ctx, width * 0.68, height * 0.36, 110, 46, "rgba(70, 57, 44, 0.32)");
  drawPatch(ctx, width * 0.63, height * 0.68, 80, 54, "rgba(39, 72, 55, 0.4)");

  ctx.strokeStyle = "rgba(180, 160, 96, 0.12)";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(width * 0.12, height * 0.55);
  ctx.bezierCurveTo(width * 0.35, height * 0.42, width * 0.55, height * 0.72, width * 0.88, height * 0.5);
  ctx.stroke();
}

function drawPatch(ctx: CanvasRenderingContext2D, cx: number, cy: number, width: number, height: number, color: string): void {
  ctx.fillStyle = color;
  const cell = 8;
  for (let y = -height; y <= height; y += cell) {
    for (let x = -width; x <= width; x += cell) {
      const nx = x / width;
      const ny = y / height;
      if (nx * nx + ny * ny < 1 + terrainNoise(cx + x, cy + y) * 0.3) {
        ctx.fillRect(cx + x, cy + y, cell, cell);
      }
    }
  }
}

function drawTacticalGrid(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.strokeStyle = "rgba(90, 160, 180, 0.055)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function terrainNoise(x: number, y: number): number {
  const v = Math.sin(x * 0.041 + y * 0.017) * 43758.5453;
  return v - Math.floor(v);
}

function drawBase(ctx: CanvasRenderingContext2D, position: Vector2, hpRatio: number, faction: Faction, state: SimulationState): void {
  ctx.save();
  ctx.translate(position.x, position.y);
  ctx.fillStyle = `${FACTION_COLORS[faction]}24`;
  ctx.strokeStyle = FACTION_COLORS[faction];
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -42);
  ctx.lineTo(38, -16);
  ctx.lineTo(28, 34);
  ctx.lineTo(-28, 34);
  ctx.lineTo(-38, -16);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = `${FACTION_COLORS[faction]}66`;
  ctx.beginPath();
  ctx.arc(0, 0, 54, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#0d1116";
  ctx.fillRect(-34, -58, 68, 7);
  ctx.fillStyle = FACTION_COLORS[faction];
  ctx.fillRect(-34, -58, 68 * Math.max(0, hpRatio), 7);
  drawProductionGauge(ctx, faction, state);
  ctx.restore();
}

function drawProductionGauge(ctx: CanvasRenderingContext2D, faction: Faction, state: SimulationState): void {
  const base = state.bases[faction];
  const interval = Math.max(0.1, TACTICAL_WAVE_INTERVAL);
  const timer = Math.max(0, base.buildQueueTimer);
  const progress = !state.running ? 0 : 1 - Math.min(1, timer / interval);
  const wave = Math.max(1, state.waveSize[faction]);
  const label = !state.running
    ? "PAUSED"
    : timer <= 0
      ? `WAVE ${wave}x`
      : `${timer.toFixed(1)}s / ${wave}x`;

  ctx.fillStyle = "rgba(5, 8, 12, 0.82)";
  ctx.fillRect(-46, 62, 92, 20);
  ctx.strokeStyle = `${FACTION_COLORS[faction]}aa`;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-46, 62, 92, 20);
  ctx.fillStyle = `${FACTION_COLORS[faction]}88`;
  ctx.fillRect(-43, 65, 86 * progress, 5);
  ctx.fillStyle = "#dce8f4";
  ctx.font = "10px Consolas, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`NEXT ${label}`, 0, 75);
}

function drawProjectile(ctx: CanvasRenderingContext2D, from: Vector2, to: Vector2, faction: Faction, t: number, area: boolean): void {
  ctx.save();
  ctx.globalAlpha = 1 - t * 0.5;
  ctx.lineCap = "square";
  ctx.strokeStyle = "rgba(3, 4, 5, 0.92)";
  ctx.lineWidth = area ? 6 : 5;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.strokeStyle = area ? FACTION_ACCENTS[faction] : FACTION_COLORS[faction];
  ctx.lineWidth = area ? 2.5 : 2;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  if (area) {
    ctx.beginPath();
    ctx.arc(to.x, to.y, 18 + t * 28, 0, Math.PI * 2);
    ctx.globalAlpha = 0.3 * (1 - t);
    ctx.stroke();
  }
  ctx.restore();
}

function drawUnit(ctx: CanvasRenderingContext2D, unit: RuntimeUnit, focused: boolean, time: number, elapsed: number): void {
  const visual = unit.definition.visual;
  const color = FACTION_COLORS[unit.faction];
  const accent = FACTION_ACCENTS[unit.faction];
  const pulse = 1 + Math.sin(time * (unit.definition.stats.attackRate + 1.4) + unit.position.x * 0.02) * 0.035;
  const drift = Math.sin(time * unit.definition.stats.speed + unit.position.y * 0.01) * 1.5;
  const phased = unit.definition.traits.stealth && !isStealthRevealed(unit.definition, elapsed);
  const angle = facingAngle(unit);
  ctx.save();
  ctx.translate(unit.position.x, unit.position.y + drift);
  ctx.globalAlpha = phased ? 0.36 : 1;

  if (visual.shadow) {
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.ellipse(4, 12, visual.size * 0.8, visual.size * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.save();
  ctx.rotate(angle);
  ctx.scale(pulse, pulse);

  if (visual.trail) {
    ctx.strokeStyle = `${accent}88`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.moveTo(-(visual.size + 4 + i * 5), -5 + i * 5);
      ctx.lineTo(-(visual.size + 18 + i * 6), -5 + i * 5);
      ctx.stroke();
    }
  }

  if (visual.halo) {
    ctx.strokeStyle = `${accent}88`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, -4, visual.size * 1.15, visual.size * 0.62, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  for (let i = 0; i < visual.ghostCopies; i += 1) {
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.translate((i + 1) * 9, (i % 2 === 0 ? -1 : 1) * 7);
    drawPixelBody(ctx, unit, color, accent);
    ctx.restore();
  }

  drawPixelBody(ctx, unit, color, accent);
  drawMountedWeapon(ctx, unit.definition, 1);
  drawTraitMarks(ctx, visual, accent, time);
  drawStatusMarks(ctx, unit, accent, elapsed, phased);
  ctx.restore();

  const hpRatio = Math.max(0, unit.hp / unit.definition.stats.hp);
  ctx.fillStyle = "#06080b";
  ctx.fillRect(-visual.size, visual.size + 7, visual.size * 2, 4);
  ctx.fillStyle = hpRatio > 0.45 ? "#8ce079" : "#ffcf66";
  ctx.fillRect(-visual.size, visual.size + 7, visual.size * 2 * hpRatio, 4);

  if (focused) {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, 0, visual.size + 8, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawStatusMarks(ctx: CanvasRenderingContext2D, unit: RuntimeUnit, accent: string, elapsed: number, phased: boolean): void {
  if (phased) {
    ctx.save();
    ctx.strokeStyle = `${accent}aa`;
    ctx.setLineDash([2, 5]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, unit.definition.visual.size + 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  if ((unit.jammedUntil ?? 0) > elapsed) {
    ctx.save();
    ctx.strokeStyle = "#ffd84daa";
    ctx.setLineDash([4, 3]);
    ctx.rotate(Math.sin(elapsed * 8) * 0.3);
    ctx.beginPath();
    ctx.arc(0, 0, unit.definition.visual.size + 13, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  if ((unit.slowUntil ?? 0) > elapsed) {
    ctx.save();
    ctx.strokeStyle = "#7be3ffaa";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-unit.definition.visual.size, unit.definition.visual.size + 13);
    ctx.lineTo(unit.definition.visual.size, unit.definition.visual.size + 13);
    ctx.stroke();
    ctx.restore();
  }
}

function drawBattleResult(ctx: CanvasRenderingContext2D, state: SimulationState, time: number): void {
  const winner = state.winner;
  if (!winner) return;
  const label = winner === "red" ? "BATAILLE FINIE - ROUGE GAGNE" : "BATAILLE FINIE - BLEU GAGNE";
  const color = winner === "red" ? FACTION_COLORS.red : FACTION_COLORS.blue;
  const accent = winner === "red" ? FACTION_ACCENTS.red : FACTION_ACCENTS.blue;
  const unit = state.activeDesign[winner];
  const width = state.map.width;
  const height = state.map.height;
  const pulse = 1 + Math.sin(time * 5) * 0.04;
  ctx.save();
  ctx.fillStyle = "rgba(5, 8, 12, 0.84)";
  ctx.fillRect(width / 2 - 250, height / 2 - 128, 500, 256);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeRect(width / 2 - 250, height / 2 - 128, 500, 256);
  ctx.save();
  ctx.translate(width / 2, height / 2 - 28);
  ctx.scale(pulse * 2.35, pulse * 2.35);
  drawDefinitionBody(ctx, unit, color, accent);
  drawMountedWeapon(ctx, unit, 1.08);
  ctx.restore();
  ctx.fillStyle = color;
  ctx.font = "bold 20px Consolas, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, width / 2, height / 2 + 78);
  ctx.fillStyle = "#dce8f4";
  ctx.font = "bold 15px Consolas, monospace";
  ctx.fillText(unit.name, width / 2, height / 2 + 104);
  ctx.restore();
}

function drawPixelBody(ctx: CanvasRenderingContext2D, unit: RuntimeUnit, color: string, accent: string): void {
  drawDefinitionBody(ctx, unit.definition, color, accent);
}

function drawDefinitionBody(ctx: CanvasRenderingContext2D, definition: RuntimeUnit["definition"], color: string, accent: string): void {
  const cells = getUnitPixelCells(definition, 76);
  const center = 38;
  const scale = Math.max(0.42, definition.visual.size / 17);
  ctx.setLineDash(definition.visual.dashed ? [3, 3] : []);
  for (const cell of cells) {
    const x = (cell.x - center) * scale;
    const y = (cell.y - center) * scale;
    const w = cell.w * scale;
    const h = cell.h * scale;
    ctx.fillStyle = cell.core ? accent : color;
    ctx.strokeStyle = accent;
    ctx.lineWidth = Math.max(0.7, definition.visual.strokeWidth * 0.25);
    ctx.globalAlpha *= cell.core ? 1 : 0.96;
    ctx.fillRect(x - w / 2, y - h / 2, w, h);
    ctx.strokeRect(x - w / 2, y - h / 2, w, h);
  }
  ctx.setLineDash([]);
}

function drawMountedWeapon(ctx: CanvasRenderingContext2D, definition: UnitDefinition, scale = 1): void {
  const weapon = definition.weapon;
  const visual = definition.visual;
  const muzzleCount = weapon.tags.includes("flak") ? 3 : weapon.areaRadius > 0 ? 2 : 1;
  const barrel = Math.max(18, Math.min(48, weapon.range * 3.9)) * scale;
  const core = Math.max(8, Math.min(18, visual.size * 0.4 + weapon.damage / 9)) * scale;
  const width = Math.max(6, Math.min(14, 6 + weapon.armorPiercing * 9)) * scale;
  const baseX = visual.size * 0.14 * scale;
  const yStep = width * 1.12;

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(baseX + core * 0.5, core * 0.58, core * 1.45, core * 0.44, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#020304";
  ctx.strokeStyle = "#d0d5da";
  ctx.lineWidth = 1.4 * scale;
  ctx.fillRect(baseX - core * 0.82, -core * 0.68, core * 1.52, core * 1.28);
  ctx.strokeRect(baseX - core * 0.82, -core * 0.68, core * 1.52, core * 1.28);

  for (let index = 0; index < muzzleCount; index += 1) {
    const offset = (index - (muzzleCount - 1) / 2) * yStep;
    ctx.strokeStyle = "#020304";
    ctx.lineWidth = width + 2.5 * scale;
    ctx.beginPath();
    ctx.moveTo(baseX + core * 0.45, offset);
    ctx.lineTo(baseX + visual.size * 0.5 + barrel, offset * 0.45);
    ctx.stroke();
    ctx.strokeStyle = "#9ea6ad";
    ctx.lineWidth = Math.max(1.4, width * 0.22);
    ctx.beginPath();
    ctx.moveTo(baseX + core * 0.45, offset);
    ctx.lineTo(baseX + visual.size * 0.5 + barrel, offset * 0.45);
    ctx.stroke();
  }

  if (weapon.damageType === "energy") {
    ctx.strokeStyle = "#c8d7dc";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(baseX - core * 0.55, -core * 0.85);
    ctx.lineTo(baseX + core * 1.55, 0);
    ctx.lineTo(baseX - core * 0.55, core * 0.85);
    ctx.stroke();
  }

  if (weapon.damageType === "emp") {
    ctx.strokeStyle = "#b4b8ff";
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.arc(baseX, 0, core * 1.22, 0, Math.PI * 1.5);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}

function drawTraitMarks(ctx: CanvasRenderingContext2D, visual: UnitVisual, accent: string, time: number): void {
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.5;
  if (visual.antenna) {
    ctx.beginPath();
    ctx.moveTo(0, -visual.size);
    ctx.lineTo(0, -visual.size - 10);
    ctx.lineTo(8, -visual.size - 15);
    ctx.stroke();
  }
  if (visual.areaRing) {
    ctx.globalAlpha *= 0.85;
    ctx.beginPath();
    ctx.arc(0, 0, visual.size + 12, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (visual.detectorRing) {
    ctx.beginPath();
    ctx.arc(0, 0, visual.size + 17, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (visual.jammerRings) {
    ctx.setLineDash([3, 5]);
    ctx.rotate(Math.sin(time * 2.2) * 0.1);
    ctx.beginPath();
    ctx.arc(0, 0, visual.size + 20, 0.5, Math.PI * 1.55);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawRange(ctx: CanvasRenderingContext2D, unit: RuntimeUnit): void {
  ctx.save();
  ctx.strokeStyle = `${FACTION_ACCENTS[unit.faction]}70`;
  ctx.fillStyle = `${FACTION_COLORS[unit.faction]}10`;
  ctx.setLineDash([8, 7]);
  ctx.beginPath();
  ctx.arc(unit.position.x, unit.position.y, rangePixels(unit.definition), 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function facingAngle(unit: RuntimeUnit): number {
  const dx = unit.targetPosition.x - unit.position.x;
  const dy = unit.targetPosition.y - unit.position.y;
  if (Math.abs(dx) + Math.abs(dy) < 0.01) return unit.faction === "red" ? 0 : Math.PI;
  return Math.atan2(dy, dx);
}
