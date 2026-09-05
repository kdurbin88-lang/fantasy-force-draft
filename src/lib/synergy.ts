import { PLAYERS_2026, type Player, type Position } from "./players";

const STARTERS: Record<Position, number> = {
  QB: 1,
  RB: 2,
  WR: 4,
  TE: 1,
  K: 1,
  DST: 1,
};

export function replacementSlot(pos: Position, teams = 12): number {
  return teams * STARTERS[pos];
}

export function vona(player: Player, available: Player[]): number {
  const rest = available
    .filter((p) => p.id !== player.id && p.position === player.position)
    .sort((a, b) => b.proj - a.proj);
  const next = rest[0];
  return Math.round((player.proj - (next?.proj ?? 0)) * 10) / 10;
}

export type Cliff = { pos: Position; label: string; drop: number };

export function posCliff(pos: Position, available: Player[]): Cliff | null {
  const list = available.filter((p) => p.position === pos).sort((a, b) => b.proj - a.proj);
  if (list.length < 3) return null;
  const d01 = list[0].proj - list[1].proj;
  const d12 = list[1].proj - list[2].proj;
  if (d01 >= 16) {
    return {
      pos,
      drop: Math.round(d01),
      label: `TIER CLIFF · last elite ${pos} is ${list[0].name} (+${Math.round(d01)} PPR)`,
    };
  }
  if (d12 >= 12 && d12 > d01 * 1.8) {
    return {
      pos,
      drop: Math.round(d12),
      label: `TIER CLIFF · ${pos} falls off after ${list[1].name} (−${Math.round(d12)} PPR)`,
    };
  }
  return null;
}

export function bestCliff(available: Player[]): Cliff | null {
  let best: Cliff | null = null;
  for (const pos of ["WR", "RB", "TE", "QB"] as Position[]) {
    const c = posCliff(pos, available);
    if (c && (!best || c.drop > best.drop)) best = c;
  }
  return best;
}

export function isHandcuff(player: Player, team: Player[]): boolean {
  if (player.position !== "RB") return false;
  return team.some((p) => p.position === "RB" && p.team === player.team && p.id !== player.id);
}

export function isStack(player: Player, team: Player[]): boolean {
  if (player.position === "QB") {
    return team.some((p) => (p.position === "WR" || p.position === "TE") && p.team === player.team);
  }
  if (player.position === "WR" || player.position === "TE") {
    return team.some((p) => p.position === "QB" && p.team === player.team);
  }
  return false;
}

export function synergyTags(player: Player, team: Player[]): string[] {
  const tags: string[] = [];
  if (isHandcuff(player, team)) tags.push("HANDCUFF");
  if (isStack(player, team)) tags.push("STACK");
  return tags;
}

export type Bias = "wr-heavy" | "rb-heavy" | "balanced";

export function seatBias(roster: Player[]): Bias {
  if (roster.length < 3) return "balanced";
  const wr = roster.filter((p) => p.position === "WR").length;
  const rb = roster.filter((p) => p.position === "RB").length;
  if (wr >= 3 && rb === 0) return "wr-heavy";
  if (wr / roster.length >= 0.6) return "wr-heavy";
  if (rb >= 2 && wr === 0) return "rb-heavy";
  if (rb / roster.length >= 0.5) return "rb-heavy";
  return "balanced";
}

export function handcuffFor(starter: Player, pool: Player[] = PLAYERS_2026): Player | null {
  if (starter.position !== "RB") return null;
  return (
    pool
      .filter((p) => p.position === "RB" && p.team === starter.team && p.id !== starter.id)
      .sort((a, b) => b.proj - a.proj)[0] ?? null
  );
}
