import { test } from "node:test";
import assert from "node:assert/strict";
import { rosterImpact } from "./engine";
import { PLAYERS_2026, type Player, type Position } from "./players";

function p(
  name: string,
  position: Position,
  ppg: number,
  extra: Partial<Player> = {},
): Player {
  const proj = ppg * 17;
  return {
    id: name.toLowerCase().replace(/\s+/g, "-"),
    name,
    position,
    team: "XX",
    adp: extra.adp ?? 50,
    rank: extra.rank ?? 50,
    bye: 7,
    proj,
    ppg,
    rec: 0,
    recYds: 0,
    recTd: 0,
    rushYds: 0,
    rushTd: 0,
    passYds: 0,
    passTd: 0,
    ints: 0,
    floor: ppg,
    ceil: ppg,
    ...extra,
  };
}

function named(name: string): Player {
  const hit = PLAYERS_2026.find((x) => x.name === name);
  if (!hit) throw new Error(`missing ${name}`);
  return hit;
}

test("Test 1 — Elite Value Slide: 4 WRs + Wilson at pick 26 (ADP 10) is STEAL", () => {
  const roster = [
    named("Ja'Marr Chase"),
    named("Justin Jefferson"),
    named("Puka Nacua"),
    named("Marvin Harrison Jr."),
  ];
  const wilson =
    PLAYERS_2026.find((x) => x.name === "Garrett Wilson") ??
    p("Garrett Wilson", "WR", 16, { adp: 10, rank: 10 });
  const out = rosterImpact({ ...wilson, adp: 10 }, roster, 26);
  assert.equal(out.grade, "STEAL");
  assert.match(out.label, /value/i);
});

test("Test 2 — FLEX Disruption: Deebo +2.5 PPG vs Zamir is HIGH", () => {
  const roster = [
    p("Christian McCaffrey", "RB", 20.1),
    p("Breece Hall", "RB", 18.5),
    p("Tyreek Hill", "WR", 16.2),
    p("Amon-Ra St. Brown", "WR", 19.0),
    p("Drake London", "WR", 16.8),
    p("Zamir White", "RB", 11.0),
  ];
  const deebo = p("Deebo Samuel", "WR", 13.5, { adp: 40, rank: 40 });
  const out = rosterImpact(deebo, roster, 48);
  assert.equal(out.grade, "HIGH");
  assert.match(out.label, /2\+|starter|FLEX/i);
});

test("Test 3 — Kicker paradox: second K is SKIP; first K is never HIGH", () => {
  const skill = [
    p("RB1", "RB", 18),
    p("RB2", "RB", 16),
    p("WR1", "WR", 17),
    p("WR2", "WR", 16),
    p("WR3", "WR", 15),
    p("TE1", "TE", 13),
    p("QB1", "QB", 20),
  ];
  const withK = [...skill, p("Harrison Butker", "K", 9)];
  const tucker = p("Justin Tucker", "K", 8.8);
  const second = rosterImpact(tucker, withK, 140);
  assert.equal(second.grade, "SKIP");
  const first = rosterImpact(tucker, skill, 140);
  assert.notEqual(first.grade, "HIGH");
  assert.notEqual(first.grade, "MUST");
});

test("Test 4 — Deadzone Pivot: 0 RB in round 7 is MUST over a 11.5 WR", () => {
  const roster = [
    p("WR1", "WR", 19),
    p("WR2", "WR", 18),
    p("WR3", "WR", 17),
    p("WR4", "WR", 16),
    p("TE1", "TE", 14),
    p("QB1", "QB", 21),
  ];
  const rb = p("Boring RB", "RB", 9.5, { adp: 80, rank: 80 });
  const wr = p("Upside WR", "WR", 11.5, { adp: 70, rank: 70 });
  const rbOut = rosterImpact(rb, roster, 73);
  const wrOut = rosterImpact(wr, roster, 73);
  assert.equal(rbOut.grade, "MUST");
  assert.match(rbOut.label, /hole|legal starter/i);
  assert.ok(wrOut.grade === "SKIP" || wrOut.grade === "LOW" || wrOut.grade === "STEAL");
  assert.notEqual(wrOut.grade, "MUST");
});
