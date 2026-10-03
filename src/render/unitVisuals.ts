import { FACTION_ACCENTS, FACTION_COLORS } from "../core/constants";
import { getWeapon } from "../core/weapons";
import type { Faction, UnitDefinition, UnitVisual, WeaponDefinition } from "../core/types";

export function generateUnitVisual(unit: Omit<UnitDefinition, "visual">): UnitVisual {
  const { stats, traits } = unit;
  const durability = stats.hp / 55 + stats.armor * 0.65;
  const size = Math.round(Math.min(24, Math.max(7, 7 + durability * 1.8)));
  const damagePressure = stats.damage * stats.attackRate;
  const shape =
    traits.mining || traits.builder
      ? "square"
      : stats.hp < 36 && stats.speed > 5.5
        ? "cluster"
        : stats.armor > 5 || stats.hp > 130
          ? "hexagon"
          : stats.range > 7 || damagePressure > 45
            ? "diamond"
            : stats.speed > 5.8
              ? "triangle"
              : "circle";

  return {
    shape,
    size,
    strokeWidth: Math.min(6, Math.max(1.4, 1.4 + stats.armor * 0.36)),
    opacity: 1,
    dashed: traits.stealth,
    halo: traits.flying,
    shadow: traits.flying,
    trail: stats.speed > 5.2,
    antenna: stats.range > 7,
    areaRing: traits.areaDamage,
    detectorRing: traits.detector,
    jammerRings: traits.jammer,
    ghostCopies: traits.decoy ? 2 : 0,
    accent: stats.speed > 5.5 ? "fast" : stats.armor > 4 ? "heavy" : stats.range > 7 ? "long-range" : "standard",
    icon: traits.builder ? "tool" : traits.mining ? "mine" : shape
  };
}

export function renderUnitSvg(unit: UnitDefinition, size = 76): string {
  const color = FACTION_COLORS[unit.faction];
  const accent = FACTION_ACCENTS[unit.faction];
  const visual = unit.visual;
  const center = size / 2;
  const scale = size / 76;
  const bodySize = visual.size * 1.12 * scale;
  const dash = visual.dashed ? 'stroke-dasharray="4 4"' : "";
  const opacity = visual.opacity.toFixed(2);
  const pixels = getUnitPixelCells(unit, size);
  const parts = [
    `<style>
      .unit-pulse{transform-origin:${center}px ${center}px;animation:unitPulse 1.8s ease-in-out infinite}
      .unit-spin{transform-origin:${center}px ${center}px;animation:unitSpin 5s linear infinite}
      .unit-drift{animation:unitDrift 1.2s ease-in-out infinite alternate}
      @keyframes unitPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.055)}}
      @keyframes unitSpin{to{transform:rotate(360deg)}}
      @keyframes unitDrift{from{transform:translateX(-2px)}to{transform:translateX(2px)}}
    </style>`
  ];

  if (visual.shadow) {
    parts.push(`<ellipse cx="${center + 4}" cy="${center + bodySize * 1.1}" rx="${bodySize * 1.25}" ry="${bodySize * 0.36}" fill="rgba(0,0,0,.34)"/>`);
  }

  if (visual.trail) {
    parts.push(`
      <g class="unit-drift" stroke="${accent}" stroke-width="2" stroke-linecap="round" opacity=".58">
        <path d="M ${center - bodySize - 5} ${center - 8} L ${center - bodySize - 19} ${center - 8}"/>
        <path d="M ${center - bodySize - 2} ${center} L ${center - bodySize - 24} ${center}"/>
        <path d="M ${center - bodySize - 5} ${center + 8} L ${center - bodySize - 17} ${center + 8}"/>
      </g>
    `);
  }

  if (visual.halo) {
    parts.push(`<ellipse class="unit-spin" cx="${center}" cy="${center - 2}" rx="${bodySize * 1.45}" ry="${bodySize * 0.72}" fill="none" stroke="${accent}" stroke-width="2" opacity=".55"/>`);
  }

  if (visual.areaRing) {
    parts.push(`<circle class="unit-pulse" cx="${center}" cy="${center}" r="${bodySize * 1.65}" fill="none" stroke="${accent}" stroke-width="1.4" opacity=".45"/>`);
  }

  if (visual.detectorRing) {
    parts.push(`<circle cx="${center}" cy="${center}" r="${bodySize * 1.95}" fill="none" stroke="${accent}" stroke-width="1.5" opacity=".5"/>`);
  }

  if (visual.jammerRings) {
    parts.push(`<path class="unit-spin" d="M ${center - bodySize * 2.2} ${center} A ${bodySize * 2.2} ${bodySize * 2.2} 0 0 1 ${center + bodySize * 1.7} ${center - bodySize * 1.1}" fill="none" stroke="${accent}" stroke-width="1.5" stroke-dasharray="3 5" opacity=".65"/>`);
  }

  for (let i = 0; i < visual.ghostCopies; i += 1) {
    parts.push(`<g opacity=".16" transform="translate(${(i + 1) * 7} ${(i % 2 === 0 ? -1 : 1) * 5})">${pixelBodySvg(pixels, color, accent, visual.strokeWidth * scale, dash, opacity)}</g>`);
  }

  parts.push(`<g class="unit-pulse">${pixelBodySvg(pixels, color, accent, visual.strokeWidth * scale, dash, opacity)}</g>`);

  if (visual.antenna) {
    parts.push(`<path d="M ${center} ${center - bodySize} L ${center} ${center - bodySize - 12} L ${center + 10} ${center - bodySize - 18}" fill="none" stroke="${accent}" stroke-width="2" stroke-linecap="round"/>`);
  }

  if (unit.traits.builder || unit.traits.repair) {
    parts.push(`<path d="M ${center - 7} ${center + bodySize + 9} L ${center + 8} ${center + bodySize - 6}" stroke="${accent}" stroke-width="3" stroke-linecap="round"/>`);
  }

  if (unit.traits.mining) {
    parts.push(`<circle cx="${center}" cy="${center}" r="${Math.max(2.5, bodySize * 0.22)}" fill="${accent}"/>`);
  }
  parts.push(renderMountedWeaponSvg(unit.weapon ?? getWeapon("kinetic"), center, center, bodySize));

  return `<svg class="unit-svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${unit.name}">${parts.join("")}</svg>`;
}

