import { PLAYERS_2026, type Player, type Position } from "./players";
import {
  calculatePower,
  counts,
  gradeFor,
  lineupProj,
  starterLineup,
  vorp,
} from "./engine";
import { injuryFactor, sosPlayoff } from "./outlook";
import { LAST_YEAR } from "./lastYear";
import { handcuffFor } from "./synergy";

export type PosReport = {
  pos: string;
  names: string;
  ppg: number;
  note: string;
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

export function buildRecap(team: Player[], available: Player[]): Recap {
  const starters = starterLineup(team);
  const seasonPts = lineupProj(team);
  const weeklyPpg = starters.reduce((s, p) => s + (p.ppg || p.proj / 17), 0);
  const floorPpg = starters.reduce((s, p) => s + (p.floor || p.ppg * 0.9), 0);
  const ceilPpg = starters.reduce((s, p) => s + (p.ceil || p.ppg * 1.08), 0);
  const power = calculatePower(team);
  const grade = gradeFor(power);
  const c = counts(team);
  const playoffMult =
    starters.length === 0
      ? 1
      : starters.reduce((s, p) => s + sosPlayoff(p.team), 0) / starters.length;
  const injuryIndex =
    starters.length === 0
      ? 1
      : starters.reduce((s, p) => s + injuryFactor(p.name), 0) / starters.length;

  const wr = posStarters(team, "WR", 4);
  const rb = posStarters(team, "RB", 3);
  const qb = posStarters(team, "QB", 1);
  const te = posStarters(team, "TE", 1);

  const rooms: PosReport[] = [
    { pos: "QB", names: qb.map((p) => p.name).join(" · ") || "—", ppg: qb[0]?.ppg ?? 0, note: roomNote("QB", qb, 1) },
    { pos: "RB", names: rb.map((p) => p.name).join(" · ") || "—", ppg: rb.reduce((s, p) => s + p.ppg, 0), note: roomNote("RB", rb, 2) },
    { pos: "WR", names: wr.map((p) => p.name).join(" · ") || "—", ppg: wr.slice(0, 3).reduce((s, p) => s + p.ppg, 0), note: roomNote("WR", wr, 3) },
    { pos: "TE", names: te.map((p) => p.name).join(" · ") || "—", ppg: te[0]?.ppg ?? 0, note: roomNote("TE", te, 1) },
  ];

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
    strengths.push(`${te[0].name} at TE is a cheat-code vs streamers. That's 3–5 extra points every Sunday.`);
  }
  if (qb[0] && qb[0].ppg >= 19) {
    strengths.push(`${qb[0].name} is an every-week QB1. You don't have to guess streams in the playoffs.`);
  }
  if (playoffMult >= 1.04) {
    strengths.push(
      `Weeks 15–17 SOS is ${(playoffMult * 100 - 100).toFixed(0)}% easier than league average. December is when this roster is built to spike.`,
    );
  }

  if (c.RB < 2) {
    risks.push("You cannot field two starting RBs. One injury or bye and the week is dead. Priority one on waivers is a starting back.");
  }
  if (c.WR < 3) {
    risks.push("3-WR leagues punish thin WR rooms. You will be starting a hope-and-a-prayer WR3 until you fix it.");
  }
  if (injuryIndex < 0.9) {
    risks.push(
      `Injury index ${(injuryIndex * 100).toFixed(0)}/100. This roster has load-bearing names with soft-tissue history — the ceiling is real, the floor is a hospital.`,
    );
  }
  if (playoffMult < 0.97) {
    risks.push("Playoff schedule is brutally hard (W15–17). You need volume monsters, not matchup-dependent depth.");
  }
  if (c.QB === 0) {
    risks.push("No QB. Streaming in 4-pt passing is fine until a short week. Grab a locked starter before week 1.");
  }
  if (c.TE === 0) {
    risks.push("No TE. That's 8–12 points of weekly variance. Stream until a breakout appears.");
  }

  const byeMap = new Map<number, Player[]>();
  for (const p of starters) {
    if (!p.bye) continue;
    const list = byeMap.get(p.bye) ?? [];
    list.push(p);
    byeMap.set(p.bye, list);
  }
  const byes = [...byeMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([week, ps]) => ({
      week,
      names: ps.map((p) => p.name).join(", "),
      hit: ps.length >= 3,
    }));
  const crisisBye = byes.find((b) => b.hit);
  if (crisisBye) {
    risks.push(
      `Bye week ${crisisBye.week} nukes ${crisisBye.names.split(",").length} starters at once. Have a plan or that week is a loss.`,
    );
  }

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
    weeklyPpg >= 128
      ? "CHAMPIONSHIP CONSTRUCTION"
      : weeklyPpg >= winBar
        ? "PLAYOFF LOCK PROFILE"
        : weeklyPpg >= 108
          ? "BUBBLE TEAM — ONE MOVE AWAY"
          : "REBUILD IN SEASON";

  const proven = starters.filter((p) => (LAST_YEAR[p.id]?.fpts ?? 0) >= p.proj * 0.85).length;
  const verdict =
    weeklyPpg >= winBar
      ? `Projected ${weeklyPpg.toFixed(1)} PPG from the starting nine. That's a top-3 weekly output in a 12-team full-PPR 3-WR league if health holds. Floor ${floorPpg.toFixed(1)} / ceiling ${ceilPpg.toFixed(1)}.`
      : `Projected ${weeklyPpg.toFixed(1)} PPG. Playoff cut in this format lives near ${winBar} PPG. You are ${(winBar - weeklyPpg).toFixed(1)} points short of a lock — the recap below is the punch list.`;

  const path =
    playoffMult >= 1.03 && injuryIndex >= 0.92
      ? "December path is clean: easy SOS and durable bodies. Don't get cute on waivers — add the missing starter and ride."
      : playoffMult >= 1.03
        ? "Schedule says you can win the league in weeks 15–17, but only if the injury tax doesn't cash. Handcuff the workhorses this week."
        : injuryIndex < 0.9
          ? "This is a boom/bust title team. You'll drop games you shouldn't in October, then win a shootout in January if the stars are on the field."
          : "The path is volume and waiver discipline. You don't have a schedule cheat-code, so every startable RB/WR you add is a playoff game.";

  if (proven >= 5) {
    strengths.push(`${proven} of your starters already printed last year. These projections aren't a wish list.`);
  }
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
  };
}
