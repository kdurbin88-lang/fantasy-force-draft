import { PLAYERS_2026, type Player, type Position } from "./players";
import { replacementSlot, isHandcuff, isStack, seatBias, vona } from "./synergy";
import { injuryFactor, opportunityWeight, sosPlayoff } from "./outlook";
import { LAST_YEAR } from "./lastYear";

export const TEAMS = 12;

export function ownerSlot(overall: number, teams = TEAMS): number {
  const round = Math.ceil(overall / teams);
  const pos = ((overall - 1) % teams) + 1;
  return round % 2 === 1 ? pos : teams - pos + 1;
}

export type BoardCtx = {
  draftedIds?: string[];
  slot?: number;
  humanSlots?: number[];
  teams?: number;
  keeperSeats?: Record<string, number>;
};

export function reconstructRosters(
  draftedIds: string[],
  leagueSize = TEAMS,
  keeperSeats: Record<string, number> = {},
): Record<number, Player[]> {
  const byTeam: Record<number, Player[]> = {};
  let live = 0;
  for (const id of draftedIds) {
    const p = PLAYERS_2026.find((x) => x.id === id);
    if (!p) continue;
    const seat = keeperSeats[id] ?? ownerSlot(++live, leagueSize);
    (byTeam[seat] ??= []).push(p);
  }
  return byTeam;
}

export function livePickCount(draftedIds: string[], keeperSeats: Record<string, number> = {}) {
  return draftedIds.filter((id) => !keeperSeats[id]).length;
}

export function playbookFor(slot: number, teams = TEAMS): "wheel" | "mid" | "anchor" {
  if (slot <= 2 || slot >= teams - 1) return "wheel";
  if (slot === 3 || slot === teams - 2) return "anchor";
  return "mid";
}

export const ROSTER = {
  QB: 1,
  RB: 2,
  WR: 3,
  TE: 1,
  FLEX: 1,
  K: 1,
  DST: 1,
} as const;

export type RosterNeed = keyof typeof ROSTER;

export function counts(team: Player[]) {
  return {
    QB: team.filter((p) => p.position === "QB").length,
    RB: team.filter((p) => p.position === "RB").length,
    WR: team.filter((p) => p.position === "WR").length,
    TE: team.filter((p) => p.position === "TE").length,
    K: team.filter((p) => p.position === "K").length,
    DST: team.filter((p) => p.position === "DST").length,
  };
}

export function flexFilled(team: Player[]) {
  const c = counts(team);
  const extraRb = Math.max(0, c.RB - ROSTER.RB);
  const extraWr = Math.max(0, c.WR - ROSTER.WR);
  const extraTe = Math.max(0, c.TE - ROSTER.TE);
  return extraRb + extraWr + extraTe;
}

export function needSlots(team: Player[]) {
  const c = counts(team);
  const flex = Math.min(ROSTER.FLEX, flexFilled(team));
  return {
    QB: { have: c.QB, need: ROSTER.QB, filled: c.QB >= ROSTER.QB },
    RB: { have: c.RB, need: ROSTER.RB, filled: c.RB >= ROSTER.RB },
    WR: { have: c.WR, need: ROSTER.WR, filled: c.WR >= ROSTER.WR },
    TE: { have: c.TE, need: ROSTER.TE, filled: c.TE >= ROSTER.TE },
    FLEX: { have: flex, need: ROSTER.FLEX, filled: flex >= ROSTER.FLEX },
    K: { have: c.K, need: ROSTER.K, filled: c.K >= ROSTER.K },
    DST: { have: c.DST, need: ROSTER.DST, filled: c.DST >= ROSTER.DST },
  };
}

const replacementCache = new Map<string, number>();

export function replacementPts(pos: Position, pool: Player[] = PLAYERS_2026, teams = TEAMS): number {
  const key = `${pos}:${teams}:${pool.length}:${pool[0]?.id ?? ""}:${pool[pool.length - 1]?.id ?? ""}`;
  const hit = replacementCache.get(key);
  if (hit != null) return hit;
  const list = pool.filter((p) => p.position === pos).sort((a, b) => b.proj - a.proj);
  const idx = Math.min(Math.max(list.length - 1, 0), replacementSlot(pos, teams) - 1);
  const pts = list[idx]?.proj ?? 0;
  replacementCache.set(key, pts);
  if (replacementCache.size > 400) replacementCache.clear();
  return pts;
}

export function vorp(player: Player, pool: Player[] = PLAYERS_2026, teams = TEAMS): number {
  return Math.round((player.proj - replacementPts(player.position, pool, teams)) * 10) / 10;
}

/** Last-year proof: don't chase a projection that the player has never approached. */
function provenMult(player: Player): number {
  const ly = LAST_YEAR[player.id];
  if (!ly) return player.isRookie ? 1.04 : 1;
  if (ly.fpts >= 300) return 1.06;
  if (ly.fpts >= player.proj * 0.9) return 1.03;
  if (ly.fpts < player.proj * 0.65 && injuryFactor(player.name) < 0.9) return 0.96;
  return 1;
}

/** Prefer a high floor in PPR; still leave ceiling in the mix. */
function floorMult(player: Player): number {
  if (!player.ppg) return 1;
  const stable = Math.min(1.08, Math.max(0.9, player.floor / player.ppg));
  return 0.92 + 0.08 * stable;
}

export function starterLineup(team: Player[]): Player[] {
  const by = (pos: Position) =>
    team.filter((p) => p.position === pos).sort((a, b) => b.proj - a.proj);
  const qb = by("QB").slice(0, 1);
  const rb = by("RB").slice(0, 2);
  const wr = by("WR").slice(0, 3);
  const te = by("TE").slice(0, 1);
  const k = by("K").slice(0, 1);
  const dst = by("DST").slice(0, 1);
  const used = new Set([...qb, ...rb, ...wr, ...te, ...k, ...dst].map((p) => p.id));
  const flexPool = team
    .filter((p) => !used.has(p.id) && (p.position === "RB" || p.position === "WR" || p.position === "TE"))
    .sort((a, b) => b.proj - a.proj);
  const flex = flexPool.slice(0, 1);
  return [...qb, ...rb, ...wr, ...te, ...flex, ...k, ...dst];
}

