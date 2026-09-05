import type { Player } from "./players";

export type YearLine = {
  rushAtt: number;
  rushYds: number;
  rushTd: number;
  rec: number;
  recYds: number;
  recTd: number;
  passYds: number;
  passTd: number;
  ints: number;
  fpts: number;
};

/** 2025 actuals for names we have a clean line on. Missing = projections only. */
export const LAST_YEAR: Record<string, YearLine> = {
  "jahmyr-gibbs-rb": {
    rushAtt: 243,
    rushYds: 1223,
    rushTd: 13,
    rec: 77,
    recYds: 616,
    recTd: 5,
    passYds: 0,
    passTd: 0,
    ints: 0,
    fpts: 366.9,
  },
  "bijan-robinson-rb": {
    rushAtt: 304,
    rushYds: 1456,
    rushTd: 14,
    rec: 61,
    recYds: 431,
    recTd: 1,
    passYds: 0,
    passTd: 0,
    ints: 0,
    fpts: 334.7,
  },
  "saquon-barkley-rb": {
    rushAtt: 345,
    rushYds: 2005,
    rushTd: 13,
    rec: 33,
    recYds: 278,
    recTd: 2,
    passYds: 0,
    passTd: 0,
    ints: 0,
    fpts: 355.3,
  },
  "ja-marr-chase-wr": {
    rushAtt: 3,
    rushYds: 32,
    rushTd: 0,
    rec: 127,
    recYds: 1708,
    recTd: 17,
    passYds: 0,
    passTd: 0,
    ints: 0,
    fpts: 403.0,
  },
  "puka-nacua-wr": {
    rushAtt: 11,
    rushYds: 46,
    rushTd: 1,
    rec: 79,
    recYds: 990,
    recTd: 3,
    passYds: 0,
    passTd: 0,
    ints: 0,
    fpts: 206.6,
  },
  "christian-mccaffrey-rb": {
    rushAtt: 272,
    rushYds: 1114,
    rushTd: 8,
    rec: 81,
    recYds: 707,
    recTd: 5,
    passYds: 0,
    passTd: 0,
    ints: 0,
    fpts: 328.1,
  },
  "amon-ra-st-brown-wr": {
    rushAtt: 2,
    rushYds: 6,
    rushTd: 0,
    rec: 115,
    recYds: 1263,
    recTd: 12,
    passYds: 0,
    passTd: 0,
    ints: 0,
    fpts: 313.9,
  },
  "justin-jefferson-wr": {
    rushAtt: 1,
    rushYds: 3,
    rushTd: 0,
    rec: 103,
    recYds: 1533,
    recTd: 10,
    passYds: 0,
    passTd: 0,
    ints: 0,
    fpts: 316.6,
  },
  "ceedee-lamb-wr": {
    rushAtt: 14,
    rushYds: 70,
    rushTd: 0,
    rec: 101,
    recYds: 1194,
    recTd: 6,
    passYds: 0,
    passTd: 0,
    ints: 0,
    fpts: 263.4,
  },
  "josh-allen-qb": {
    rushAtt: 102,
    rushYds: 531,
    rushTd: 12,
    rec: 0,
    recYds: 0,
    recTd: 0,
    passYds: 3731,
    passTd: 28,
    ints: 6,
    fpts: 377.4,
  },
  "lamar-jackson-qb": {
    rushAtt: 139,
    rushYds: 915,
    rushTd: 4,
    rec: 0,
    recYds: 0,
    recTd: 0,
    passYds: 4172,
    passTd: 41,
    ints: 4,
    fpts: 429.4,
  },
  "trey-mcbride-te": {
    rushAtt: 0,
    rushYds: 0,
    rushTd: 0,
    rec: 111,
    recYds: 1146,
    recTd: 2,
    passYds: 0,
    passTd: 0,
    ints: 0,
    fpts: 237.6,
  },
};

export function projLine(p: Player): YearLine {
  const ypc = p.position === "RB" ? 4.85 : 6.8;
  const rushAtt = p.rushYds > 30 ? Math.round(p.rushYds / ypc) : 0;
  return {
    rushAtt,
    rushYds: Math.round(p.rushYds),
    rushTd: p.rushTd,
    rec: p.rec,
    recYds: Math.round(p.recYds),
    recTd: p.recTd,
    passYds: Math.round(p.passYds),
    passTd: p.passTd,
    ints: p.ints,
    fpts: p.proj,
  };
}

export function outlookFor(p: Player): string {
  if (p.isRookie) {
    return `Rookie projection: ${p.proj.toFixed(0)} PPR (${p.ppg.toFixed(1)} per game). Volume is the bet — if the role holds, the ceiling is a weekly starter.`;
  }
  const ly = LAST_YEAR[p.id];
  if (p.position === "RB") {
    const att = projLine(p).rushAtt;
    const recBit = p.rec >= 40 ? ` plus ${p.rec.toFixed(0)} catches` : "";
    const prior = ly
      ? ` Last year: ${ly.rushYds} rush yards and ${ly.fpts.toFixed(0)} PPR.`
      : "";
    return `2026 PPR line is ${p.proj.toFixed(0)} points on about ${att} carries${recBit}.${prior}`;
  }
  if (p.position === "WR" || p.position === "TE") {
    const prior = ly ? ` Last year: ${ly.rec} rec, ${ly.fpts.toFixed(0)} PPR.` : "";
    return `Projected ${p.rec.toFixed(0)} catches for ${p.recYds.toFixed(0)} yards and ${p.recTd.toFixed(1)} scores — ${p.proj.toFixed(0)} PPR, ${p.ppg.toFixed(1)} per game.${prior}`;
  }
  if (p.position === "QB") {
    return `Projected ${p.passYds.toFixed(0)} pass yards, ${p.passTd.toFixed(1)} pass TDs, ${p.rushYds.toFixed(0)} rush yards — ${p.proj.toFixed(0)} PPR.`;
  }
  return `${p.proj.toFixed(0)} projected PPR, ${p.ppg.toFixed(1)} per game.`;
}
