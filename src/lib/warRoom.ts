import { PLAYERS_2026, type Player } from "./players";
import {
  extractFromText,
  ownerSlot,
  pickReasons,
  picksUntilTurn,
  type BoardCtx,
  counts,
  shieldIntegrity,
  nextHumanOffset,
  autodraftIndex,
  reconstructRosters,
  livePickCount,
  quickMatch,
  vorp,
} from "./engine";
import { bestCliff, seatBias, synergyTags, vona, type Cliff } from "./synergy";

export type RankedRow = {
  player: Player;
  score: number;
  safe: boolean;
  safeUntil: number;
};

export type WarRoom = {
  target: Player;
  why: string;
  threat: string;
  integrity: number;
  deadZone: string;
  shield: Player[];
  cpuFallback: Player | null;
  contingency: Player | null;
  cliff: Cliff | null;
  intel: string;
  tags: string[];
  vorp: number;
  vona: number;
};

function reconstruct(draftedIds: string[], ctx: BoardCtx): Record<number, Player[]> {
  return reconstructRosters(draftedIds, ctx.teams, ctx.keeperSeats);
}

export function describeHumanThreat(
  player: Player,
  ctx: BoardCtx,
  window: number,
): string {
  const humans = ctx.humanSlots ?? [];
  if (!humans.length) {
    return "No live seats tagged — field is treated as ESPN printers.";
  }
  const drafted = ctx.draftedIds ?? [];
  const slot = ctx.slot ?? 1;
  const league = ctx.teams;
  const teams = reconstruct(drafted, ctx);
  const live = livePickCount(drafted, ctx.keeperSeats);
  for (let i = 1; i <= Math.max(window, 1); i++) {
    const who = ownerSlot(live + i, league);
    if (who === slot || !humans.includes(who)) continue;
    const roster = teams[who] ?? [];
    const c = counts(roster);
    const hungry =
      (player.position === "WR" && c.WR < 2) ||
      (player.position === "RB" && c.RB < 2) ||
      (player.position === "TE" && c.TE < 1);
    if (hungry) {
      return `Seat ${who} (human) still needs ${player.position} and picks before you're back.`;
    }
  }
  return "Tagged humans on this wrap do not need this position.";
}

export function warRoomCard(
  rows: RankedRow[],
  team: Player[],
  available: Player[],
  untilMine: number,
  ctx: BoardCtx,
): WarRoom | null {
  if (!rows.length) return null;
  const target = rows[0].player;
  const contingency = rows[1]?.player ?? null;
  const drafted = ctx.draftedIds ?? [];
  const slot = ctx.slot ?? 1;
  const live = livePickCount(drafted, ctx.keeperSeats);
  const window = untilMine <= 1 ? picksUntilTurn(live + 1, slot, ctx.teams) : untilMine;
  const why = pickReasons(target, team, available, untilMine).slice(0, 2).join(" · ");
  const integrity = shieldIntegrity(target, available, ctx);
  const human = nextHumanOffset(drafted.length, slot, ctx.humanSlots ?? [], window, ctx.teams);
  const cpuDist = autodraftIndex(target, available) + 1;
  let deadZone = "No human on this wrap.";
  if (human && human.offset <= window) {
    deadZone =
      human.offset <= cpuDist
        ? `DEAD ZONE · seat ${human.seat} sits on this wrap and can see ${target.name}.`
        : `Seat ${human.seat} is on the wrap but after ESPN would take him.`;
  }
  const cpuFallback =
    rows.find((r) => {
      if (r.player.id === target.id) return false;
      return shieldIntegrity(r.player, available, ctx) >= 90;
    })?.player ?? null;
  const shield = rows
    .filter((r) => r.player.id !== target.id && shieldIntegrity(r.player, available, ctx) >= 80)
    .slice(0, 2)
    .map((r) => r.player);
  const rosters = reconstruct(drafted, ctx);
  const intelBits = (ctx.humanSlots ?? [])
    .map((seat) => {
      const b = seatBias(rosters[seat] ?? []);
      if (b === "balanced") return null;
      return `Seat ${seat} ${b === "wr-heavy" ? "WR-heavy · WR shield is dead" : "RB-heavy"}`;
    })
    .filter((line): line is string => Boolean(line));
  return {
    target,
    why,
    threat: describeHumanThreat(target, ctx, window),
    integrity,
    deadZone,
    shield,
    cpuFallback,
    contingency,
    cliff: bestCliff(available),
    intel: intelBits.length ? intelBits.join(" · ") : "No positional tell yet on tagged humans.",
    tags: synergyTags(target, team),
    vorp: vorp(target, available, ctx.teams),
    vona: vona(target, available),
  };
}

export function parseKeepers(
  raw: string,
  players: Player[],
): { player: Player; seat: number }[] {
  const out: { player: Player; seat: number }[] = [];
  for (const line of raw.split("\n")) {
    const m = line.trim().match(/^(\d+)\s*[:.\-)]\s*(.+)$/) || line.trim().match(/^(\d+)\s+(.+)$/);
    if (!m) continue;
    const seat = Number(m[1]);
    const hit = extractFromText(m[2], players)[0] ?? quickMatch(m[2], players);
    if (hit && seat >= 1) out.push({ player: hit, seat });
  }
  return out;
}

export function matchInOrder(names: string[], players: Player[]): Player[] {
  const out: Player[] = [];
  const used = new Set<string>();
  for (const name of names) {
    const hit = extractFromText(name, players)[0];
    if (hit && !used.has(hit.id)) {
      used.add(hit.id);
      out.push(hit);
    }
  }
  return out;
}

export function parseDump(
  raw: string,
  players: Player[],
): { taken: Player[]; queue: Player[] } {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const data = JSON.parse(trimmed) as {
        draftHistory?: Array<{ name?: string } | string>;
        picks?: Array<{ name?: string } | string>;
        topAvailableESPN?: Array<{ name?: string } | string>;
        queue?: Array<{ name?: string } | string>;
      };
      const hist = Array.isArray(data)
        ? data
        : (data.draftHistory ?? data.picks ?? []);
      const q = Array.isArray(data) ? [] : (data.topAvailableESPN ?? data.queue ?? []);
      const takenNames = hist
        .map((row) => (typeof row === "string" ? row : row?.name ?? ""))
        .filter(Boolean)
        .join("\n");
      const queueNames = q
        .map((row) => (typeof row === "string" ? row : row?.name ?? ""))
        .filter(Boolean)
        .join("\n");
      return {
        taken: takenNames ? matchInOrder(takenNames.split("\n"), players) : [],
        queue: queueNames ? matchInOrder(queueNames.split("\n"), players) : [],
      };
    } catch {
      /* fall through */
    }
  }
  return { taken: extractFromText(raw, players), queue: [] };
}
