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

export function extractEspnLeagueId(text: string): string | null {
  const fromUrl = text.match(/leagueId=(\d{4,})/i);
  if (fromUrl) return fromUrl[1];
  const bare = text.trim();
  if (/^\d{6,12}$/.test(bare)) return bare;
  return null;
}

async function loadPlayerMap() {
  if (playerCache) return playerCache;
  const map = new Map<number, string>();
  const ingest = (rows: unknown) => {
    const list = Array.isArray(rows)
      ? rows
      : rows && typeof rows === "object" && "players" in rows
        ? ((rows as { players?: unknown[] }).players ?? [])
        : [];
    for (const row of list) {
      if (!row || typeof row !== "object") continue;
      const r = row as {
        id?: number;
        fullName?: string;
        playerId?: number;
        player?: { id?: number; fullName?: string };
      };
      const id = r.player?.id ?? r.id ?? r.playerId;
      const name = r.player?.fullName ?? r.fullName;
      if (id && name) map.set(id, name);
    }
  };

  try {
    const kona = await fetch(
      `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${ESPN_SEASON}/segments/0/leaguedefaults/3?view=kona_player_info`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "x-fantasy-filter": JSON.stringify({
            players: {
              limit: 800,
              sortDraftRanks: { sortPriority: 1, sortAsc: true, value: "PPR" },
              filterActive: { value: true },
            },
          }),
        },
      },
    );
    if (kona.ok) ingest(await kona.json());
  } catch {
    /* continue */
  }

  if (map.size < 50) {
    try {
      const res = await fetch(
        `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${ESPN_SEASON}/players?scoringPeriodId=0&view=players_wl`,
        {
          headers: {
            "User-Agent": "Mozilla/5.0",
            "x-fantasy-filter": '{"filterActive":{"value":true}}',
          },
        },
      );
      if (res.ok) ingest(await res.json());
    } catch {
      /* empty map is handled by callers */
    }
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
    const headers = {
      "User-Agent": "Mozilla/5.0",
      ...(cookies.length ? { Cookie: cookies.join("; ") } : {}),
    };
    const urls = [
      `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${ESPN_SEASON}/segments/0/leagues/${data.leagueId}?view=mDraftDetail&view=mSettings&view=mTeam&view=mStatus`,
      `https://fantasy.espn.com/apis/v3/games/ffl/seasons/${ESPN_SEASON}/segments/0/leagues/${data.leagueId}?view=mDraftDetail&view=mSettings&view=mTeam&view=mStatus`,
    ];
    let json: EspnJson | null = null;
    let lastStatus = 0;
    for (const url of urls) {
      const res = await fetch(url, { headers });
      lastStatus = res.status;
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
      if (!res.ok) continue;
      json = (await res.json()) as EspnJson;
      break;
    }
    if (!json) {
      return {
        ok: false,
        message: `ESPN returned ${lastStatus || "no response"}`,
        picks: [],
        teams: [],
      };
    }
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
      const playerId = p.playerId;
      if (!playerId) continue;
      const name =
        p.playerPoolEntry?.player?.fullName || names.get(playerId);
      if (!name) continue;
      picks.push({
        name,
        playerId,
        teamId: p.teamId ?? 0,
        overall: p.overallPickNumber ?? 0,
      });
    }
    const unnamed = (json.draftDetail?.picks ?? []).filter((p) => p.playerId).length;
    const teams = (json.teams ?? []).map((t) => ({
      id: t.id ?? 0,
      name:
        t.name ||
        [t.location, t.nickname].filter(Boolean).join(" ") ||
        t.abbrev ||
        `Team ${t.id}`,
    }));
    const practiceHint =
      unnamed === 0
        ? "Practice drafts get a NEW league ID. Copy the URL from the ESPN draft tab and paste it here."
        : unnamed > picks.length
          ? `Mapped ${picks.length}/${unnamed} ESPN player IDs.`
          : "";
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
          ? `Draft live — waiting on first pick. ${practiceHint}`
          : `Connected to ${data.leagueId}, but 0 picks. ${practiceHint}`,
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