export function lineupProj(team: Player[]): number {
  return Math.round(starterLineup(team).reduce((s, p) => s + p.proj, 0));
}

export function calculatePower(team: Player[]): number {
  if (team.length === 0) return 0;
  const pts = lineupProj(team);
  const replacementLineup =
    replacementPts("QB") +
    replacementPts("RB") * 2 +
    replacementPts("WR") * 3 +
    replacementPts("TE") +
    replacementPts("WR") * 0.6 +
    replacementPts("RB") * 0.4 +
    replacementPts("K") +
    replacementPts("DST");
  const elite =
    365 + 350 + 335 + 325 + 310 + 290 + 240 + 250 + 140 + 130;
  const raw = ((pts - replacementLineup * (team.length / 9)) / (elite - replacementLineup)) * 100;
  const filled = Math.min(1, starterLineup(team).length / 9);
  return Math.min(100, Math.max(0, Math.round(raw * filled + filled * 18)));
}

export function gradeFor(score: number): string {
  if (score >= 92) return "A+";
  if (score >= 87) return "A";
  if (score >= 82) return "A-";
  if (score >= 77) return "B+";
  if (score >= 72) return "B";
  if (score >= 67) return "B-";
  if (score >= 62) return "C+";
  if (score >= 57) return "C";
  return "C-";
}

export function lineupDelta(team: Player[], player: Player): number {
  return lineupProj([...team, player]) - lineupProj(team);
}

export type ImpactGrade = "MUST" | "HIGH" | "SOLID" | "STEAL" | "LOW" | "SKIP";

export type RosterImpact = {
  score: number;
  grade: ImpactGrade;
  label: string;
};

function weeklyLineupDelta(team: Player[], player: Player): number {
  return lineupDelta(team, player) / 17;
}

function skillStarters(team: Player[]): Player[] {
  return starterLineup(team).filter(
    (p) => p.position === "RB" || p.position === "WR" || p.position === "TE" || p.position === "QB",
  );
}

function lowestSkillPpg(team: Player[]): number {
  const s = skillStarters(team);
  if (!s.length) return 0;
  return Math.min(...s.map((p) => p.ppg || p.proj / 17));
}

function starterNeed(pos: Position): number {
  if (pos === "WR") return ROSTER.WR;
  if (pos === "RB") return ROSTER.RB;
  if (pos === "QB") return ROSTER.QB;
  if (pos === "TE") return ROSTER.TE;
  return 1;
}

function haveAt(pos: Position, team: Player[]): number {
  return counts(team)[pos === "DST" ? "DST" : pos];
}

/** Context-aware weekly-lineup impact. Ignores BPA/ADP except the STEAL override. */
export function rosterImpact(player: Player, team: Player[], overallPick = team.length + 1): RosterImpact {
  const pos = player.position;
  const have = haveAt(pos, team);
  const need = starterNeed(pos);
  const flex = flexFilled(team);
  const deltaW = weeklyLineupDelta(team, player);
  const ppg = player.ppg || player.proj / 17;
  const floor = lowestSkillPpg(team);
  const lateEnough = team.length >= 3 || overallPick >= 24;
  const hole = have < need;
  const skill = pos === "RB" || pos === "WR" || pos === "TE";
  const oversat = have >= need + (flex >= 1 ? 1 : 0) + 1;
  const beatsFlex = skill && deltaW > 2;
  const upgrade = skill && floor > 0 && ppg > floor + 2;

  let grade: ImpactGrade = "SOLID";
  let label = "High-value depth / Flex viable.";
  let score = Math.round(Math.max(8, Math.min(99, deltaW * 18 + (hole ? 20 : 0))));

  if (pos === "K" || pos === "DST") {
    if (team.length >= 12 && have === 0) {
      return { score: 52, grade: "SOLID", label: "High-value depth / Flex viable." };
    }
    return { score: 8, grade: "SKIP", label: "Roster is saturated at this position." };
  }

  if (pos === "QB") {
    if (have === 0 && team.length >= 7) {
      grade = "HIGH";
      label = "Locks an elite starter.";
      score = 72;
    } else if (have === 0) {
      grade = "LOW";
      label = "Bench depth / injury backup.";
      score = 28;
    } else {
      grade = "SKIP";
      label = "Roster is saturated at this position.";
      score = 10;
    }
  } else if (hole && lateEnough) {
    grade = "MUST";
    label = `Fills the ${pos} hole.`;
    score = Math.max(score, 90);
  } else if (hole && !lateEnough) {
    grade = have === 0 ? "HIGH" : "SOLID";
    label = have === 0 ? "Locks an elite starter." : "High-value depth / Flex viable.";
    score = have === 0 ? Math.max(score, 80) : 64;
  } else if (beatsFlex || upgrade) {
    grade = "HIGH";
    label = "Beats a starter / FLEX by 2+ PPG";
    score = Math.max(score, 78);
  } else if (deltaW >= 0.4 && (flex < 1 || have === need)) {
    grade = "SOLID";
    label = "High-value depth / Flex viable.";
    score = Math.max(score, 58);
  } else if (oversat || deltaW < 0.15) {
    grade = "SKIP";
    label = "Position is full; zero weekly lift";
    score = Math.min(score, 22);
  } else {
    grade = "LOW";
    label = "Bench depth / injury backup.";
    score = Math.min(Math.max(score, 24), 40);
  }

  const dropped = player.adp > 0 && overallPick - player.adp >= 12;
  const saturated = skill && have >= need && flex >= 1;
  if (dropped && grade !== "MUST") {
    if (grade === "SOLID" || grade === "LOW" || grade === "SKIP" || (grade === "HIGH" && saturated)) {
      grade = "STEAL";
      label = "Too much value to pass up.";
      score = Math.max(score, 70);
    }
  }

  return { score, grade, label };
}

