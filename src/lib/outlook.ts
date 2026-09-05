/** Injury durability 0.75–1.0. Unlisted = 1.0. */
const INJURY: Record<string, number> = {
  "Christian McCaffrey": 0.8,
  "Saquon Barkley": 0.86,
  "Cooper Kupp": 0.78,
  "Tyreek Hill": 0.82,
  "Nick Chubb": 0.75,
  "Tee Higgins": 0.86,
  "A.J. Brown": 0.88,
  "De'Von Achane": 0.87,
  "Travis Kelce": 0.84,
  "Derrick Henry": 0.88,
  "Isiah Pacheco": 0.82,
  "Mike Evans": 0.85,
  "Jonathan Taylor": 0.9,
  "Malik Nabers": 0.9,
  "Chris Godwin": 0.8,
  "Amari Cooper": 0.86,
  "Davante Adams": 0.88,
  "George Kittle": 0.88,
  "Breece Hall": 0.9,
  "Kenneth Walker III": 0.9,
  "Jayden Daniels": 0.9,
  "Joe Burrow": 0.92,
};

/**
 * Weeks 15–17 playoff SOS multiplier by team.
 * >1 easier December, <1 tougher. Sourced from 2026 playoff-matchup tables.
 */
const SOS: Record<string, number> = {
  JAX: 1.14,
  MIN: 1.12,
  TEN: 1.12,
  CLE: 1.11,
  TB: 1.1,
  CIN: 1.1,
  LAR: 1.1,
  CHI: 1.09,
  NYG: 1.08,
  NO: 1.07,
  BAL: 1.06,
  ATL: 1.04,
  SEA: 1.03,
  DET: 1.02,
  BUF: 1.02,
  DAL: 1.02,
  ARI: 1.01,
  DEN: 1.0,
  CAR: 0.99,
  PIT: 0.99,
  HOU: 0.98,
  NE: 0.97,
  GB: 0.95,
  IND: 0.94,
  WAS: 0.93,
  PHI: 0.93,
  SF: 0.92,
  KC: 0.91,
  LAC: 0.9,
  MIA: 0.96,
  NYJ: 0.97,
  LV: 0.98,
};

export function injuryFactor(name: string): number {
  return INJURY[name] ?? 1;
}

export function sosPlayoff(team: string): number {
  return SOS[team] ?? 1;
}

/** PPR opportunity tilt: receptions + scores inside the 5 (proxied by TDs). */
export function opportunityWeight(rec: number, recTd: number, rushTd: number): number {
  return 1 + Math.min(0.22, rec / 500) + Math.min(0.12, (recTd + rushTd) / 18);
}
