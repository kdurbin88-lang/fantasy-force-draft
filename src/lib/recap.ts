import { type Player, type Position } from "./players";
import { calculatePower, counts, gradeFor, lineupProj, starterLineup, vorp, TEAMS } from "./engine";
import { injuryFactor, sosPlayoff } from "./outlook";
import { LAST_YEAR } from "./lastYear";
import { handcuffFor } from "./synergy";

export type PosReport = {
  pos: string;
  names: string;
  ppg: number;
  note: string;
};

export type DraftHighlight = {
  type: "ALPHA_VALUE" | "REACH";
  player: string;
  round: number;
  adpDelta: number;
  impactNote: string;
};

export type Recap = {
  power: number;
  grade: string;
  seasonPts: number;
  weeklyPpg: number;
  floorPpg: number;
  ceilPpg: number;
  playoffMult: number;
  title: string;
  verdict: string;
  path: string;
  strengths: string[];
  risks: string[];
  rooms: PosReport[];
  byes: { week: number; names: string; hit: boolean }[];
  stacks: string[];
  cuffs: string[];
  waivers: Player[];
  injuryIndex: number;
  archetype: string;
  efficiencyPct: number;
  projectedRank: number;
  antiFragility: number;
  flexOptionality: number;
  varianceCoef: number;
  leverageWrPct: number;
  leverageRbPct: number;
  ppgVsLeague: number;
  capitalNote: string;
  snipeNote: string;
  simClear115: number;
  simMax: number;
  simMin: number;
  highlights: DraftHighlight[];
};

export type RecapOpts = {
  slot?: number;
  teams?: number;
  myIds?: string[];
};

function posStarters(team: Player[], pos: Position, n: number) {
  return team.filter((p) => p.position === pos).sort((a, b) => b.proj - a.proj).slice(0, n);
}

function roomNote(pos: string, players: Player[], need: number): string {
  if (players.length < need) return `UNFILLED — ${need - players.length} starter hole`;
  const ppg = players.reduce((s, p) => s + p.ppg, 0) / Math.max(players.length, 1);
  if (pos === "WR" && players.length >= 3 && ppg >= 16) return "League-winning WR room";
  if (pos === "RB" && players.length >= 2 && players[0].ppg >= 17) return "True workhorse + RB2";
  if (pos === "RB" && players.length < 2) return "Zero-RB hangover — streaming risk";
  if (pos === "QB" && players[0]?.ppg >= 20) return "QB1 is a weekly edge";
  if (pos === "TE" && players[0]?.ppg >= 14) return "Positional cheat code";
  if (pos === "TE" && players.length === 0) return "Streaming TE every week";
  return "Playable, not a separator";
}