function urgency(pos: Position, team: Player[]): number {
  const c = counts(team);
  const n = team.length;
  const flex = flexFilled(team) >= ROSTER.FLEX;
  if (pos === "K" || pos === "DST") return n >= 13 ? 1 : 0.08;
  if (pos === "QB") {
    if (c.QB >= 1) return 0.05;
    if (n === 0) return 0.18;
    if (n < 4) return 0.28;
    if (n < 6) return 0.8;
    return 1.25;
  }
  if (pos === "TE") return c.TE >= 1 ? 0.12 : 1.22;
  if (pos === "WR") {
    if (c.WR === 0) return n === 0 ? 1.12 : 1.55;
    if (c.WR === 1) return 1.38;
    if (c.WR === 2) return 1.22;
    if (c.WR === 3 && !flex) return 1.08;
    if (c.WR === 3) return 0.42;
    return 0.22;
  }
  if (pos === "RB") {
    if (c.RB === 0) return n === 0 ? 1.04 : 1.68;
    if (c.RB === 1) return 1.28;
    if (!flex) return 0.9;
    return 0.22;
  }
  return 1;
}

export function elitesAt(available: Player[], pos: Position): Player[] {
  const pool = available
    .filter((p) => p.position === pos)
    .sort((a, b) => trueValueOf(b, available) - trueValueOf(a, available));
  if (pool.length === 0) return [];
  const top = trueValueOf(pool[0], available);
  return pool.filter(
    (p, i) => i < 8 && trueValueOf(p, available) >= top * 0.62 && vorp(p, available) >= 22,
  );
}

function lastEliteBump(player: Player, team: Player[], available: Player[]): number {
  const c = counts(team);
  const need =
    player.position === "WR" ? 4 : player.position === "RB" ? 2 : player.position === "TE" ? 1 : 1;
  const have =
    player.position === "WR"
      ? c.WR
      : player.position === "RB"
        ? c.RB
        : player.position === "TE"
          ? c.TE
          : player.position === "QB"
            ? c.QB
            : 0;
  if (have >= need) return 1;
  if (team.length < 2) return 1;
  const n = elitesAt(available, player.position).length;
  if (n <= 1) return 1.48;
  if (n <= 2 && have === 0) return 1.22;
  return 1;
}

export function positionHeat(
  draftedIds: string[],
  slot: number,
  pos: Position,
  untilMine: number,
): number {
  if (untilMine <= 0) return 0;
  const teams: Record<number, Player[]> = {};
  draftedIds.forEach((id, i) => {
    const p = PLAYERS_2026.find((x) => x.id === id);
    if (!p) return;
    const s = ownerSlot(i + 1);
    (teams[s] ??= []).push(p);
  });
  let hungry = 0;
  let n = 0;
  for (let i = 1; i <= untilMine; i++) {
    const who = ownerSlot(draftedIds.length + i);
    if (who === slot) continue;
    const roster = teams[who] ?? [];
    if (roster.length === 0) continue;
    n += 1;
    const c = counts(roster);
    const hole =
      pos === "RB"
        ? c.RB < 2
        : pos === "WR"
          ? c.WR < 3
          : pos === "QB"
            ? c.QB < 1
            : pos === "TE"
              ? c.TE < 1
              : false;
    if (hole) hungry += 1;
  }
  return n ? hungry / n : 0;
}

export function nextHumanOffset(
  draftedCount: number,
  slot: number,
  humanSlots: number[],
  look = 24,
  teams = TEAMS,
): { offset: number; seat: number } | null {
  for (let i = 1; i <= look; i++) {
    const who = ownerSlot(draftedCount + i, teams);
    if (who !== slot && humanSlots.includes(who)) return { offset: i, seat: who };
  }
  return null;
}

/** 0 if a human can still see him before printers take him. Never 100 on a queue name we skip to an adjacent human. */
export function shieldIntegrity(player: Player, available: Player[], ctx: BoardCtx): number {
  const humans = ctx.humanSlots ?? [];
  if (!humans.length) return 100;
  const teams = ctx.teams ?? TEAMS;
  const draftedIds = ctx.draftedIds ?? [];
  const live = livePickCount(draftedIds, ctx.keeperSeats);
  const slot = ctx.slot ?? 1;
  const onClock = ownerSlot(live + 1, teams) === slot;
  const cpu = autodraftIndex(player, available) + 1;
  const human = nextHumanOffset(live, slot, humans, 36, teams);
  if (!human) return 100;
  if (human.offset <= cpu) return 0;
  if (onClock && human.offset <= 2 && cpu <= 8) return 0;
  if (player.position === "WR") {
    const rosters = reconstructRosters(draftedIds, teams, ctx.keeperSeats);
    const live = livePickCount(draftedIds, ctx.keeperSeats);
    for (let i = 1; i <= 16; i++) {
      const who = ownerSlot(live + i, teams);
      if (who === slot || !humans.includes(who)) continue;
      if (seatBias(rosters[who] ?? []) === "wr-heavy") return 0;
    }
  }
  return Math.round(Math.min(100, (human.offset / Math.max(cpu, 1)) * 100));
}

export function hungryHumanCount(
  pos: Position,
  draftedIds: string[],
  humanSlots: number[],
  slot: number,
  window: number,
  leagueSize = TEAMS,
  keeperSeats: Record<string, number> = {},
): number {
  if (!humanSlots.length || window <= 0) return 0;
  const byTeam = reconstructRosters(draftedIds, leagueSize, keeperSeats);
  let n = 0;
  const live = livePickCount(draftedIds, keeperSeats);
  for (let i = 1; i <= window; i++) {
    const who = ownerSlot(live + i, leagueSize);
    if (who === slot || !humanSlots.includes(who)) continue;
    const c = counts(byTeam[who] ?? []);
    if (pos === "WR" && c.WR < 3) n += 1;
    else if (pos === "RB" && c.RB < 2) n += 1;
    else if (pos === "TE" && c.TE < 1) n += 1;
  }
  return n;
}

