import { PLAYERS_2026, type Player, type Position } from "./players";
import { REPLACEMENT_INDEX } from "./scoring";
import { injuryFactor, opportunityWeight, sosPlayoff } from "./outlook";
import { LAST_YEAR } from "./lastYear";

export const TEAMS = 12;

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

export function replacementPts(pos: Position, pool: Player[] = PLAYERS_2026): number {
  const key = `${pos}:${pool.length}:${pool[0]?.id ?? ""}:${pool[pool.length - 1]?.id ?? ""}`;
  const hit = replacementCache.get(key);
  if (hit != null) return hit;
  const list = pool.filter((p) => p.position === pos).sort((a, b) => b.proj - a.proj);
  const idx = Math.min(Math.max(list.length - 1, 0), REPLACEMENT_INDEX[pos] - 1);
  const pts = list[idx]?.proj ?? 0;
  replacementCache.set(key, pts);
  if (replacementCache.size > 400) replacementCache.clear();
  return pts;
}

export function vorp(player: Player, pool: Player[] = PLAYERS_2026): number {
  return Math.round((player.proj - replacementPts(player.position, pool)) * 10) / 10;
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

function starterLineup(team: Player[]): Player[] {
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
  if (pos === "TE") return c.TE >= 1 ? 0.1 : 1.3;
  if (pos === "WR") {
    if (c.WR < 3) return 1.5 - c.WR * 0.2;
    if (!flex) return 0.9;
    return 0.2;
  }
  if (pos === "RB") {
    if (c.RB === 0) return 1.4;
    if (c.RB === 1) return 1.1;
    if (!flex) return 0.8;
    return 0.1;
  }
  return 1;
}

function adpWindow(available: Player[], untilMine: number): Player[] {
  if (untilMine <= 0) return [];
  return [...available].sort((a, b) => a.adp - b.adp).slice(0, untilMine);
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
  const stacked =
    ((player.position === "WR" || player.position === "TE") &&
      team.some((p) => p.position === "QB" && p.team === player.team)) ||
    (player.position === "QB" &&
      team.some((p) => (p.position === "WR" || p.position === "TE") && p.team === player.team));
  return stacked ? 8.5 : 0;
}

function survivalMult(player: Player, available: Player[], untilMine: number): number {
  if (untilMine <= 1) return 1;
  const gone = adpWindow(available, untilMine).some((p) => p.id === player.id);
  if (gone) return 1.16;
  if (untilMine >= 8) return 0.9;
  return 1;
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
  return [...available].sort((a, b) => a.adp - b.adp).findIndex((p) => p.id === player.id);
}

export function eliteLeft(available: Player[], pos: Position): number {
  return available.filter((p) => p.position === pos && trueValueOf(p, available) >= 40).length;
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
  const score = trueValue * s * u * survive + stackBonus(player, team) - byeHit(player, team);
  return { vorp: v, trueValue, urgency: u, scarcity: s, injury, sos, score };
}

export function rankBoard(available: Player[], team: Player[], untilMine = 0) {
  const plan = pathPlan(available, team, untilMine);
  return available
    .map((player) => {
      const ev = evaluate(player, team, available, untilMine);
      const cliff = tierCliff(player, available, untilMine);
      const adpIdx = autodraftIndex(player, available);
      const safe = untilMine > 0 && adpIdx >= untilMine;
      const safeUntil = Math.max(0, adpIdx);
      let score = ev.score * cliff;
      const overall = PLAYERS_2026.length - available.length + 1;
      if (overall <= 48 && (player.position === "QB" || player.position === "K" || player.position === "DST")) {
        score *= overall <= 24 ? 0.12 : 0.35;
      }
      if (plan.winnerId === player.id) score += 18;
      if (safe && untilMine >= 6) score *= 0.86;
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
    reasons.push("Won't last until you're back");
  } else if (untilMine >= 6 && autodraftIndex(player, available) >= untilMine) {
    reasons.push("Bots skip him this round");
  }
  if (player.position === "WR" && c.WR < 1) reasons.push("Locks your WR1");
  else if (player.position === "WR" && c.WR < 3) reasons.push("Fills a starting WR");
  else if (player.position === "RB" && c.RB < 1) reasons.push("Your workhorse");
  else if (player.position === "RB" && c.RB < 2) reasons.push("Locks RB2");
  else if (player.position === "TE" && c.TE < 1 && player.proj >= 210) reasons.push("The TE everyone else streams");
  if (player.isRookie) reasons.push("Rookie upside");
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
