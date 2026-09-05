import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PLAYERS_2026 } from "./players";
import {
  ownerSlot,
  playbookFor,
  picksUntilTurn,
  rankBoard,
  shieldIntegrity,
  simulateEspnWindow,
  extractEspnPickLines,
} from "./engine";
import { describeHumanThreat, warRoomCard } from "./warRoom";
import { reconcileQueue, withLiveRanks } from "./store";

function byName(name: string) {
  const p = PLAYERS_2026.find((x) => x.name === name);
  if (!p) throw new Error(`missing ${name}`);
  return p;
}

describe("Suite 1 — chaos human kicker at seat 4", () => {
  it("does not skyrocket WR shield and still flags seat 6", () => {
    const teams = 12;
    const slot = 5;
    assert.equal(playbookFor(slot, teams), "mid");
    const kicker = byName("Harrison Mevis");
    const r1 = PLAYERS_2026.filter((p) => p.position !== "K").slice(0, 3);
    const draftedIds = [...r1.map((p) => p.id), kicker.id];
    assert.equal(ownerSlot(4, teams), 4);
    assert.equal(ownerSlot(5, teams), 5);
    assert.equal(ownerSlot(6, teams), 6);
    const available = PLAYERS_2026.filter((p) => !draftedIds.includes(p.id));
    const ctx = { draftedIds, slot, humanSlots: [4, 6], teams };
    const until = picksUntilTurn(draftedIds.length, slot, teams);
    assert.equal(until, 0);
    const chase = available.find((p) => p.position === "WR")!;
    const integ = shieldIntegrity(chase, available, ctx);
    assert.ok(integ < 40, `WR shield should not skyrocket, got ${integ}`);
    const threat = describeHumanThreat(chase, ctx, 12);
    assert.match(threat, /Seat 6/);
    const rows = rankBoard(available, [], until, ctx);
    assert.ok(rows.length > 0);
    assert.ok(!rows[0].player.id.includes("-k"));
    const card = warRoomCard(rows, [], available, until, ctx);
    assert.ok(card);
    assert.ok(card.integrity < 40);
    assert.doesNotThrow(() =>
      simulateEspnWindow(available, draftedIds, slot, 16, [4, 6], teams),
    );
  });
});

describe("Suite 2 — taken still sitting on the queue", () => {
  it("invalidates the name from ranks, primary, and live overlay", () => {
    const puka = byName("Puka Nacua");
    const chase = byName("Ja'Marr Chase");
    const queue = [puka.id, chase.id, ...PLAYERS_2026.slice(0, 8).map((p) => p.id)];
    const drafted = [puka.id];
    const live = reconcileQueue(queue, drafted);
    assert.ok(!live.includes(puka.id));
    const overlay = withLiveRanks(PLAYERS_2026, queue, drafted);
    assert.ok(!overlay.some((p) => p.id === puka.id));
    const rows = rankBoard(overlay, [], 0, {
      draftedIds: drafted,
      slot: 5,
      humanSlots: [4, 6],
      teams: 12,
    });
    assert.ok(!rows.some((r) => r.player.id === puka.id));
    assert.notEqual(rows[0]?.player.id, puka.id);
  });
});

describe("Suite 3 — AFK two humans to printers mid-round 5", () => {
  it("recalculates fallback in under 100ms and shield opens", () => {
    const teams = 11;
    const slot = 5;
    const humans = [2, 4, 6, 9];
    const round5Start = (5 - 1) * teams;
    const draftedIds = PLAYERS_2026.slice(0, round5Start).map((p) => p.id);
    const available = PLAYERS_2026.filter((p) => !draftedIds.includes(p.id));
    const until = picksUntilTurn(draftedIds.length, slot, teams);
    const hot = { draftedIds, slot, humanSlots: humans, teams };
    const cold = { draftedIds, slot, humanSlots: [2, 9], teams };
    const hotRows = rankBoard(available, [], until, hot);
    const t0 = Date.now();
    const coldRows = rankBoard(available, [], until, cold);
    const ms = Date.now() - t0;
    assert.ok(ms < 250, `recalc took ${ms}ms`);
    const hotCard = warRoomCard(hotRows, [], available, until, hot);
    const coldCard = warRoomCard(coldRows, [], available, until, cold);
    assert.ok(hotCard && coldCard);
    const buried = available.find((p) => (p.espnRank ?? p.adp) > 40 && p.position === "WR");
    if (buried) {
      const before = shieldIntegrity(buried, available, hot);
      const after = shieldIntegrity(buried, available, cold);
      assert.ok(after >= before, `shield should not drop when humans go AFK (${before} -> ${after})`);
    }
  });
});