function dropOff(player: Player, team: Player[], available: Player[]): number {
  const rest = available
    .filter((p) => p.id !== player.id && p.position === player.position)
    .sort((a, b) => lineupDelta(team, b) - lineupDelta(team, a));
  const next = rest[0];
  if (!next) return lineupDelta(team, player);
  return lineupDelta(team, player) - lineupDelta(team, next);
}

function valueClash(player: Player, team: Player[], available: Player[]): number {
  const c = counts(team);
  if (player.position !== "RB" || c.RB > 0) return 1;
  const bestWR = available
    .filter((p) => p.position === "WR")
    .sort((a, b) => lineupDelta(team, b) - lineupDelta(team, a))[0];
  if (!bestWR) return 1;
  const rbPts = lineupDelta(team, player);
  const wrPts = lineupDelta(team, bestWR);
  const rbDrop = dropOff(player, team, available);
  const wrDrop = dropOff(bestWR, team, available);
  if (wrPts > rbPts * 1.18 && wrDrop > rbDrop + 16) return 0.55;
  if (rbPts < wrPts * 0.7) return 0.68;
  return 1;
}

function zeroRbHatch(player: Player, team: Player[]): number {
  const c = counts(team);
  if (c.RB > 0 || team.length < 3 || player.position !== "RB") return 1;
  if (player.rec >= 55) return 1.14;
  if (player.rec < 35) return 0.68;
  return 0.88;
}

/** First 4 roster picks are WR. No committee RBs, QBs, or kickers. */
function wrFirstFour(player: Player, team: Player[]): number {
  if (team.length >= 4) return 1;
  if (player.position === "WR") return 1.55;
  if (player.position === "TE" && (player.espnRank ?? player.rank) <= 10) return 0.7;
  return 0.05;
}

function heatMult(need: boolean, heat: number, onClock: boolean): number {
  if (heat < 0.34) return 1;
  if (onClock) return need ? 1 + heat * 0.4 : 0.88;
  return 0.4;
}

function holeAt(pos: Position, team: Player[]): boolean {
  const c = counts(team);
  if (pos === "RB") return c.RB < 2;
  if (pos === "WR") return c.WR < 3;
  if (pos === "TE") return c.TE < 1;
  if (pos === "QB") return c.QB < 1;
  return false;
}

function fitsEspnStarter(roster: Player[], player: Player): boolean {
  const c = counts(roster);
  const flex = flexFilled(roster);
  if (player.position === "QB") return c.QB < 1;
  if (player.position === "K") return c.K < 1 && roster.length >= 12;
  if (player.position === "DST") return c.DST < 1 && roster.length >= 12;
  if (player.position === "TE") return c.TE < 1 || flex < 1;
  if (player.position === "RB") return c.RB < 2 || flex < 1;
  if (player.position === "WR") return c.WR < 3 || flex < 1;
  return true;
}

function takeSlot(p: Player): number {
  return p.espnRank ?? p.adp;
}

let espnSortKey = "";
let espnSortList: Player[] = [];
function sortedByEspn(available: Player[]): Player[] {
  const key = `${available.length}:${available[0]?.id ?? ""}:${available[available.length - 1]?.id ?? ""}`;
  if (key === espnSortKey && espnSortList.length === available.length) return espnSortList;
  espnSortKey = key;
  espnSortList = [...available].sort((a, b) => takeSlot(a) - takeSlot(b));
  return espnSortList;
}

function espnAutoTake(available: Player[], roster: Player[]): Player | null {
  return sortedByEspn(available).find((p) => fitsEspnStarter(roster, p)) ?? available[0] ?? null;
}

function humanTake(available: Player[], roster: Player[]): Player | null {
  const c = counts(roster);
  const bias = seatBias(roster);
  const byValue = [...available].sort(
    (a, b) => trueValueOf(b, available) - trueValueOf(a, available),
  );
  if (bias === "wr-heavy") {
    const wr = byValue.find((p) => p.position === "WR");
    if (wr) return wr;
  }
  if (bias === "rb-heavy") {
    const rb = byValue.find((p) => p.position === "RB");
    if (rb) return rb;
  }
  if (c.WR < 3) {
    const wr = byValue.find((p) => p.position === "WR");
    if (wr) return wr;
  }
  if (c.RB === 0) {
    const rb = byValue.find((p) => p.position === "RB");
    if (rb) return rb;
  }
  return espnAutoTake(available, roster);
}

/** Next `n` picks: printers fill ESPN starters; tagged humans go WR-heavy. */
export function simulateEspnWindow(
  available: Player[],
  draftedIds: string[],
  mySlot: number,
  n: number,
  humanSlots: number[] = [],
  teams = TEAMS,
  keeperSeats: Record<string, number> = {},
): Player[] {
  if (n <= 0) return [];
  const humans = new Set(humanSlots);
  const byTeam = reconstructRosters(draftedIds, teams, keeperSeats);
  let board = [...available];
  const taken: Player[] = [];
  const live = livePickCount(draftedIds, keeperSeats);
  for (let i = 1; i <= n; i++) {
    const who = ownerSlot(live + i, teams);
    if (who === mySlot) continue;
    const pick = humans.has(who)
      ? humanTake(board, byTeam[who] ?? [])
      : espnAutoTake(board, byTeam[who] ?? []);
    if (!pick) break;
    taken.push(pick);
    board = board.filter((p) => p.id !== pick.id);
    (byTeam[who] ??= []).push(pick);
  }
  return taken;
}