export interface PixelCell {
  x: number;
  y: number;
  w: number;
  h: number;
  core: boolean;
}

export function getUnitPixelCells(unit: UnitDefinition, size = 76): PixelCell[] {
  const bodySize = unit.visual.size * 1.12 * (size / 76);
  return organismPixels(unit, size, bodySize);
}

function organismPixels(unit: UnitDefinition, size: number, bodySize: number): PixelCell[] {
  const cells: PixelCell[] = [];
  const seed = hashUnit(unit);
  const rng = seeded(seed);
  const center = size / 2;
  const cell = Math.max(3, Math.round(size / 18));
  const profile = morphologyProfile(unit.role);
  const halfWidth = Math.max(2, Math.round((2 + unit.stats.hp / 55 + unit.stats.armor / 2) * profile.width));
  const halfHeight = Math.max(2, Math.round((2 + unit.stats.damage / 18 + unit.stats.range / 4) * profile.height));
  const tail = Math.round((unit.stats.speed / 1.6) * profile.tail);
  const tendrils = Math.round((unit.stats.range / 2.8) * profile.tendrils);
  const bulk = unit.stats.hp + unit.stats.armor * 18;

  for (let y = -halfHeight; y <= halfHeight; y += 1) {
    for (let x = -halfWidth; x <= halfWidth; x += 1) {
      const nx = x / (halfWidth + 0.2);
      const ny = y / (halfHeight + 0.2);
      const ridge = profile.ridge * Math.sin((x + y + seed % 7) * 0.9);
      const radius = nx * nx + ny * ny + ridge * 0.08;
      const bite = rng() * 0.24;
      if (radius < 0.96 - bite || (bulk > 150 && radius < 1.08 && rng() > 0.55)) {
        cells.push({
          x: center + x * cell,
          y: center + y * cell,
          w: cell,
          h: cell,
          core: radius < 0.38
        });
      }
    }
  }

  for (let i = 0; i < tail; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    cells.push({
      x: center - (halfWidth + 1 + i) * cell,
      y: center + side * Math.floor(i / 2) * cell,
      w: cell,
      h: cell,
      core: false
    });
  }

  for (let i = 0; i < tendrils; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    cells.push({
      x: center + (halfWidth + 1 + Math.floor(i / 2)) * cell,
      y: center + side * (halfHeight + (i % 3)) * cell * 0.55,
      w: cell,
      h: cell,
      core: false
    });
  }

  if (profile.spines > 0) {
    for (let i = 0; i < profile.spines; i += 1) {
      const side = i % 2 === 0 ? -1 : 1;
      cells.push({
        x: center + (i - profile.spines / 2) * cell,
        y: center + side * (halfHeight + 1.2) * cell,
        w: cell,
        h: cell,
        core: false
      });
    }
  }

  if (unit.traits.flying) {
    cells.push({ x: center - bodySize * 1.55, y: center - cell, w: cell * 2, h: cell, core: false });
    cells.push({ x: center + bodySize * 1.2, y: center - cell, w: cell * 2, h: cell, core: false });
  }

  return cells;
}

