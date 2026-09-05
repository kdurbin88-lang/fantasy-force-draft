import { create } from "zustand";
import { persist } from "zustand/middleware";
import { PLAYERS_2026, type Player } from "./players";

interface DraftState {
  draftedIds: string[];
  myIds: string[];
  lastIngest: string;
  slot: number;
  setSlot: (slot: number) => void;
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
      slot: 1,
      setSlot: (slot) => set({ slot }),
      mark: (player, mine) => {
        const { draftedIds, myIds } = get();
        if (draftedIds.includes(player.id)) return;
        set({
          draftedIds: [...draftedIds, player.id],
          myIds: mine ? [...myIds, player.id] : myIds,
        });
      },
      ingest: (players) => {
        const { draftedIds } = get();
        const fresh = players.filter((p) => !draftedIds.includes(p.id));
        if (fresh.length === 0) return 0;
        set({
          draftedIds: [...draftedIds, ...fresh.map((p) => p.id)],
          lastIngest: new Date().toLocaleTimeString(),
        });
        return fresh.length;
      },
      reset: () => set({ draftedIds: [], myIds: [], lastIngest: "" }),
    }),
    { name: "fantasy-force-draft", skipHydration: false },
  ),
);

export function resolveTeam(ids: string[]): Player[] {
  return ids
    .map((id) => PLAYERS_2026.find((p) => p.id === id))
    .filter((p): p is Player => Boolean(p));
}