function adpWindow(available: Player[], untilMine: number): Player[] {
  if (untilMine <= 0) return [];
  return sortedByEspn(available).slice(0, untilMine);
}

/** Probability each skill position is drained in the next `untilMine` ADP picks. */
export function projectBoardDrain(available: Player[], untilMine: number) {
  const window = adpWindow(available, untilMine);
  const n = Math.max(window.length, 1);
  const drain = (pos: Position) => window.filter((p) => p.position === pos).length / n;
  return {
    QB: drain("QB"),
    RB: drain("RB"),
    WR: drain("WR"),
    TE: drain("TE"),
  };
}

/** Cliff at this position before you're on the clock again. 1.0 = flat. */
export function scarcity(pos: Position, available: Player[], untilMine: number): number {
  const pool = available
    .filter((p) => p.position === pos)
    .sort((a, b) => b.proj - a.proj);
  if (pool.length < 2) return 1;
  const gone = adpWindow(available, untilMine).filter((p) => p.position === pos).length;
  const top = pool[0].proj;
  const later = pool[Math.min(gone, pool.length - 1)].proj;
  const drop = Math.max(0, top - later);
  const drain = projectBoardDrain(available, untilMine)[pos as "QB" | "RB" | "WR" | "TE"] ?? 0;
  return 1 + drop / Math.max(top, 1) + drain * 0.4;
}

function byeHit(player: Player, team: Player[]): number {
  if (player.position !== "RB" && player.position !== "WR") return 0;
  const same = team.filter(
    (p) =>
      p.bye === player.bye &&
      (p.position === player.position || p.position === "WR" || p.position === "RB"),
  ).length;
  return same >= 1 ? 12 : 0;
}

function stackBonus(player: Player, team: Player[]): number {
  return isStack(player, team) ? 14 : 0;
}

function survivalMult(player: Player, available: Player[], untilMine: number): number {
  if (untilMine <= 1) return 1;
  const doomed = adpWindow(available, untilMine).some((p) => p.id === player.id);
  // Waiting: never recommend someone autodraft will take before you're back.
  return doomed ? 0.2 : 1.12;
}

export function trueValueOf(player: Player, pool: Player[] = PLAYERS_2026): number {
  return (
    vorp(player, pool) *
    injuryFactor(player.name) *
    sosPlayoff(player.team) *
    opportunityWeight(player.rec, player.recTd, player.rushTd) *
    provenMult(player) *
    floorMult(player)
  );
}

export function posTier(player: Player, available: Player[]): 1 | 2 | 3 | 4 {
  const pool = available
    .filter((p) => p.position === player.position)
    .sort((a, b) => trueValueOf(b, available) - trueValueOf(a, available));
  const idx = pool.findIndex((p) => p.id === player.id);
  if (idx < 0 || idx >= 20) return 4;
  if (idx < 4) return 1;
  if (idx < 12) return 2;
  return 3;
}

export function autodraftIndex(player: Player, available: Player[]): number {
  return sortedByEspn(available).findIndex((p) => p.id === player.id);
}

export function eliteLeft(available: Player[], pos: Position): number {
  return elitesAt(available, pos).length;
}

function afterAutodraft(available: Player[], excludeId: string, untilMine: number): Player[] {
  const rest = available.filter((p) => p.id !== excludeId);
  const taken = new Set(adpWindow(rest, untilMine).map((p) => p.id));
  return rest.filter((p) => !taken.has(p.id));
}

function bestFollowUp(board: Player[], team: Player[]): number {
  if (board.length === 0) return 0;
  let best = -Infinity;
  for (const p of board) {
    const s = trueValueOf(p, board) * urgency(p.position, team);
    if (s > best) best = s;
  }
  return best;
}

export function pathPlan(available: Player[], team: Player[], untilMine: number) {
  const wr = available
    .filter((p) => p.position === "WR")
    .sort((a, b) => trueValueOf(b, available) - trueValueOf(a, available))[0];
  const rb = available
    .filter((p) => p.position === "RB")
    .sort((a, b) => trueValueOf(b, available) - trueValueOf(a, available))[0];
  if (!wr || !rb || untilMine <= 1) {
    return { winnerId: null as string | null, label: "", wr: 0, rb: 0 };
  }
  const wrEv =
    trueValueOf(wr, available) * urgency("WR", team) +
    bestFollowUp(afterAutodraft(available, wr.id, untilMine), [...team, wr]);
  const rbEv =
    trueValueOf(rb, available) * urgency("RB", team) +
    bestFollowUp(afterAutodraft(available, rb.id, untilMine), [...team, rb]);
  const hero = rbEv > wrEv;
  return {
    winnerId: hero ? rb.id : wr.id,
    label: hero ? "Hero-RB path" : "Zero-RB path",
    wr: wrEv,
    rb: rbEv,
  };
}

function tierCliff(player: Player, available: Player[], untilMine: number): number {
  if (untilMine <= 4) return 1;
  const tier = posTier(player, available);
  if (tier > 2) return 1;
  const same = available.filter(
    (p) => p.position === player.position && posTier(p, available) === tier,
  );
  const posGone = adpWindow(available, untilMine).filter((p) => p.position === player.position).length;
  if (same.length <= 3 && untilMine > 8) return 1.35;
  if (same.length <= Math.max(1, posGone)) return 1.28;
  return 1;
}

