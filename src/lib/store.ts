import { create } from "zustand";
import { persist } from "zustand/middleware";
import { PLAYERS_2026, type Player } from "./players";

interface DraftState {
  draftedIds: string[];
  myIds: string[];
  lastIngest: string;
  slot: number;
  teams: number;
  configured: boolean;
  leagueId: string;
  humanSlots: number[];
  queueIds: string[];
  keeperSeats: Record<string, number>;
  setSlot: (slot: number) => void;
  setTeams: (n: number) => void;
  setLeagueId: (id: string) => void;
  setHumanSlots: (slots: number[]) => void;
  toggleHuman: (n: number) => void;
  cycleSeat: (n: number) => void;
  lockRoom: () => void;
  unlockRoom: () => void;
  setQueue: (ids: string[]) => void;
  addKeeper: (player: Player, seat: number) => void;
  undo: () => string | null;
  mark: (player: Player, mine: boolean) => void;
  ingest: (players: Player[]) => number;
  reset: () => void;
}

export const useDraft = create<DraftState>()(
  persist(
    (set, get) => ({
      draftedIds: [],
      myIds: [],
      lastIngest: "",
      slot: 0,
      teams: 12,
      configured: false,
      leagueId: "296381258",
      humanSlots: [],
      queueIds: [],
      keeperSeats: {},
      setSlot: (slot) => set({ slot, humanSlots: get().humanSlots.filter((s) => s !== slot) }),
      setTeams: (n) => {
        const teams = Math.min(14, Math.max(8, Math.round(n)));
        const slot = Math.min(get().slot, teams);
        set({
          teams,
          slot,
          humanSlots: get().humanSlots.filter((s) => s <= teams && s !== slot),
        });
      },
      setLeagueId: (leagueId) => set({ leagueId: leagueId.replace(/\D/g, "") || "296381258" }),
      setHumanSlots: (humanSlots) =>
        set({
          humanSlots: [
            ...new Set(humanSlots.filter((n) => n >= 1 && n <= get().teams && n !== get().slot)),
          ],
        }),
      toggleHuman: (n) => {
        const { slot, humanSlots, teams } = get();
        if (n === slot || n < 1 || n > teams) return;
        const has = humanSlots.includes(n);
        set({
          humanSlots: has ? humanSlots.filter((s) => s !== n) : [...humanSlots, n].sort((a, b) => a - b),
        });
      },
      cycleSeat: (n) => {
        const { slot, humanSlots, teams } = get();
        if (n < 1 || n > teams) return;
        if (n === slot) {
          set({ slot: 0 });
          return;
        }
        if (!slot || slot < 1) {
          set({ slot: n, humanSlots: humanSlots.filter((s) => s !== n) });
          return;
        }
        if (humanSlots.includes(n)) {
          set({ humanSlots: humanSlots.filter((s) => s !== n) });
          return;
        }
        set({ humanSlots: [...humanSlots, n].sort((a, b) => a - b) });
      },
      lockRoom: () => {
        const { slot, teams } = get();
        if (slot >= 1 && slot <= teams) set({ configured: true });
      },
      unlockRoom: () => set({ configured: false }),
      setQueue: (queueIds) =>
        set({ queueIds: reconcileQueue(queueIds, get().draftedIds) }),
      addKeeper: (player, seat) => {
        const { draftedIds, queueIds, keeperSeats, teams } = get();
        if (draftedIds.includes(player.id)) return;
        if (seat < 1 || seat > teams) return;
        const nextDrafted = [...draftedIds, player.id];
        set({
          draftedIds: nextDrafted,
          keeperSeats: { ...keeperSeats, [player.id]: seat },
          queueIds: reconcileQueue(queueIds, nextDrafted),
        });
      },
      undo: () => {
        const { draftedIds, myIds, queueIds, keeperSeats } = get();
        const last = draftedIds[draftedIds.length - 1];
        if (!last) return null;
        const nextDrafted = draftedIds.slice(0, -1);
        const nextKeepers = { ...keeperSeats };
        delete nextKeepers[last];
        set({
          draftedIds: nextDrafted,
          myIds: myIds[myIds.length - 1] === last ? myIds.slice(0, -1) : myIds.filter((id) => id !== last),
          queueIds: [last, ...queueIds.filter((id) => id !== last)],
          keeperSeats: nextKeepers,
        });
        return last;
      },
      mark: (player, mine) => {
        const { draftedIds, myIds, queueIds } = get();
        if (draftedIds.includes(player.id)) return;
        const nextDrafted = [...draftedIds, player.id];
        set({
          draftedIds: nextDrafted,
          myIds: mine ? [...myIds, player.id] : myIds,
          queueIds: reconcileQueue(queueIds, nextDrafted),
        });
      },
      ingest: (players) => {
        const { draftedIds, queueIds } = get();
        const fresh = players.filter((p) => !draftedIds.includes(p.id));
        if (fresh.length === 0) {
          set({ queueIds: reconcileQueue(queueIds, draftedIds) });
          return 0;
        }
        const nextDrafted = [...draftedIds, ...fresh.map((p) => p.id)];
        set({
          draftedIds: nextDrafted,
          lastIngest: new Date().toLocaleTimeString(),
          queueIds: reconcileQueue(queueIds, nextDrafted),
        });
        return fresh.length;
      },
      reset: () =>
        set({
          draftedIds: [],
          myIds: [],
          lastIngest: "",
          queueIds: [],
          keeperSeats: {},
          configured: false,
        }),
    }),
    {
      name: "fantasy-force-draft",
      version: 4,
      skipHydration: false,
      migrate: (persisted) => {
        const p = persisted as DraftState;
        return { ...p, configured: false, slot: 0 };
      },
      partialize: (s) => ({
        draftedIds: s.draftedIds,
        myIds: s.myIds,
        lastIngest: s.lastIngest,
        slot: s.slot,
        teams: s.teams,
        leagueId: s.leagueId,
        humanSlots: s.humanSlots,
        queueIds: s.queueIds,
        keeperSeats: s.keeperSeats,
      }),
    },
  ),
);

export function resolveTeam(ids: string[]): Player[] {
  return ids
    .map((id) => PLAYERS_2026.find((p) => p.id === id))
    .filter((p): p is Player => Boolean(p));
}

export function reconcileQueue(queueIds: string[], draftedIds: string[]): string[] {
  if (!queueIds.length) return queueIds;
  const taken = new Set(draftedIds);
  return queueIds.filter((id) => !taken.has(id));
}

export function withLiveRanks(players: Player[], queueIds: string[], draftedIds: string[] = []): Player[] {
  const live = reconcileQueue(queueIds, draftedIds);
  if (!live.length) return players.filter((p) => !draftedIds.includes(p.id));
  const idx = new Map(live.map((id, i) => [id, i + 1]));
  return players
    .filter((p) => !draftedIds.includes(p.id))
    .map((p) => {
      const rank = idx.get(p.id);
      return rank != null ? { ...p, espnRank: rank } : p;
    });
}

export function parseHumanSeats(raw: string): number[] {
  return raw
    .split(/[,\s]+/)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 12);
}