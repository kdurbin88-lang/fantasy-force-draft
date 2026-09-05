import { useState } from "react";
import { PLAYERS_2026 } from "@/lib/players";
import { playbookFor } from "@/lib/engine";
import { useDraft } from "@/lib/store";
import { parseKeepers } from "@/lib/warRoom";
import { cn } from "@/lib/utils";

const BOOKS: Record<string, string> = {
  wheel: "WHEEL · pair on the turn, shield on the desert wrap",
  mid: "MID · watch the seat next to you every round",
  anchor: "ANCHOR · contingency first — the wheel can double-tap",
};

export function SetupBoot() {
  const teams = useDraft((s) => s.teams);
  const slot = useDraft((s) => s.slot);
  const humanSlots = useDraft((s) => s.humanSlots);
  const setTeams = useDraft((s) => s.setTeams);
  const cycleSeat = useDraft((s) => s.cycleSeat);
  const lockRoom = useDraft((s) => s.lockRoom);
  const addKeeper = useDraft((s) => s.addKeeper);
  const keeperSeats = useDraft((s) => s.keeperSeats);
  const [keeperText, setKeeperText] = useState("");
  const [keeperNote, setKeeperNote] = useState("");
  const book = slot >= 1 ? playbookFor(slot, teams) : null;
  const printers = teams - 1 - humanSlots.length - (slot >= 1 ? 1 : 0);

  return (
    <main className="relative z-20 flex min-h-dvh items-center justify-center px-4 py-16 text-fg">
      <div className="relative z-20 w-full max-w-xl space-y-6">
        <p className="font-mono text-[11px] font-bold tracking-[0.35em] text-accent-bright">
          BOOT LOAD
        </p>
        <h1 className="font-display text-4xl font-extrabold tracking-tight">
          Lock the room before the engine talks.
        </h1>
        <p className="text-sm text-muted">
          1. Click your seat (blue — YOU). 2. Click other humans (red). 3. Press LOCK ROOM.
          This screen stays until that button. Picks already on the board are kept.
        </p>

        <div className="relative z-30 rounded-2xl border border-white/20 bg-[#0a1630] px-4 py-4">
          <span className="font-mono text-xs font-bold tracking-widest text-subtle">TEAMS</span>
          <div className="mt-3 grid grid-cols-3 gap-3">
            {[10, 11, 12].map((n) => (
              <button
                key={n}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setTeams(n);
                }}
                className={cn(
                  "relative z-30 h-14 rounded-xl font-mono text-lg font-extrabold",
                  teams === n ? "bg-accent text-black" : "border border-white/25 bg-black/40 text-fg",
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="fd-glass rounded-2xl p-4">
          <div className="relative mx-auto grid max-w-sm grid-cols-4 gap-2 sm:grid-cols-6">
            {Array.from({ length: teams }, (_, i) => i + 1).map((n) => {
              const mine = n === slot;
              const live = humanSlots.includes(n);
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => cycleSeat(n)}
                  className={cn(
                    "flex h-14 flex-col items-center justify-center rounded-xl font-mono text-xs font-bold",
                    mine && "bg-accent text-black",
                    !mine && live && "border border-red-500 bg-red-950 text-red-100",
                    !mine && !live && "border border-white/15 text-muted",
                  )}
                >
                  <span>{n}</span>
                  <span className="text-[9px] tracking-widest">
                    {mine ? "YOU" : live ? "HUMAN" : "CPU"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center font-mono text-[10px] font-bold tracking-widest">
          <div className="fd-glass rounded-xl py-3">YOU {slot || "—"}</div>
          <div className="fd-glass rounded-xl py-3 text-red-300">HUMAN {humanSlots.length}</div>
          <div className="fd-glass rounded-xl py-3">CPU {Math.max(0, printers)}</div>
        </div>

        {book && (
          <p className="fd-glass rounded-xl px-4 py-3 text-sm">
            <span className="font-mono text-[10px] font-bold tracking-widest text-accent-bright">
              PLAYBOOK
            </span>
            <br />
            {BOOKS[book]}
          </p>
        )}

        <div className="fd-glass space-y-2 rounded-2xl p-4">
          <div className="font-mono text-[10px] font-bold tracking-widest text-accent-bright">
            KEEPERS · SEAT THEN NAME
          </div>
          <textarea
            value={keeperText}
            onChange={(e) => setKeeperText(e.target.value)}
            placeholder={"3 Ja'Marr Chase\n7 Bijan Robinson"}
            className="h-20 w-full resize-none rounded-xl border border-white/10 bg-black/20 p-3 text-sm outline-none"
          />
          <button
            type="button"
            onClick={() => {
              const rows = parseKeepers(keeperText, PLAYERS_2026);
              rows.forEach((r) => addKeeper(r.player, r.seat));
              setKeeperNote(
                rows.length
                  ? `Locked ${rows.length} keeper${rows.length === 1 ? "" : "s"}`
                  : "No names matched",
              );
            }}
            className="h-10 rounded-xl border border-white/15 px-4 text-xs font-bold"
          >
            LOAD KEEPERS
          </button>
          {keeperNote ? <p className="text-xs text-muted">{keeperNote}</p> : null}
          {Object.keys(keeperSeats).length > 0 && (
            <p className="text-xs text-muted">
              {Object.keys(keeperSeats).length} on rosters before pick 1
            </p>
          )}
        </div>

        <button
          type="button"
          disabled={slot < 1}
          onClick={lockRoom}
          className="go-btn h-14 w-full rounded-2xl text-base font-extrabold disabled:opacity-40"
        >
          LOCK ROOM
        </button>
      </div>
    </main>
  );
}