export function evaluate(player: Player, team: Player[], available: Player[], untilMine: number) {
  const v = vorp(player, available);
  const injury = injuryFactor(player.name);
  const sos = sosPlayoff(player.team);
  const trueValue = trueValueOf(player, available);
  const u = urgency(player.position, team);
  const s = scarcity(player.position, available, untilMine);
  const survive = survivalMult(player, available, untilMine);
  const last = lastEliteBump(player, team, available);
  const delta = lineupDelta(team, player);
  const blended = delta * 0.62 + trueValue * 0.38;
  let score = blended * s * u * survive * last + stackBonus(player, team) - byeHit(player, team);
  if (player.isDarkHorse && team.length >= 6 && (player.position === "RB" || player.position === "WR" || player.position === "TE")) {
    const startersFilled = counts(team).RB >= 2 && counts(team).WR >= 3;
    score += startersFilled ? 14 : 7;
    if (player.adp - (team.length + 1) >= 12) score += 6;
  } else if (player.isRookie && team.length >= 8 && player.position !== "QB") {
    score += 5;
  }
  return { vorp: v, trueValue, urgency: u, scarcity: s, injury, sos, score, delta, last };
}

export function rankBoard(available: Player[], team: Player[], untilMine = 0, ctx: BoardCtx = {}) {
  const plan = pathPlan(available, team, untilMine);
  const draftedIds = ctx.draftedIds ?? [];
  const slot = ctx.slot ?? 1;
  const humans = ctx.humanSlots ?? [];
  const teams = ctx.teams ?? TEAMS;
  const book = playbookFor(slot, teams);
  const snipeWindow =
    untilMine <= 1 ? picksUntilTurn(livePickCount(draftedIds, ctx.keeperSeats) + 1, slot, teams) : untilMine;
  const heat = {
    RB: positionHeat(draftedIds, slot, "RB", snipeWindow),
    WR: positionHeat(draftedIds, slot, "WR", snipeWindow),
    TE: positionHeat(draftedIds, slot, "TE", snipeWindow),
    QB: positionHeat(draftedIds, slot, "QB", snipeWindow),
  };
  const onClock = untilMine <= 1;
  const doomedCpu = new Set(
    simulateEspnWindow(
      available,
      draftedIds,
      slot,
      Math.max(untilMine, onClock ? snipeWindow : 0),
      [],
      teams,
      ctx.keeperSeats ?? {},
    ).map((p) => p.id),
  );
  const doomedHyb = new Set(
    simulateEspnWindow(
      available,
      draftedIds,
      slot,
      Math.max(untilMine, onClock ? snipeWindow : 0),
      humans,
      teams,
      ctx.keeperSeats ?? {},
    ).map((p) => p.id),
  );
  const wrHungry = hungryHumanCount("WR", draftedIds, humans, slot, snipeWindow, teams, ctx.keeperSeats);
  const rbHungry = hungryHumanCount("RB", draftedIds, humans, slot, snipeWindow, teams, ctx.keeperSeats);
  const cpuW = 1 - Math.min(0.7, humans.length / Math.max(teams - 1, 1));
  const shortlist = [...available]
    .sort((a, b) => b.proj - a.proj)
    .slice(0, 40);
  const focus = new Set(shortlist.map((p) => p.id));
  const rows = shortlist
    .map((player) => {
      const ev = evaluate(player, team, available, untilMine);
      const cliff = tierCliff(player, available, untilMine);
      const adpIdx = autodraftIndex(player, available);
      const integ = shieldIntegrity(player, available, ctx);
      const espnSafe = integ >= 70 && untilMine > 0;
      const safe = espnSafe;
      const safeUntil = Math.max(0, adpIdx);
      const h = heat[player.position as "RB" | "WR" | "TE" | "QB"] ?? 0;
      let score = ev.score * cliff;
      score *= valueClash(player, team, available);
      score *= zeroRbHatch(player, team);
      score *= wrFirstFour(player, team);
      const pickNum = livePickCount(draftedIds, ctx.keeperSeats) + 1;
      const nextPick = pickNum + Math.max(untilMine - 1, 0);
      const reach = player.adp - nextPick;
      const espn = player.espnRank ?? player.rank;
      const round = Math.floor((nextPick - 1) / teams) + 1;
      if (player.adp > nextPick + 16 && espn > nextPick + 16) score *= 0.06;
      if (round === 1 && espn > 24) score = -9999;
      else if (round === 2 && espn > 48) score = -9999;
      else if (nextPick <= 12 && player.adp > 16) score *= 0.08;
      else if (nextPick <= 24 && player.adp > 36) score *= 0.15;
      else if (reach > 18) score *= 0.25;
      else if (reach > 12) score *= 0.45;
      score *= heatMult(holeAt(player.position, team), h, onClock);
      score *= 1 + Math.max(0, dropOff(player, team, available)) / 90;
      const cpuSafe = !doomedCpu.has(player.id);
      const hybSafe = !doomedHyb.has(player.id);
      if (untilMine > 1) {
        score *= cpuW * (cpuSafe ? 1.1 : 0.22) + (1 - cpuW) * (hybSafe ? 1.05 : 0.18);
      }
      if (player.position === "WR" && wrHungry >= 3 && posTier(player, available) <= 2) {
        score *= 1.18 + wrHungry * 0.05;
      }
      if (player.position === "RB" && rbHungry >= 3 && posTier(player, available) <= 2) {
        score *= 1.14 + rbHungry * 0.04;
      }
      if (integ < 20 && untilMine > 1) score *= 0.55;
      if (isHandcuff(player, team)) score *= 1.24;
      if (isStack(player, team) && player.position === "QB") score *= 1.12;
      if (book === "wheel" && untilMine > teams) {
        score *= integ >= 70 ? 1.22 : 0.72;
      }
      if (book === "mid" && onClock) {
        const nextSeat = ownerSlot(draftedIds.length + 2, teams);
        if (humans.includes(nextSeat) && (player.position === "WR" || player.position === "RB")) {
          score *= 1.16;
        }
      }
      if (book === "anchor" && integ < 45 && untilMine > 1) score *= 0.82;
      const overall = PLAYERS_2026.length - available.length + 1;
      if (onClock && takeSlot(player) > overall + snipeWindow) {
        score *= 0.8;
      }
      if (player.position === "QB" && overall <= 84) {
        score *= 0.1;
      }
      if ((player.position === "K" || player.position === "DST") && overall <= 132) {
        score *= 0.08;
      }
      if (plan.winnerId === player.id) score += 18;
      return {
        player,
        ...ev,
        score,
        cliff,
        safe,
        safeUntil,
        path: plan.winnerId === player.id ? plan.label : "",
        tier: posTier(player, available),
      };
    })
    .sort((a, b) => b.score - a.score);

  const steps = Math.min(8, Math.max(1, onClock ? snipeWindow : untilMine));
  const depth = book === "wheel" ? 2 : 3;
  const top = rows.slice(0, depth);
  for (const row of top) {
    try {
      const combo = comboValue(row.player, team, available, ctx, steps);
      row.score += combo * 0.4;
    } catch {
      /* chaos pick / empty board — keep the base score */
    }
  }
  top.sort((a, b) => b.score - a.score);
  const rest = available
    .filter((p) => !focus.has(p.id))
    .map((player) => ({
      player,
      vorp: 0,
      trueValue: 0,
      urgency: 1,
      scarcity: 1,
      injury: 1,
      sos: 1,
      score: -1e9,
      delta: 0,
      last: 1,
      cliff: 1,
      safe: false,
      safeUntil: 99,
      path: "",
      tier: 4 as const,
    }));
  return [...top, ...rows.slice(depth), ...rest];
}