function morphologyProfile(role: UnitDefinition["role"]): { width: number; height: number; tail: number; tendrils: number; spines: number; ridge: number } {
  const profiles: Record<UnitDefinition["role"], { width: number; height: number; tail: number; tendrils: number; spines: number; ridge: number }> = {
    scout: { width: 0.72, height: 0.82, tail: 1.55, tendrils: 0.75, spines: 2, ridge: 0.8 },
    raider: { width: 0.86, height: 0.75, tail: 1.35, tendrils: 0.95, spines: 4, ridge: 1 },
    tank: { width: 1.35, height: 0.9, tail: 0.45, tendrils: 0.55, spines: 0, ridge: 0.25 },
    artillery: { width: 0.88, height: 1.38, tail: 0.55, tendrils: 1.85, spines: 3, ridge: 0.65 },
    support: { width: 1, height: 1, tail: 0.7, tendrils: 1.25, spines: 0, ridge: 0.15 },
    builder: { width: 1.15, height: 1.05, tail: 0.4, tendrils: 0.8, spines: 1, ridge: 0.35 },
    miner: { width: 1.05, height: 0.95, tail: 0.55, tendrils: 0.65, spines: 6, ridge: 0.5 },
    air: { width: 1.28, height: 0.62, tail: 1.05, tendrils: 0.9, spines: 2, ridge: 0.7 },
    swarm: { width: 0.65, height: 0.65, tail: 1.15, tendrils: 0.65, spines: 5, ridge: 1.25 },
    siege: { width: 1.5, height: 1.18, tail: 0.25, tendrils: 1.15, spines: 2, ridge: 0.2 }
  };
  return profiles[role];
}

function pixelBodySvg(
  cells: PixelCell[],
  color: string,
  accent: string,
  strokeWidth: number,
  dash: string,
  opacity: string
): string {
  return cells
    .map((cell) => {
      const fill = cell.core ? accent : color;
      const alpha = cell.core ? 0.92 : Number(opacity);
      return `<rect x="${cell.x - cell.w / 2}" y="${cell.y - cell.h / 2}" width="${cell.w}" height="${cell.h}" rx="1" fill="${fill}" opacity="${alpha}" stroke="${accent}" stroke-width="${Math.max(0.45, strokeWidth * 0.42).toFixed(1)}" ${dash}/>`;
    })
    .join("");
}

export function factionName(faction: Faction): string {
  return faction === "red" ? "Rouge" : "Bleu";
}