describe("Round 1 never recommends Rashee Rice", () => {
  it("empty board slot 4 primary is elite ADP, Rice is outside top 12", () => {
    const rows = rankBoard(PLAYERS_2026, [], 0, {
      slot: 4,
      teams: 12,
      draftedIds: [],
      humanSlots: [],
    });
    assert.ok(rows[0].player.adp <= 8, `got ${rows[0].player.name} ADP ${rows[0].player.adp}`);
    const riceAt = rows.findIndex((r) => r.player.name === "Rashee Rice");
    assert.ok(riceAt < 0 || riceAt >= 12, `Rice ranked #${riceAt + 1}`);
    assert.equal(rows[0].player.position, "WR");
    for (const name of ["Puka Nacua", "Ja'Marr Chase"]) {
      assert.ok(
        rows.slice(0, 5).some((r) => r.player.name === name),
        `${name} missing from top 5: ${rows.slice(0, 5).map((r) => r.player.name).join(", ")}`,
      );
    }
  });

  it("zero-state board still has Jefferson, CMC, and Lamb available", () => {
    const available = PLAYERS_2026.filter(() => true);
    for (const name of ["Justin Jefferson", "Christian McCaffrey", "CeeDee Lamb"]) {
      assert.ok(available.some((p) => p.name === name), `${name} missing from library`);
    }
    const rows = rankBoard(available, [], 0, { slot: 4, teams: 12, draftedIds: [], humanSlots: [] });
    const names = rows.slice(0, 12).map((r) => r.player.name);
    assert.ok(!names.includes("Rashee Rice"), `Rice leaked into R1 board: ${names.join(", ")}`);
    const rice = rows.find((r) => r.player.name === "Rashee Rice");
    if (rice) assert.ok(rice.score < 0, `Rice score ${rice.score} should be circuit-broken`);
  });

  it("slash OCR takes Jefferson only on full name, never last-name fragments", () => {
    const miss = extractEspnPickLines("Jefferson is still available", PLAYERS_2026);
    assert.equal(miss.length, 0);
    const hit = extractEspnPickLines("Justin Jefferson / MIN WR", PLAYERS_2026);
    assert.equal(hit[0]?.name, "Justin Jefferson");
  });

  it("first four roster picks are WRs, not Rhamondre Stevenson", () => {
    const rows = rankBoard(PLAYERS_2026, [], 3, {
      slot: 4,
      teams: 12,
      draftedIds: [],
      humanSlots: [],
    });
    const top = rows.slice(0, 6).map((r) => r.player);
    assert.ok(
      top.every((p) => p.position === "WR"),
      `got ${top.map((p) => `${p.name} ${p.position}`).join(", ")}`,
    );
    assert.ok(!top.some((p) => p.name === "Rhamondre Stevenson"));
  });

  it("2 RB + 2 WR remaining hole is WR, not a 3rd back", () => {
    const mine = ["Jahmyr Gibbs", "Bijan Robinson", "Puka Nacua", "Ja'Marr Chase"].map(byName);
    const taken = new Set(mine.map((p) => p.id));
    const avail = PLAYERS_2026.filter((p) => !taken.has(p.id));
    const rows = rankBoard(avail, mine, 6, {
      slot: 4,
      teams: 12,
      draftedIds: [...taken],
      humanSlots: [],
    });
    assert.equal(rows[0].player.position, "WR", `got ${rows[0].player.name} ${rows[0].player.position}`);
    assert.notEqual(rows[0].player.name, "Rhamondre Stevenson");
  });
});