function comboValue(
  player: Player,
  team: Player[],
  available: Player[],
  ctx: BoardCtx,
  steps: number,
): number {
  try {
    const now = lineupDelta(team, player);
    const drafted = [...(ctx.draftedIds ?? []), player.id];
    const rest = available.filter((p) => p.id !== player.id);
    const gone = new Set(
      simulateEspnWindow(
        rest,
        drafted,
        ctx.slot ?? 1,
        steps,
        ctx.humanSlots ?? [],
        ctx.teams ?? TEAMS,
        ctx.keeperSeats ?? {},
      ).map((p) => p.id),
    );
    const leftover = rest.filter((p) => !gone.has(p.id));
    if (!leftover.length) return now;
    const nextTeam = [...team, player];
    let best = 0;
    for (const p of leftover.slice(0, 12)) {
      const v = lineupDelta(nextTeam, p) * urgency(p.position, nextTeam);
      if (v > best) best = v;
    }
    return now + best * 0.9;
  } catch {
    return 0;
  }
}

export function recommend(
  available: Player[],
  team: Player[],
  untilMine = 0,
): Player | null {
  return rankBoard(available, team, untilMine)[0]?.player ?? null;
}

export function pickReasons(
  player: Player,
  team: Player[],
  available: Player[] = [],
  untilMine = 0,
): string[] {
  const c = counts(team);
  const ev = evaluate(player, team, available, untilMine);
  const reasons: string[] = [];
  if (team.length < 4 && player.position === "WR") reasons.push("WR script — first 4 picks");
  if (ev.last >= 1.4) reasons.push("Last difference-maker at this position");
  if (player.position === "RB" && c.RB === 0 && team.length >= 3 && player.rec >= 55) {
    reasons.push("Pass-catching Zero-RB");
  }
  if (player.position === "RB" && c.RB === 0) reasons.push("You have no starting RB");
  else if (player.position === "WR" && c.WR < 3) reasons.push("Starting WR hole");
  else if (player.position === "WR" && c.WR === 3) reasons.push("FLEX / your 4th WR");
  else if (player.position === "RB" && c.RB === 1) reasons.push("Locks the RB2 hole");
  else if (player.position === "TE" && c.TE < 1 && player.proj >= 210) {
    reasons.push("The TE everyone else streams");
  }
  if (ev.trueValue >= 80 || ev.vorp >= 50) reasons.push("Elite value tier");
  else if (ev.vorp >= 20) reasons.push("Solid starter");
  if (LAST_YEAR[player.id]?.fpts >= 300) reasons.push("Proven 300+ PPR");
  if (player.rec >= 90) reasons.push("Target monster");
  else if (player.rec >= 70) reasons.push("High-volume PPR lock");
  if (ev.injury < 0.85) reasons.push("Soft-tissue risk");
  else if (ev.injury <= 0.88) reasons.push("Injury tax");
  if (ev.sos >= 1.08) reasons.push("Easy playoff run");
  else if (ev.sos <= 0.93) reasons.push("Brutal December");
  if (ev.scarcity >= 1.22 && ev.urgency >= 1) reasons.push("Bots will drain this tier");
  else if (ev.scarcity >= 1.12) reasons.push("Position drop-off imminent");
  if (stackBonus(player, team) > 0) reasons.push("QB stack synergy");
  const plan = pathPlan(available, team, untilMine);
  if (plan.winnerId === player.id) {
    reasons.push(plan.label === "Hero-RB path" ? "Grab the back — WRs wait" : "Grab the receiver — backs wait");
  }
  if (untilMine > 3 && autodraftIndex(player, available) < untilMine) {
    reasons.push("Gone before you're back");
  } else if (untilMine >= 6 && autodraftIndex(player, available) >= untilMine) {
    reasons.push("Still there at your next pick");
  }
  if (player.espnRank != null && player.espnRank + 4 < player.adp) {
    reasons.push("ESPN rank ahead of ADP");
  }
  if (player.isRookie) reasons.push("Rookie upside");
  if (player.isDarkHorse) reasons.push("Rookie dark horse");
  const unique = [...new Set(reasons)];
  if (unique.length === 0) unique.push("Best player left");
  return unique.slice(0, 3);
}

export function pickWhy(player: Player, team: Player[], available: Player[] = [], untilMine = 0): string {
  return pickReasons(player, team, available, untilMine).join(" | ");
}