export function renderUnitRadar(unit: UnitDefinition, size = 92): string {
  const stats = [
    ["PV", unit.stats.hp / 240],
    ["RNG", unit.stats.range / 12],
    ["SPD", unit.stats.speed / 8.5],
    ["ARM", unit.stats.armor / 10],
    ["VIS", unit.stats.vision / 14]
  ] as const;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.34;
  const accent = FACTION_ACCENTS[unit.faction];
  const color = FACTION_COLORS[unit.faction];
  const points = stats
    .map(([, value], index) => {
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / stats.length;
      const r = radius * Math.max(0.05, Math.min(1, value));
      return `${cx + Math.cos(angle) * r},${cy + Math.sin(angle) * r}`;
    })
    .join(" ");
  const axes = stats
    .map(([label], index) => {
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / stats.length;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      const tx = cx + Math.cos(angle) * (radius + 12);
      const ty = cy + Math.sin(angle) * (radius + 12);
      return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="rgba(120,160,190,.28)" stroke-width="1"/><text x="${tx}" y="${ty}" text-anchor="middle" dominant-baseline="middle" fill="#7f8c9c" font-size="7">${label}</text>`;
    })
    .join("");
  return `
    <svg class="unit-radar" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-label="Profil ${unit.name}">
      <circle cx="${cx}" cy="${cy}" r="${radius}" fill="rgba(0,0,0,.16)" stroke="rgba(120,160,190,.26)" stroke-width="1"/>
      <circle cx="${cx}" cy="${cy}" r="${radius * 0.5}" fill="none" stroke="rgba(120,160,190,.16)" stroke-width="1"/>
      ${axes}
      <polygon points="${points}" fill="${color}55" stroke="${accent}" stroke-width="2"/>
    </svg>
  `;
}

export function renderWeaponSvg(weapon: WeaponDefinition, size = 76): string {
  const center = size / 2;
  const scale = size / 76;
  const barrel = Math.max(16, Math.min(36, weapon.range * 3.6)) * scale;
  const core = Math.max(8, Math.min(20, 7 + weapon.damage / 5)) * scale;
  const recoil = Math.max(5, Math.min(15, weapon.attackRate * 7)) * scale;
  const width = Math.max(5, Math.min(13, 5 + weapon.armorPiercing * 9)) * scale;
  const area = Math.max(0, Math.min(16, weapon.areaRadius * 0.58)) * scale;
  const tracking = Math.max(0, Math.min(14, weapon.tracking * 14)) * scale;
  const seed = hashText(`${weapon.id}_${weapon.damage}_${weapon.range}_${weapon.attackRate}`);
  const accent = weaponAccent(weapon);
  const dark = "#050608";
  const mid = "#161a1f";
  const pale = "#a4abb1";
  const muzzleCount = weapon.tags.includes("flak") ? 3 : weapon.areaRadius > 0 ? 2 : 1;
  const parts = [
    `<ellipse cx="${center - core * 0.12}" cy="${center + core * 0.78}" rx="${core * 1.35}" ry="${core * 0.34}" fill="rgba(0,0,0,.36)"/>`,
    `<rect x="${center - core * 0.72}" y="${center - core * 0.52}" width="${core * 1.35}" height="${core * 1.04}" rx="2" fill="${dark}" stroke="${pale}" stroke-width="1.4"/>`,
    `<rect x="${center - core * 1.18}" y="${center - recoil * 0.5}" width="${core * 0.62}" height="${recoil}" rx="1" fill="${mid}" stroke="#050607" stroke-width="1"/>`
  ];

  if (area > 0) {
    parts.push(`<circle cx="${center}" cy="${center}" r="${core + area}" fill="none" stroke="${accent}" stroke-width="1.2" opacity=".36" stroke-dasharray="3 4"/>`);
  }

  if (tracking > 0) {
    parts.push(`<path d="M ${center - tracking} ${center - tracking} A ${tracking} ${tracking} 0 0 1 ${center + tracking} ${center - tracking}" fill="none" stroke="${pale}" stroke-width="1.1" opacity=".62"/>`);
  }

  for (let index = 0; index < muzzleCount; index += 1) {
    const offset = (index - (muzzleCount - 1) / 2) * width * 1.1;
    parts.push(`<path d="M ${center + core * 0.54} ${center + offset} L ${center + barrel} ${center + offset * 0.62}" stroke="${mid}" stroke-width="${width}" stroke-linecap="square"/>`);
    parts.push(`<path d="M ${center + core * 0.54} ${center + offset} L ${center + barrel} ${center + offset * 0.62}" stroke="${pale}" stroke-width="${Math.max(1, width * 0.22)}" stroke-linecap="square" opacity=".72"/>`);
  }

  if (weapon.damageType === "energy") {
    parts.push(`<path d="M ${center - core * 0.22} ${center - core * 0.82} L ${center + barrel * 0.42} ${center} L ${center - core * 0.22} ${center + core * 0.82}" fill="none" stroke="${accent}" stroke-width="1.3" opacity=".72"/>`);
  }

  if (weapon.damageType === "emp") {
    parts.push(`<path d="M ${center - core * 1.1} ${center} A ${core * 1.1} ${core * 1.1} 0 0 1 ${center + core * 1.1} ${center}" fill="none" stroke="${accent}" stroke-width="1.3" stroke-dasharray="2 4" opacity=".8"/>`);
  }

  if (weapon.damageType === "explosive") {
    const points = Array.from({ length: 5 }, (_, index) => {
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / 5 + (seed % 12) * 0.01;
      const r = core * (index % 2 === 0 ? 0.62 : 0.38);
      return `${center + Math.cos(angle) * r},${center + Math.sin(angle) * r}`;
    }).join(" ");
    parts.push(`<polygon points="${points}" fill="${accent}" opacity=".7"/>`);
  }

  return `<svg class="weapon-svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${weapon.name}">${parts.join("")}</svg>`;
}

function renderMountedWeaponSvg(weapon: WeaponDefinition, cx: number, cy: number, bodySize: number): string {
  const barrel = Math.max(14, Math.min(34, weapon.range * 2.9));
  const core = Math.max(7, Math.min(15, bodySize * 0.42 + weapon.damage / 9));
  const width = Math.max(4, Math.min(10, 4 + weapon.armorPiercing * 7));
  const muzzleCount = weapon.tags.includes("flak") ? 3 : weapon.areaRadius > 0 ? 2 : 1;
  const yStep = width * 1.06;
  const parts = [
    `<ellipse cx="${cx + bodySize * 0.22}" cy="${cy + bodySize * 0.18}" rx="${core * 1.3}" ry="${core * 0.54}" fill="rgba(0,0,0,.38)"/>`,
    `<rect x="${cx - core * 0.8}" y="${cy - core * 0.62}" width="${core * 1.5}" height="${core * 1.2}" rx="2" fill="#050608" stroke="#a4abb1" stroke-width="1.2"/>`
  ];
  for (let index = 0; index < muzzleCount; index += 1) {
    const offset = (index - (muzzleCount - 1) / 2) * yStep;
    parts.push(`<path d="M ${cx + core * 0.42} ${cy + offset} L ${cx + bodySize * 0.55 + barrel} ${cy + offset * 0.48}" stroke="#060708" stroke-width="${width}" stroke-linecap="square"/>`);
    parts.push(`<path d="M ${cx + core * 0.42} ${cy + offset} L ${cx + bodySize * 0.55 + barrel} ${cy + offset * 0.48}" stroke="#7c838a" stroke-width="${Math.max(1, width * 0.2)}" stroke-linecap="square"/>`);
  }
  return `<g class="mounted-weapon">${parts.join("")}</g>`;
}

export function renderWeaponRadar(weapon: WeaponDefinition, size = 92): string {
  const stats = [
    ["DMG", weapon.damage / 58],
    ["RNG", weapon.range / 13],
    ["CAD", weapon.attackRate / 2.3],
    ["AP", weapon.armorPiercing / 0.8],
    ["AOE", weapon.areaRadius / 28],
    ["TRK", weapon.tracking]
  ] as const;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.34;
  const points = stats
    .map(([, value], index) => {
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / stats.length;
      const r = radius * Math.max(0.04, Math.min(1, value));
      return `${cx + Math.cos(angle) * r},${cy + Math.sin(angle) * r}`;
    })
    .join(" ");
  const axes = stats
    .map(([label], index) => {
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / stats.length;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      const tx = cx + Math.cos(angle) * (radius + 12);
      const ty = cy + Math.sin(angle) * (radius + 12);
      return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="rgba(160,166,172,.24)" stroke-width="1"/><text x="${tx}" y="${ty}" text-anchor="middle" dominant-baseline="middle" fill="#8c939a" font-size="7">${label}</text>`;
    })
    .join("");
  return `
    <svg class="weapon-radar" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-label="Profil arme ${weapon.name}">
      <circle cx="${cx}" cy="${cy}" r="${radius}" fill="rgba(0,0,0,.2)" stroke="rgba(160,166,172,.26)" stroke-width="1"/>
      <circle cx="${cx}" cy="${cy}" r="${radius * 0.5}" fill="none" stroke="rgba(160,166,172,.14)" stroke-width="1"/>
      ${axes}
      <polygon points="${points}" fill="rgba(120,126,132,.32)" stroke="${weaponAccent(weapon)}" stroke-width="2"/>
    </svg>
  `;
}

