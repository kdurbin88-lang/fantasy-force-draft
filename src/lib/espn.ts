import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const ESPN_LEAGUE_ID = "296381258";
export const ESPN_SEASON = 2026;
export const ESPN_LEAGUE_URL = `https://fantasy.espn.com/football/league?leagueId=${ESPN_LEAGUE_ID}`;
export const ESPN_DRAFT_URL = `https://fantasy.espn.com/football/draft?leagueId=${ESPN_LEAGUE_ID}&seasonId=${ESPN_SEASON}`;

export type EspnPick = {
  name: string;
  playerId: number;
  teamId: number;
  overall: number;
};

export type EspnPoll = {
  ok: boolean;
  private?: boolean;
  message: string;
  leagueName?: string;
  inProgress?: boolean;
  drafted?: boolean;
  picks: EspnPick[];
  teams: { id: number; name: string }[];
};

type EspnJson = {
  messages?: string[];
  settings?: { name?: string };
  draftDetail?: {
    drafted?: boolean;
    inProgress?: boolean;
    picks?: Array<{
      playerId?: number;
      teamId?: number;
      overallPickNumber?: number;
      playerPoolEntry?: { player?: { fullName?: string } };
    }>;
  };
  teams?: Array<{
    id?: number;
    location?: string;
    nickname?: string;
    abbrev?: string;
    name?: string;
  }>;
  players?: Array<{
    id?: number;
    player?: { id?: number; fullName?: string };
  }>;
};

let playerCache: Map<number, string> | null = null;

async function loadPlayerMap() {
  if (playerCache) return playerCache;
  const res = await fetch(
    `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${ESPN_SEASON}/players?scoringPeriodId=0&view=players_wl`,
    {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "x-fantasy-filter": '{"filterActive":{"value":true}}',
      },
    },
  );
  const rows = (await res.json()) as Array<{ id?: number; fullName?: string }>;
  const map = new Map<number, string>();
  for (const row of rows) {
    if (row.id && row.fullName) map.set(row.id, row.fullName);
  }
  playerCache = map;
  return map;
}

export const pollEspnDraft = createServerFn({ method: "POST" })
  .validator(
    z.object({
      leagueId: z.string(),
      swid: z.string().optional(),
      espnS2: z.string().optional(),
    }),
  )
  .handler(async ({ data }): Promise<EspnPoll> => {
    const cookies: string[] = [];
    if (data.swid) cookies.push(`SWID=${data.swid}`);
    if (data.espnS2) cookies.push(`espn_s2=${data.espnS2}`);
    const url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${ESPN_SEASON}/segments/0/leagues/${data.leagueId}?view=mDraftDetail&view=mSettings&view=mTeam&view=mStatus`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        ...(cookies.length ? { Cookie: cookies.join("; ") } : {}),
      },
    });
    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        private: true,
        message:
          "Private league. Watch the ESPN window, or unlock with your ESPN session.",
        picks: [],
        teams: [],
      };
    }
    if (!res.ok) {
      return {
        ok: false,
        message: `ESPN returned ${res.status}`,
        picks: [],
        teams: [],
      };
    }
    const json = (await res.json()) as EspnJson;
    if (json.messages?.length && !json.draftDetail) {
      return {
        ok: false,
        private: true,
        message: json.messages[0] ?? "Not authorized",
        picks: [],
        teams: [],
      };
    }
    const names = await loadPlayerMap();
    const picks: EspnPick[] = [];
    for (const p of json.draftDetail?.picks ?? []) {
      if (!p.playerId) continue;
      const name =
        p.playerPoolEntry?.player?.fullName || names.get(p.playerId);
      if (!name) continue;
      picks.push({
        name,
        playerId: p.playerId,
        teamId: p.teamId ?? 0,
        overall: p.overallPickNumber ?? 0,
      });
    }
    const teams = (json.teams ?? []).map((t) => ({
      id: t.id ?? 0,
      name:
        t.name ||
        [t.location, t.nickname].filter(Boolean).join(" ") ||
        t.abbrev ||
        `Team ${t.id}`,
    }));
    return {
      ok: true,
      leagueName: json.settings?.name,
      inProgress: json.draftDetail?.inProgress,
      drafted: json.draftDetail?.drafted,
      picks,
      teams,
      message: picks.length
        ? `${picks.length} picks on the ESPN board`
        : json.draftDetail?.inProgress
          ? "Draft live — waiting on first pick"
          : "Connected. Draft has not started.",
    };
  });

export const fetchEspnRanks = createServerFn({ method: "POST" }).handler(async () => {
  const url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${ESPN_SEASON}/segments/0/leaguedefaults/3?view=kona_player_info`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "x-fantasy-filter": JSON.stringify({
        players: {
          limit: 300,
          sortDraftRanks: { sortPriority: 1, sortAsc: true, value: "PPR" },
          filterActive: { value: true },
        },
      }),
    },
  });
  if (!res.ok) {
    return { ok: false as const, message: `ESPN ranks ${res.status}`, names: [] as string[] };
  }
  const json = (await res.json()) as {
    players?: Array<{
      player?: {
        fullName?: string;
        draftRanksByRankType?: { PPR?: { rank?: number } };
      };
    }>;
  };
  const rows = (json.players ?? [])
    .map((row) => ({
      name: row.player?.fullName ?? "",
      rank: row.player?.draftRanksByRankType?.PPR?.rank ?? 9999,
    }))
    .filter((r) => r.name)
    .sort((a, b) => a.rank - b.rank);
  return {
    ok: true as const,
    message: `${rows.length} ESPN PPR ranks`,
    names: rows.map((r) => r.name),
  };
});