export function badgesFor(team: Player[]): string[] {
  const out: string[] = [];
  const c = counts(team);
  const wrVol = team.filter((p) => p.position === "WR").reduce((s, p) => s + p.rec, 0);
  if (team.length >= 1) out.push("First Blood");
  if (team.some((p) => vorp(p) >= 80)) out.push("Elite Talent");
  if (c.WR >= 3) out.push("WR Corps");
  if (wrVol >= 220) out.push("PPR Volume");
  if (c.RB >= 2) out.push("RB Pair");
  if (team.some((p) => p.position === "TE" && p.proj >= 210)) out.push("TE Premium");
  if (team.some((p) => p.isRookie)) out.push("Rookie Bet");
  if (team.some((p) => p.isDarkHorse)) out.push("Dark Horse");
  if (team.length >= 5) out.push("Core Locked");
  if (c.WR >= 2 && c.RB >= 1 && c.TE >= 1) out.push("WR Lean On");
  if (team.length >= 9) out.push("Roster Complete");
  return out;
}

function norm(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractFromText(raw: string, players: Player[]): Player[] {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const data = JSON.parse(trimmed) as {
        draftHistory?: { name?: string }[] | string[];
        picks?: { name?: string }[] | string[];
      };
      const history = Array.isArray(data)
        ? data
        : (data.draftHistory ?? data.picks ?? []);
      if (Array.isArray(history) && history.length) {
        const names = history
          .map((row) => (typeof row === "string" ? row : row?.name ?? ""))
          .filter(Boolean)
          .join("\n");
        if (names) return extractFromText(names, players);
      }
    } catch {
      /* fall through to fuzzy text */
    }
  }
  const hay = ` ${norm(raw)} `;
  const hits: Player[] = [];
  const sorted = [...players].sort((a, b) => b.name.length - a.name.length);
  for (const p of sorted) {
    const full = norm(p.name);
    if (full.length < 4) continue;
    if (hay.includes(` ${full} `) || hay.includes(full)) {
      hits.push(p);
      continue;
    }
    const parts = full.split(" ");
    const last = parts[parts.length - 1];
    const first = parts[0];
    if (last.length >= 5 && hay.includes(` ${last} `) && hay.includes(first.slice(0, 1))) {
      const lastHits = sorted.filter((x) => norm(x.name).endsWith(` ${last}`));
      if (lastHits.length === 1) hits.push(p);
    }
  }
  const seen = new Set<string>();
  return hits.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
}

export function extractEspnPickLines(raw: string, players: Player[]): Player[] {
  const hits: Player[] = [];
  const seen = new Set<string>();
  const re =
    /([A-Z][A-Za-z.''-]+(?:\s+[A-Z][A-Za-z.''-]+){1,3})\s*\/\s*[A-Z]{2,3}\s+(?:QB|RB|WR|TE|K|D\/?ST)/g;
  const hay = raw.replace(/\s+/g, " ");
  let m: RegExpExecArray | null;
  while ((m = re.exec(hay))) {
    const name = m[1].replace(/\s+/g, " ").trim();
    const hit = players.find((p) => norm(p.name) === norm(name));
    if (hit && !seen.has(hit.id)) {
      seen.add(hit.id);
      hits.push(hit);
    }
  }
  return hits;
}

function lastNameKey(name: string) {
  return norm(
    name
      .replace(/\s+(iii|ii|jr\.?|sr\.?)$/i, "")
      .trim()
      .split(/\s+/)
      .slice(-1)[0] ?? "",
  );
}

export function extractRosterAbbrevs(raw: string, players: Player[]): Player[] {
  const hits: Player[] = [];
  const seen = new Set<string>();
  const re = /\b[A-Z]\.\s*([A-Za-z''-]{3,})(?:\s+(?:III|II|Jr\.?))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const last = lastNameKey(m[1]);
    const matches = players.filter((p) => lastNameKey(p.name) === last);
    if (
      matches.length === 1 &&
      (matches[0].espnRank ?? matches[0].rank) > 15 &&
      !seen.has(matches[0].id)
    ) {
      seen.add(matches[0].id);
      hits.push(matches[0]);
    }
  }
  return hits;
}

export function extractUniqueLastNames(raw: string, players: Player[]): Player[] {
  const hay = ` ${norm(raw)} `;
  const groups = new Map<string, Player[]>();
  for (const p of players) {
    if ((p.espnRank ?? p.rank) <= 15) continue;
    const key = lastNameKey(p.name);
    if (key.length < 5) continue;
    const g = groups.get(key) ?? [];
    g.push(p);
    groups.set(key, g);
  }
  const hits: Player[] = [];
  for (const [last, group] of groups) {
    if (group.length === 1 && hay.includes(` ${last} `)) hits.push(group[0]);
  }
  return hits;
}

export function extractEspnCatchup(raw: string, players: Player[]): Player[] {
  return extractEspnPickLines(raw, players);
}

export function snakeOwner(overall: number, slot: number, teams = TEAMS) {
  const round = Math.ceil(overall / teams);
  const pos = ((overall - 1) % teams) + 1;
  const mine = round % 2 === 1 ? slot : teams - slot + 1;
  return { round, pos, mine, isMine: pos === mine };
}

export function picksUntilTurn(draftedCount: number, slot: number, teams = TEAMS) {
  const next = draftedCount + 1;
  for (let i = 0; i < teams * 16; i++) {
    const o = next + i;
    if (snakeOwner(o, slot, teams).isMine) return i;
  }
  return 0;
}

export function quickMatch(query: string, available: Player[]): Player | null {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return null;
  const hits = available.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.name.toLowerCase().split(" ").pop()?.startsWith(q),
  );
  if (hits.length === 0) return null;
  hits.sort((a, b) => b.proj - a.proj);
  return hits[0];
}

export const DEMO_ESPN = `Round 1
1.1 Jahmyr Gibbs, RB DET
1.2 Bijan Robinson, RB ATL
1.3 Ja'Marr Chase, WR CIN
1.4 Puka Nacua, WR LAR
1.5 Jaxon Smith-Njigba, WR SEA
1.6 Christian McCaffrey, RB SF`;