function pickOverall(i: number, slot: number, teams: number): number {
  const round = i + 1;
  return round % 2 === 1 ? (round - 1) * teams + slot : round * teams - slot + 1;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function monteCarlo(starters: Player[], seed = 20260905) {
  const rand = mulberry32(seed + starters.length * 17);
  const n = 10000;
  let over = 0;
  let max = 0;
  let min = 999;
  for (let i = 0; i < n; i++) {
    let pts = 0;
    for (const p of starters) {
      const lo = p.floor || p.ppg * 0.88;
      const hi = p.ceil || p.ppg * 1.1;
      const u = rand();
      const tri = u < 0.5 ? lo + (p.ppg - lo) * Math.sqrt(u * 2) : hi - (hi - p.ppg) * Math.sqrt((1 - u) * 2);
      pts += tri * injuryFactor(p.name);
    }
    if (pts >= 115) over++;
    if (pts > max) max = pts;
    if (pts < min) min = pts;
  }
  return { clear115: (over / n) * 100, max, min };
}

function antiFragility(team: Player[]): number {
  const full = lineupProj(team);
  if (full <= 0 || team.length < 2) return 40;
  const early = [...team].sort((a, b) => b.proj - a.proj).slice(0, 2);
  let drop = 0;
  for (const star of early) {
    drop += full - lineupProj(team.filter((p) => p.id !== star.id));
  }
  const avgDropPct = drop / 2 / full;
  const bench = Math.max(0, team.length - 9);
  return Math.round(Math.max(8, Math.min(99, (1 - avgDropPct) * 100 + bench * 3)));
}

function flexOptionality(team: Player[]): number {
  const extraRb = team.filter((p) => p.position === "RB").sort((a, b) => b.ppg - a.ppg).slice(2);
  const extraWr = team.filter((p) => p.position === "WR").sort((a, b) => b.ppg - a.ppg).slice(3);
  const extraTe = team.filter((p) => p.position === "TE").sort((a, b) => b.ppg - a.ppg).slice(1);
  const pool = [...extraRb, ...extraWr, ...extraTe];
  if (pool.length === 0) return 18;
  const spread = pool.filter((p) => p.ppg >= 10).length;
  const both = extraRb.length > 0 && extraWr.length > 0 ? 22 : 0;
  return Math.round(Math.max(12, Math.min(99, 35 + spread * 14 + both + Math.min(pool[0].ppg, 16))));
}

function varianceCoef(starters: Player[]): number {
  if (starters.length === 0) return 1;
  const spreads = starters.map((p) => {
    const lo = p.floor || p.ppg * 0.88;
    const hi = p.ceil || p.ppg * 1.1;
    return (hi - lo) / Math.max(p.ppg, 1);
  });
  const mean = spreads.reduce((s, x) => s + x, 0) / spreads.length;
  return Math.round((1 + mean * 2.2) * 100) / 100;
}

export function buildRecap(team: Player[], available: Player[], opts: RecapOpts = {}): Recap {
  const slot = opts.slot ?? 4;
  const teams = opts.teams ?? TEAMS;
  const myIds = opts.myIds ?? team.map((p) => p.id);
  const starters = starterLineup(team);
  const seasonPts = lineupProj(team);
  const weeklyPpg = starters.reduce((s, p) => s + (p.ppg || p.proj / 17), 0);
  const floorPpg = starters.reduce((s, p) => s + (p.floor || p.ppg * 0.9), 0);
  const ceilPpg = starters.reduce((s, p) => s + (p.ceil || p.ppg * 1.08), 0);
  const power = calculatePower(team);
  const grade = gradeFor(power);
  const c = counts(team);
  const playoffMult =
    starters.length === 0 ? 1 : starters.reduce((s, p) => s + sosPlayoff(p.team), 0) / starters.length;
  const injuryIndex =
    starters.length === 0 ? 1 : starters.reduce((s, p) => s + injuryFactor(p.name), 0) / starters.length;

  const wr = posStarters(team, "WR", 4);
  const rb = posStarters(team, "RB", 3);
  const qb = posStarters(team, "QB", 1);
  const te = posStarters(team, "TE", 1);
  const skillPts = wr.slice(0, 3).reduce((s, p) => s + p.proj, 0) + rb.slice(0, 2).reduce((s, p) => s + p.proj, 0) + (te[0]?.proj ?? 0) + (qb[0]?.proj ?? 0);
  const wrShare = skillPts ? (wr.slice(0, 3).reduce((s, p) => s + p.proj, 0) / skillPts) * 100 : 0;
  const rbShare = skillPts ? (rb.slice(0, 2).reduce((s, p) => s + p.proj, 0) / skillPts) * 100 : 0;

  const rooms: PosReport[] = [
    { pos: "QB", names: qb.map((p) => p.name).join(" · ") || "—", ppg: qb[0]?.ppg ?? 0, note: roomNote("QB", qb, 1) },
    { pos: "RB", names: rb.map((p) => p.name).join(" · ") || "—", ppg: rb.reduce((s, p) => s + p.ppg, 0), note: roomNote("RB", rb, 2) },
    { pos: "WR", names: wr.map((p) => p.name).join(" · ") || "—", ppg: wr.slice(0, 3).reduce((s, p) => s + p.ppg, 0), note: roomNote("WR", wr, 3) },
    { pos: "TE", names: te.map((p) => p.name).join(" · ") || "—", ppg: te[0]?.ppg ?? 0, note: roomNote("TE", te, 1) },
  ];

  const byId = new Map(team.map((p) => [p.id, p]));
  const ordered = myIds.map((id) => byId.get(id)).filter((p): p is Player => Boolean(p));
  const highlights: DraftHighlight[] = [];
  let surplus = 0;
  let reachSpots = 0;
  ordered.forEach((p, i) => {
    const overall = pickOverall(i, slot, teams);
    const delta = Math.round(p.adp - overall);
    surplus += Math.max(0, delta);
    if (delta < -8) reachSpots += Math.abs(delta);
    if (delta >= 12) {
      highlights.push({
        type: "ALPHA_VALUE",
        player: p.name,
        round: i + 1,
        adpDelta: delta,
        impactNote: `Triggered the VALUE STEAL override. Instantly altered your season projection.`,
      });
    } else if (delta <= -12) {
      highlights.push({
        type: "REACH",
        player: p.name,
        round: i + 1,
        adpDelta: delta,
        impactNote: `Selected ${Math.abs(delta)} spots ahead of market value.`,
      });
    }
  });
  const efficiencyPct = Math.round(Math.max(40, Math.min(99.9, 78 + surplus * 0.45 - reachSpots * 0.35)) * 10) / 10;

  const archetype =
    rb[0] && rb[0].ppg >= 17 && wr.length >= 3
      ? "Hero-RB Strategy"
      : wrShare >= 48
        ? "Bully-WR / Zero-RB Lean"
        : c.RB >= 3 && wr.length <= 2
          ? "Robust RB"
          : "Balanced Market Efficiency";

  const leaguePpg = 112.4;
  const ppgVsLeague = Math.round((weeklyPpg - leaguePpg) * 10) / 10;
  const projectedRank = weeklyPpg >= 128 ? 1 : weeklyPpg >= 122 ? 2 : weeklyPpg >= 118 ? 3 : weeklyPpg >= 114 ? 5 : weeklyPpg >= 108 ? 7 : 10;

  const anti = antiFragility(team);
  const flex = flexOptionality(team);
  const variance = varianceCoef(starters);
  const sim = monteCarlo(starters);

  const capitalNote =
    wrShare >= 48
      ? `You concentrated ${wrShare.toFixed(0)}% of premium starter points in the WR tier. The WR corps is a league-wide outlier, but the RB2 slot is volatile and will require aggressive early-season waiver work.`
      : rbShare >= 38 && rb[0]
        ? `Hero-RB capital is locked in ${rb[0].name}. Remaining value was spent hammering pass-catchers. This is the correct 3-WR PPR allocation if the anchor stays healthy.`
        : `Market-efficient split: WR ${wrShare.toFixed(0)}% / RB ${rbShare.toFixed(0)}% of starter points. No single room is a structural hole if health holds.`;

  const steals = highlights.filter((h) => h.type === "ALPHA_VALUE");
  const reaches = highlights.filter((h) => h.type === "REACH");
  const snipeNote =
    steals.length >= 2
      ? `Market manipulator. Combined ADP surplus on ${steals.map((h) => h.player).join(" and ")} is +${steals.reduce((s, h) => s + h.adpDelta, 0)} spots.`
      : steals.length === 1
        ? `You extracted surplus on ${steals[0].player} (Round ${steals[0].round}, +${steals[0].adpDelta} vs ADP).`
        : reaches.length
          ? `Reach deficit: ${reaches[0].player} in Round ${reaches[0].round} went ${Math.abs(reaches[0].adpDelta)} spots ahead of market.`
          : "No panic reaches and no board-falls. Neutral efficiency — the season will be won on waivers and start/sit.";

  const strengths: string[] = [];
  const risks: string[] = [];
  if (wr.length >= 3 && wr[2].ppg >= 14) {
    strengths.push(
      `WR1–3 average ${(wr.slice(0, 3).reduce((s, p) => s + p.ppg, 0) / 3).toFixed(1)} PPG. In 3-WR PPR that is a weekly floor other managers cannot match.`,
    );
  }
  if (rb.length >= 2 && rb[0].ppg >= 16) {
    strengths.push(`${rb[0].name} is a true RB1. You can lose a flex week and still not fall out of the playoff picture.`);
  }
  if (te[0] && te[0].ppg >= 13.5) {
    strengths.push(`${te[0].name} at TE is a cheat-code vs streamers.`);
  }
  if (qb[0] && qb[0].ppg >= 19) {
    strengths.push(`${qb[0].name} is an every-week QB1.`);
  }
  if (playoffMult >= 1.04) {
    strengths.push(`Weeks 15–17 SOS is ${(playoffMult * 100 - 100).toFixed(0)}% easier than average. December is built to spike.`);
  }
  if (sim.clear115 >= 75) {
    strengths.push(`Monte Carlo: ${sim.clear115.toFixed(0)}% of weeks clear 115 points — a playoff-seed machine.`);
  }
  if (c.RB < 2) risks.push("You cannot field two starting RBs. One injury or bye and the week is dead.");
  if (c.WR < 3) risks.push("3-WR leagues punish thin WR rooms.");
  if (injuryIndex < 0.9) {
    risks.push(`Injury index ${(injuryIndex * 100).toFixed(0)}/100. Load-bearing names with soft-tissue history.`);
  }
  if (playoffMult < 0.97) risks.push("Playoff schedule is brutally hard (W15–17).");
  if (c.QB === 0) risks.push("No QB. Grab a locked starter before week 1.");
  if (c.TE === 0) risks.push("No TE. Stream until a breakout appears.");
  if (anti < 55) risks.push("Anti-fragility is poor — a Round 1/2 injury collapses the starting nine.");
  if (variance >= 1.45) risks.push(`Variance coefficient ${variance.toFixed(2)} (high). Ceiling is real; the floor can lose you a week you should win.`);

  const byeMap = new Map<number, Player[]>();
  for (const p of starters) {
    if (!p.bye) continue;
    const list = byeMap.get(p.bye) ?? [];
    list.push(p);
    byeMap.set(p.bye, list);
  }
  const byes = [...byeMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([week, ps]) => ({ week, names: ps.map((p) => p.name).join(", "), hit: ps.length >= 3 }));
  const crisisBye = byes.find((b) => b.hit);
  if (crisisBye) risks.push(`Bye week ${crisisBye.week} nukes ${crisisBye.names.split(",").length} starters at once.`);

  const stacks: string[] = [];
  for (const q of team.filter((p) => p.position === "QB")) {
    const mates = team.filter((p) => (p.position === "WR" || p.position === "TE") && p.team === q.team);
    if (mates.length) stacks.push(`${q.name} + ${mates.map((m) => m.name).join(" / ")} (${q.team})`);
  }
  const cuffs: string[] = [];
  for (const r of rb.slice(0, 2)) {
    const cuff = team.find((p) => p.position === "RB" && p.team === r.team && p.id !== r.id);
    if (cuff) cuffs.push(`${r.name} cuffed with ${cuff.name}`);
    else {
      const avail = handcuffFor(r, available);
      if (avail) cuffs.push(`${r.name} is uncuffed — ${avail.name} still on the board`);
    }
  }
  const waivers = available
    .filter((p) => p.position === "RB" || p.position === "WR" || p.position === "TE")
    .sort((a, b) => vorp(b, available) - vorp(a, available))
    .slice(0, 5);

  const winBar = 118;
  const title =
    weeklyPpg >= 128 ? "CHAMPIONSHIP CONSTRUCTION" : weeklyPpg >= winBar ? "PLAYOFF LOCK PROFILE" : weeklyPpg >= 108 ? "BUBBLE TEAM — ONE MOVE AWAY" : "REBUILD IN SEASON";
  const proven = starters.filter((p) => (LAST_YEAR[p.id]?.fpts ?? 0) >= p.proj * 0.85).length;
  const verdict = `Your draft executed a ${archetype}. Projected starting nine is ${ppgVsLeague >= 0 ? "+" : ""}${ppgVsLeague} PPG vs league baseline (${weeklyPpg.toFixed(1)} PPG). Anti-fragility ${anti}/100. Vulnerability is isolated to ${c.RB < 2 ? "the RB room" : injuryIndex < 0.9 ? "injury depth" : "matchup variance"}.`;
  const path =
    sim.clear115 >= 70 && playoffMult >= 1.02
      ? `Simulation clears 115 in ${sim.clear115.toFixed(0)}% of weeks (max ${sim.max.toFixed(1)}). December SOS is a cheat code — don't get cute on waivers.`
      : variance >= 1.4
        ? `High-variance mix. Single-week ceiling ${sim.max.toFixed(1)} but floor ${sim.min.toFixed(1)}. You'll drop games you shouldn't, then win a shootout in January.`
        : "The path is volume and waiver discipline. Add the missing starter and ride.";

  if (proven >= 5) strengths.push(`${proven} of your starters already printed last year.`);
  if (!strengths.length) strengths.push("Depth is the path — one waiver hit at RB or WR3 flips this from bubble to lock.");
  if (!risks.length) risks.push("No structural holes. The only way this roster dies is a cluster of injuries in the same week.");

  return {
    power,
    grade,
    seasonPts,
    weeklyPpg,
    floorPpg,
    ceilPpg,
    playoffMult,
    title,
    verdict,
    path,
    strengths: strengths.slice(0, 5),
    risks: risks.slice(0, 5),
    rooms,
    byes,
    stacks,
    cuffs,
    waivers,
    injuryIndex,
    archetype,
    efficiencyPct,
    projectedRank,
    antiFragility: anti,
    flexOptionality: flex,
    varianceCoef: variance,
    leverageWrPct: wrShare,
    leverageRbPct: rbShare,
    ppgVsLeague,
    capitalNote,
    snipeNote,
    simClear115: sim.clear115,
    simMax: sim.max,
    simMin: sim.min,
    highlights: highlights.slice(0, 4),
  };
}