export function renderCombinedRadar(unit: UnitDefinition, size = 140, mode: "both" | "body" | "weapon" = "both"): string {
  const weapon = unit.weapon ?? getWeapon("kinetic");
  const axes = [
    { label: "PV", type: "body", value: unit.stats.hp / 240 },
    { label: "SPD", type: "body", value: unit.stats.speed / 8.5 },
    { label: "ARM", type: "body", value: unit.stats.armor / 10 },
    { label: "VIS", type: "body", value: unit.stats.vision / 14 },
    { label: "DMG", type: "weapon", value: weapon.damage / 70 },
    { label: "RNG", type: "weapon", value: weapon.range / 12 },
    { label: "CAD", type: "weapon", value: weapon.attackRate / 3 },
    { label: "AP", type: "weapon", value: weapon.armorPiercing / 0.8 },
    { label: "AOE", type: "weapon", value: weapon.areaRadius / 42 },
    { label: "TRK", type: "weapon", value: weapon.tracking }
  ] as const;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.35;
  const bodyColor = "#ffd84d";
  const weaponColor = "#c8ced4";
  const bodyVisible = mode === "both" || mode === "body";
  const weaponVisible = mode === "both" || mode === "weapon";

  const pointFor = (value: number, index: number): string => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / axes.length;
    const r = radius * Math.max(0.045, Math.min(1, value));
    return `${cx + Math.cos(angle) * r},${cy + Math.sin(angle) * r}`;
  };
  const polygonFor = (type: "body" | "weapon"): string =>
    axes
      .map((axis, index) => pointFor(axis.type === type ? axis.value : 0.045, index))
      .join(" ");
  const grid = axes
    .map((axis, index) => {
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / axes.length;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      const tx = cx + Math.cos(angle) * (radius + 16);
      const ty = cy + Math.sin(angle) * (radius + 16);
      const color = axis.type === "body" ? bodyColor : weaponColor;
      const showAxis = mode === "both" || mode === axis.type;
      return `
        <line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="${showAxis ? color : "rgba(120,130,140,.16)"}" stroke-width="${showAxis ? 1.25 : 0.75}" opacity="${showAxis ? 0.48 : 0.18}"/>
        <text x="${tx}" y="${ty}" text-anchor="middle" dominant-baseline="middle" fill="${showAxis ? color : "#56606a"}" font-size="10" font-weight="800">${axis.label}</text>
      `;
    })
    .join("");

  return `
    <svg class="combined-radar" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-label="Signature ${unit.name}">
      <circle cx="${cx}" cy="${cy}" r="${radius}" fill="rgba(0,0,0,.18)" stroke="rgba(140,155,165,.28)" stroke-width="1"/>
      <circle cx="${cx}" cy="${cy}" r="${radius * 0.66}" fill="none" stroke="rgba(140,155,165,.16)" stroke-width="1"/>
      <circle cx="${cx}" cy="${cy}" r="${radius * 0.33}" fill="none" stroke="rgba(140,155,165,.12)" stroke-width="1"/>
      ${grid}
      ${bodyVisible ? `<polygon points="${polygonFor("body")}" fill="rgba(255,216,77,.22)" stroke="${bodyColor}" stroke-width="2"/>` : ""}
      ${weaponVisible ? `<polygon points="${polygonFor("weapon")}" fill="rgba(200,206,212,.22)" stroke="${weaponColor}" stroke-width="2"/>` : ""}
    </svg>
  `;
}

function hashUnit(unit: UnitDefinition): number {
  const text = `${unit.id}_${unit.name}_${unit.stats.hp}_${unit.stats.damage}_${unit.stats.range}_${unit.stats.speed}_${Object.values(unit.traits).join("")}`;
  let hash = 2166136261;
  for (const char of text) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function hashText(text: string): number {
  let hash = 2166136261;
  for (const char of text) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function weaponAccent(weapon: WeaponDefinition): string {
  const accents: Record<WeaponDefinition["damageType"], string> = {
    kinetic: "#9ba0a4",
    explosive: "#b5a06c",
    energy: "#b4d1d8",
    emp: "#aeb5ff",
    piercing: "#d2d2d2",
    flak: "#8e969e"
  };
  return accents[weapon.damageType];
}

function seeded(seed: number): () => number {
  let value = seed;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
