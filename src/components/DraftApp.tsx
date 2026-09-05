import { useEffect, useMemo, useRef, useState } from "react";
import {
  Radar,
  Search,
  Upload,
  RotateCcw,
  Check,
  X,
  MonitorUp,
  ClipboardCopy,
  Square,
  Link2,
  Zap,
  Footprints,
  Shield,
  Target,
  Crosshair,
  Castle,
  Timer,
  Users,
  Volume2,
  VolumeX,
  Radio,
  Trophy,
  Undo2,
} from "lucide-react";
import { PLAYERS_2026, type Player, type Position } from "@/lib/players";
import { LAST_YEAR, outlookFor, projLine, type YearLine } from "@/lib/lastYear";
import {
  badgesFor,
  calculatePower,
  DEMO_ESPN,
  extractFromText,
  gradeFor,
  needSlots,
  pickReasons,
  picksUntilTurn,
  quickMatch,
  eliteLeft,
  livePickCount,
  rankBoard,
  snakeOwner,
  vorp,
  rosterImpact,
  extractEspnPickLines,
  extractRosterAbbrevs,
  type ImpactGrade,
} from "@/lib/engine";
import { resolveTeam, useDraft, withLiveRanks } from "@/lib/store";
import { canvasHash, grabFrame, ocrSource, sliceCanvas } from "@/lib/ocr";
import {
  ESPN_DRAFT_URL,
  ESPN_LEAGUE_ID,
  ESPN_LEAGUE_URL,
  pollEspnDraft,
  fetchEspnRanks,
  extractEspnLeagueId,
} from "@/lib/espn";
import { SetupBoot } from "@/components/SetupBoot";
import { injuryFactor, sosPlayoff } from "@/lib/outlook";
import { synergyTags, vona, handcuffFor } from "@/lib/synergy";
import { parseDump, warRoomCard, matchInOrder } from "@/lib/warRoom";
import { buildRecap } from "@/lib/recap";
import { cn } from "@/lib/utils";
import { playCue, setMuted, startBed, stopBed, warmupAudio } from "@/lib/sounds";

const NEED_ICON = {
  QB: Target,
  RB: Footprints,
  WR: Zap,
  TE: Shield,
  FLEX: Radio,
  K: Crosshair,
  DST: Castle,
} as const;

const POS_CLASS: Record<Position, string> = {
  WR: "pos-wr",
  RB: "pos-rb",
  TE: "pos-te",
  QB: "pos-qb",
  K: "pos-k",
  DST: "pos-dst",
};

const POS_ICON: Record<Position, typeof Zap> = {
  WR: Zap,
  RB: Footprints,
  TE: Shield,
  QB: Target,
  K: Crosshair,
  DST: Castle,
};

function n1(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function StatSheet({ player }: { player: Player }) {
  const proj = projLine(player);
  const prior = LAST_YEAR[player.id];
  const pos = player.position;
  const rows: Array<{ label: string; line: YearLine }> = [];
  if (prior) rows.push({ label: "2025 STATISTICS", line: prior });
  rows.push({ label: "2026 PROJECTIONS", line: proj });

  const head =
    pos === "QB"
      ? ["YEAR", "PASS YDS", "TD", "INT", "RUSH YDS", "RUSH TD", "FPTS"]
      : pos === "RB"
        ? ["YEAR", "CAR", "YDS", "AVG", "TD", "REC", "YDS", "TD", "FPTS"]
        : pos === "WR" || pos === "TE"
          ? ["YEAR", "REC", "YDS", "AVG", "TD", "RUSH", "FPTS"]
          : ["YEAR", "FPTS"];

  function cells(line: YearLine): Array<string | number> {
    if (pos === "QB") {
      return [line.passYds, n1(line.passTd), n1(line.ints), line.rushYds, n1(line.rushTd), line.fpts.toFixed(1)];
    }
    if (pos === "RB") {
      const avg = line.rushAtt ? (line.rushYds / line.rushAtt).toFixed(1) : "—";
      return [line.rushAtt, line.rushYds, avg, n1(line.rushTd), n1(line.rec), line.recYds, n1(line.recTd), line.fpts.toFixed(1)];
    }
    if (pos === "WR" || pos === "TE") {
      const avg = line.rec ? (line.recYds / line.rec).toFixed(1) : "—";
      return [n1(line.rec), line.recYds, avg, n1(line.recTd), line.rushYds, line.fpts.toFixed(1)];
    }
    return [line.fpts.toFixed(1)];
  }

  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-white/10 bg-black/20">
      <table className="stat-sheet">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td>{row.label}</td>
              {cells(row.line).map((c, i) => (
                <td key={`${row.label}-${i}`}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-white/10 px-3 py-3 text-[12px] leading-snug text-muted">
        <span className="font-mono text-[10px] font-bold tracking-wide text-accent-bright">2026 OUTLOOK · </span>
        {outlookFor(player)}
      </p>
    </div>
  );
}

function FootballMark() {
  return (
    <div
      className="fd-btn grid size-14 shrink-0 place-items-center rounded-2xl shadow-[0_8px_20px_rgba(8,60,140,0.45)]"
      aria-hidden
    >
      <svg viewBox="0 0 64 64" className="size-10">
        <defs>
          <linearGradient id="ff-leather" x1="18%" y1="8%" x2="86%" y2="96%">
            <stop offset="0%" stopColor="#f0c48a" />
            <stop offset="38%" stopColor="#c47a32" />
            <stop offset="100%" stopColor="#6a3210" />
          </linearGradient>
          <clipPath id="ff-ball">
            <ellipse cx="32" cy="32" rx="26" ry="15" />
          </clipPath>
        </defs>
        <g transform="rotate(-26 32 32)">
          <ellipse cx="32" cy="34" rx="26" ry="15" fill="rgba(0,0,0,0.28)" />
          <ellipse cx="32" cy="32" rx="26" ry="15" fill="url(#ff-leather)" />
          <ellipse
            cx="26"
            cy="28"
            rx="14"
            ry="7"
            fill="#fff6e4"
            opacity="0.22"
          />
          <g clipPath="url(#ff-ball)">
            <path
              d="M12 18c-6 6-6 16 0 22"
              fill="none"
              stroke="#f8fafc"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
            <path
              d="M52 18c6 6 6 16 0 22"
              fill="none"
              stroke="#f8fafc"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
          </g>
          <path
            d="M22 32h20"
            stroke="#f8fafc"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M25 27v5M29 26.2v5.8M33 26.2v5.8M37 27v5"
            stroke="#f8fafc"
            strokeWidth="2.1"
            strokeLinecap="round"
          />
          <ellipse
            cx="32"
            cy="32"
            rx="26"
            ry="15"
            fill="none"
            stroke="rgba(255,255,255,0.35)"
            strokeWidth="1.2"
          />
        </g>
      </svg>
    </div>
  );
}

function PlayerSheet({
  player,
  team,
  available,
  untilMine,
  pickOverall,
  taken,
  onClose,
  onTake,
}: {
  player: Player;
  team: Player[];
  available: Player[];
  untilMine: number;
  pickOverall: number;
  taken: boolean;
  onClose: () => void;
  onTake: (mine: boolean) => void;
}) {
  const tags = synergyTags(player, team);
  const cuff = handcuffFor(player, PLAYERS_2026);
  const injury = injuryFactor(player.name);
  const sos = sosPlayoff(player.team);
  const reasons = pickReasons(player, team, available, untilMine);
  const v = vorp(player, available);
  const n = vona(player, available);
  const impact = rosterImpact(player, team, pickOverall);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/80"
        aria-label="Close player"
        onClick={onClose}
      />
      <div className="fd-sheet relative z-10 max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl p-5 sm:rounded-3xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <PosChip pos={player.position} />
              {player.isRookie && (
                <span className="rounded-full border border-white/20 px-2 py-0.5 text-[10px] font-extrabold">
                  ROOKIE
                </span>
              )}
              {tags.map((t) => (
                <span
                  key={t}
                  className="rounded-md border border-accent/40 px-2 py-0.5 font-mono text-[10px] font-bold tracking-widest text-accent-bright"
                >
                  {t}
                </span>
              ))}
              <ImpactBadge grade={impact.grade} />
            </div>
            <h2 className="mt-2 font-display text-4xl font-extrabold leading-none tracking-tight">
              {player.name}
            </h2>
            <p className="mt-2 text-sm text-muted">
              {player.team} · Bye {player.bye} · ADP {player.adp.toFixed(1)} · ESPN {player.espnRank ?? player.rank}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-10 shrink-0 place-items-center rounded-full border border-white/15"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-accent/25 bg-accent/10 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="font-mono text-[10px] font-bold tracking-widest text-accent-bright">
              IMPACT ON YOUR ROSTER
            </div>
            <ImpactBadge grade={impact.grade} />
          </div>
          <p className="mt-1 text-sm font-semibold">{impact.label}</p>
          <p className="mt-1 font-mono text-[11px] text-subtle">{impact.score}/100 lineup fit</p>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 font-mono text-[11px]">
          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
            <div className="text-subtle">PROJ</div>
            <div className="text-lg font-bold">{player.proj.toFixed(0)}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
            <div className="text-subtle">VORP</div>
            <div className="text-lg font-bold">{v >= 0 ? "+" : ""}{v.toFixed(0)}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
            <div className="text-subtle">VONA</div>
            <div className="text-lg font-bold">{n >= 0 ? "+" : ""}{n.toFixed(0)}</div>
          </div>
        </div>

        <StatSheet player={player} />

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
            <div className="font-mono text-[10px] font-bold tracking-widest text-accent-bright">DURABILITY</div>
            <p>{injury >= 0.95 ? "Clean bill" : injury < 0.85 ? "Injury tax" : "Watch the workload"} · {(injury * 100).toFixed(0)}%</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
            <div className="font-mono text-[10px] font-bold tracking-widest text-accent-bright">W15–17 SOS</div>
            <p>{sos > 1.05 ? "Soft playoff run" : sos < 0.95 ? "Brutal December" : "Neutral stretch"} · {sos.toFixed(2)}x</p>
          </div>
        </div>

        {cuff && (
          <p className="mt-3 text-sm text-muted">
            Handcuff: <span className="font-bold text-fg">{cuff.name}</span> · {cuff.proj.toFixed(0)} PPR
          </p>
        )}

        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm">
          <div className="font-mono text-[10px] font-bold tracking-widest text-accent-bright">ENGINE</div>
          <p>{reasons.join(" · ") || "Best remaining at this slot."}</p>
        </div>

        {!taken && (
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => onTake(true)}
              className="go-btn inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl text-sm font-extrabold"
            >
              <Check className="size-4" />I TOOK THIS
            </button>
            <button
              type="button"
              onClick={() => onTake(false)}
              className="stop-btn inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl text-sm font-extrabold"
            >
              TAKEN
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ImpactBadge({ grade, compact }: { grade: ImpactGrade; compact?: boolean }) {
  const cls =
    grade === "MUST"
      ? "border-danger/50 bg-danger/20 text-danger"
      : grade === "HIGH"
        ? "border-accent/50 bg-accent/15 text-accent-bright"
        : grade === "STEAL"
          ? "border-accent-bright/70 bg-accent/25 text-fg"
          : grade === "SOLID"
            ? "border-white/25 bg-white/10 text-fg"
            : grade === "LOW"
              ? "border-white/10 bg-white/5 text-subtle"
              : "border-white/10 text-subtle/70";
  const text = compact ? (grade === "STEAL" ? "STEAL" : grade) : grade === "STEAL" ? "VALUE STEAL" : grade;
  return (
    <span
      className={cn(
        "rounded-md border font-mono font-bold tracking-widest",
        compact ? "px-1 py-0 text-[9px]" : "px-2 py-0.5 text-[10px]",
        cls,
      )}
    >
      {text}
    </span>
  );
}

function PosChip({ pos }: { pos: Position }) {
  const Icon = POS_ICON[pos];
  return (
    <span
      className={cn(
        "inline-flex h-6 min-w-10 items-center justify-center gap-1 px-2 font-mono text-[10px] font-bold tracking-[0.14em]",
        POS_CLASS[pos],
      )}
    >
      <Icon className="size-3" />
      {pos}
    </span>
  );
}

function PowerDial({ power, grade }: { power: number; grade: string }) {
  return (
    <div
      className={cn(
        "grid size-[108px] place-items-center rounded-3xl border bg-black/35",
        power >= 70 ? "pwr-hot border-go/50" : "pwr-cold border-danger/40",
      )}
    >
      <div className="text-center">
        <div className="font-mono text-[10px] font-bold tracking-[0.28em] text-subtle">PWR</div>
        <div className="scoreboard-digit text-[44px] font-bold leading-none">{String(power).padStart(2, "0")}</div>
        <div
          className={cn(
            "font-mono text-sm font-bold tracking-[0.18em]",
            power >= 70 ? "text-go" : "text-danger",
          )}
        >
          {grade}
        </div>
      </div>
    </div>
  );
}

function TierTrack({ label, count, kind }: { label: string; count: number; kind: "wr" | "rb" }) {
  const filled = Math.max(0, Math.min(12, count));
  return (
    <div className="fd-glass px-4 py-3">
      <div className="flex items-center justify-between font-mono text-[11px] font-bold tracking-wide text-subtle">
        <span>{label}</span>
        <span className="text-fg">{String(count).padStart(2, "0")}</span>
      </div>
      <div className="mt-2 flex gap-px">
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i} className={cn("tier-cell", i < filled && (kind === "wr" ? "on-wr" : "on-rb"))} />
        ))}
      </div>
    </div>
  );
}

const STARTER_SLOTS: { key: string; pos: Position | "FLEX" }[] = [
  { key: "QB", pos: "QB" },
  { key: "RB1", pos: "RB" },
  { key: "RB2", pos: "RB" },
  { key: "WR1", pos: "WR" },
  { key: "WR2", pos: "WR" },
  { key: "WR3", pos: "WR" },
  { key: "TE", pos: "TE" },
  { key: "FLEX", pos: "FLEX" },
  { key: "K", pos: "K" },
  { key: "DST", pos: "DST" },
];

function assignSlots(team: Player[]) {
  const used = new Set<string>();
  const take = (pos: Position) => {
    const hit = team.find((p) => p.position === pos && !used.has(p.id));
    if (hit) used.add(hit.id);
    return hit ?? null;
  };
  const map: Record<string, Player | null> = {
    QB: take("QB"),
    RB1: take("RB"),
    RB2: take("RB"),
    WR1: take("WR"),
    WR2: take("WR"),
    WR3: take("WR"),
    TE: take("TE"),
    K: take("K"),
    DST: take("DST"),
  };
  const flex = team.find(
    (p) => !used.has(p.id) && (p.position === "RB" || p.position === "WR" || p.position === "TE"),
  );
  if (flex) used.add(flex.id);
  map.FLEX = flex ?? null;
  return map;
}

function RecapSheet({
  team,
  available,
  slot,
  teams,
  myIds,
  onClose,
}: {
  team: Player[];
  available: Player[];
  slot: number;
  teams: number;
  myIds: string[];
  onClose: () => void;
}) {
  const r = buildRecap(team, available, { slot, teams, myIds });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
      <button type="button" className="absolute inset-0 bg-black/70" aria-label="Close recap" onClick={onClose} />
      <div className="fd-sheet relative z-10 max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl p-5 sm:rounded-3xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] font-bold tracking-[0.28em] text-accent-bright">
              DRAFT ANALYSIS REPORT
            </div>
            <h2 className="title-glow mt-1 font-display text-4xl font-extrabold leading-none">{r.title}</h2>
            <p className="mt-2 text-sm text-muted">
              {r.archetype} · Rank {r.projectedRank} · Efficiency {r.efficiencyPct}%
            </p>
          </div>
          <button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-full fd-ghost">
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 font-mono text-[11px] sm:grid-cols-4">
          <div className="fd-glass px-3 py-3">
            <div className="text-subtle">ANTI-FRAGILITY</div>
            <div className="text-xl font-bold">{r.antiFragility}</div>
          </div>
          <div className="fd-glass px-3 py-3">
            <div className="text-subtle">FLEX OPTIONS</div>
            <div className="text-xl font-bold">{r.flexOptionality}</div>
          </div>
          <div className="fd-glass px-3 py-3">
            <div className="text-subtle">VARIANCE</div>
            <div className="text-xl font-bold">{r.varianceCoef.toFixed(2)}</div>
          </div>
          <div className="fd-glass px-3 py-3">
            <div className="text-subtle">VS LEAGUE</div>
            <div className="text-xl font-bold">
              {r.ppgVsLeague >= 0 ? "+" : ""}
              {r.ppgVsLeague}
            </div>
          </div>
        </div>

        <div className="mt-4 fd-glass p-4">
          <div className="font-mono text-[10px] font-bold tracking-widest text-accent-bright">EXECUTIVE SUMMARY</div>
          <p className="mt-2 text-sm font-semibold leading-relaxed">{r.verdict}</p>
          <p className="mt-2 text-sm text-muted">{r.path}</p>
        </div>

        <div className="mt-4 grid gap-3 font-mono text-[11px] sm:grid-cols-3">
          <div className="fd-glass px-3 py-3">
            <div className="text-subtle">CLEAR 115</div>
            <div className="text-xl font-bold">{r.simClear115.toFixed(0)}%</div>
          </div>
          <div className="fd-glass px-3 py-3">
            <div className="text-subtle">SIM MAX</div>
            <div className="text-xl font-bold">{r.simMax.toFixed(1)}</div>
          </div>
          <div className="fd-glass px-3 py-3">
            <div className="text-subtle">SIM FLOOR</div>
            <div className="text-xl font-bold">{r.simMin.toFixed(1)}</div>
          </div>
        </div>

        <div className="mt-4 fd-glass p-4">
          <div className="font-mono text-[10px] font-bold tracking-widest text-accent-bright">CAPITAL ALLOCATION</div>
          <p className="mt-2 text-sm">{r.capitalNote}</p>
          <p className="mt-2 font-mono text-[11px] text-subtle">
            WR leverage {r.leverageWrPct.toFixed(0)}% · RB leverage {r.leverageRbPct.toFixed(0)}%
          </p>
        </div>

        <div className="mt-4 fd-glass p-4">
          <div className="font-mono text-[10px] font-bold tracking-widest text-accent-bright">DRAFT EFFICIENCY</div>
          <p className="mt-2 text-sm">{r.snipeNote}</p>
          {r.highlights.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-muted">
              {r.highlights.map((h) => (
                <li key={`${h.player}-${h.round}`}>
                  R{h.round} {h.player} · {h.adpDelta > 0 ? "+" : ""}
                  {h.adpDelta} ADP · {h.impactNote}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-5 space-y-2">
          {r.rooms.map((room) => (
            <div key={room.pos} className="fd-pill px-3 py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] font-bold tracking-widest text-accent-bright">{room.pos}</span>
                <span className="font-mono text-[11px]">{room.ppg.toFixed(1)} PPG</span>
              </div>
              <p className="mt-1 text-sm font-bold">{room.names}</p>
              <p className="text-xs text-muted">{room.note}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="fd-glass p-4">
            <div className="font-mono text-[10px] font-bold tracking-widest text-accent-bright">WHY YOU WIN</div>
            <ul className="mt-2 space-y-2 text-sm">
              {r.strengths.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
          <div className="fd-glass p-4">
            <div className="font-mono text-[10px] font-bold tracking-widest text-danger">HOW YOU LOSE</div>
            <ul className="mt-2 space-y-2 text-sm">
              {r.risks.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        </div>

        {r.byes.length > 0 && (
          <div className="mt-4 fd-glass p-4">
            <div className="font-mono text-[10px] font-bold tracking-widest text-accent-bright">BYE LANDMINES</div>
            <ul className="mt-2 space-y-1 text-sm">
              {r.byes.map((b) => (
                <li key={b.week} className={b.hit ? "text-danger" : "text-muted"}>
                  W{b.week} · {b.names}
                  {b.hit ? " · CRISIS" : ""}
                </li>
              ))}
            </ul>
          </div>
        )}

        {(r.stacks.length > 0 || r.cuffs.length > 0) && (
          <div className="mt-4 fd-glass p-4 text-sm">
            {r.stacks.length > 0 && (
              <>
                <div className="font-mono text-[10px] font-bold tracking-widest text-accent-bright">STACKS</div>
                <p className="mt-1">{r.stacks.join(" · ")}</p>
              </>
            )}
            {r.cuffs.length > 0 && (
              <>
                <div className="mt-3 font-mono text-[10px] font-bold tracking-widest text-accent-bright">HANDCUFFS</div>
                <p className="mt-1">{r.cuffs.join(" · ")}</p>
              </>
            )}
          </div>
        )}

        {r.waivers.length > 0 && (
          <div className="mt-4 fd-glass p-4">
            <div className="font-mono text-[10px] font-bold tracking-widest text-accent-bright">FIRST WAIVER STRIKES</div>
            <ul className="mt-2 space-y-1 text-sm">
              {r.waivers.map((p) => (
                <li key={p.id}>
                  {p.name} · {p.position} · {p.proj.toFixed(0)} PPR
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export function DraftApp() {
  const draftedIds = useDraft((s) => s.draftedIds);
  const myIds = useDraft((s) => s.myIds);
  const lastIngest = useDraft((s) => s.lastIngest);
  const mark = useDraft((s) => s.mark);
  const ingest = useDraft((s) => s.ingest);
  const reset = useDraft((s) => s.reset);
  const slot = useDraft((s) => s.slot);
  const setSlot = useDraft((s) => s.setSlot);
  const teams = useDraft((s) => s.teams);
  const configured = useDraft((s) => s.configured);
  const unlockRoom = useDraft((s) => s.unlockRoom);
  const leagueId = useDraft((s) => s.leagueId);
  const setLeagueId = useDraft((s) => s.setLeagueId);
  const humanSlots = useDraft((s) => s.humanSlots);
  const cycleSeat = useDraft((s) => s.cycleSeat);
  const queueIds = useDraft((s) => s.queueIds);
  const setQueue = useDraft((s) => s.setQueue);
  const undo = useDraft((s) => s.undo);
  const keeperSeats = useDraft((s) => s.keeperSeats);

  const [query, setQuery] = useState("");
  const [takenQ, setTakenQ] = useState("");
  const [posFilter, setPosFilter] = useState<"ALL" | Position>("ALL");
  const [raw, setRaw] = useState("");
  const [ingestMsg, setIngestMsg] = useState("");
  const [ocrBusy, setOcrBusy] = useState(false);
  const [showSiren, setShowSiren] = useState(false);
  const [watchMode, setWatchMode] = useState<
    "off" | "screen" | "clip" | "sim" | "espn" | "sniff" | "auto"
  >("off");
  const [watchNote, setWatchNote] = useState("");
  const [swid, setSwid] = useState("");
  const [espnS2, setEspnS2] = useState("");
  const [showUnlock, setShowUnlock] = useState(false);
  const [muted, setMutedUi] = useState(false);
  const [rankNote, setRankNote] = useState("");
  const [beat, setBeat] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [selected, setSelected] = useState<Player | null>(null);
  const [showRecap, setShowRecap] = useState(false);
  const recapFired = useRef(false);
  const dropRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastHash = useRef(0);
  const lastClip = useRef("");
  const lastScreenIds = useRef<Set<string>>(new Set());
  const watchModeRef = useRef(watchMode);
  watchModeRef.current = watchMode;

  const myTeam = useMemo(() => resolveTeam(myIds), [myIds]);
  const draftedSet = useMemo(() => new Set(draftedIds), [draftedIds]);
  const available = useMemo(() => {
    const base = PLAYERS_2026.filter((p) => !draftedSet.has(p.id));
    return withLiveRanks(base, queueIds, draftedIds);
  }, [draftedSet, queueIds, draftedIds]);
  const draftedPlayers = useMemo(() => resolveTeam(draftedIds), [draftedIds]);
  const liveCount = livePickCount(draftedIds, keeperSeats);
  const untilMine = picksUntilTurn(liveCount, Math.max(slot, 1), teams);
  const clock = snakeOwner(liveCount + 1, Math.max(slot, 1), teams);
  const boardCtx = useMemo(
    () => ({ draftedIds, slot: Math.max(slot, 1), humanSlots, teams, keeperSeats }),
    [draftedIds, slot, humanSlots, teams, keeperSeats],
  );
  const rankedRows = useMemo(
    () => rankBoard(available, myTeam, untilMine, boardCtx),
    [available, myTeam, untilMine, boardCtx],
  );
  const recRow = rankedRows[0];
  const rec = recRow?.player ?? null;
  const power = calculatePower(myTeam);
  const grade = gradeFor(power);
  const needs = needSlots(myTeam);
  const badges = badgesFor(myTeam);
  const wasMine = useRef(false);
  const why = rec ? pickReasons(rec, myTeam, available, untilMine) : [];
  const room = useMemo(
    () => warRoomCard(rankedRows, myTeam, available, untilMine, boardCtx),
    [rankedRows, myTeam, available, untilMine, boardCtx],
  );
  const wrElite = eliteLeft(available, "WR");
  const rbElite = eliteLeft(available, "RB");
  const ranked = useMemo(() => rankedRows.map((row) => row.player), [rankedRows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ranked.filter((p) => {
      if (posFilter !== "ALL" && p.position !== posFilter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.team.toLowerCase().includes(q) ||
        p.position.toLowerCase() === q
      );
    });
  }, [ranked, query, posFilter]);

  function take(player: Player, mine: boolean) {
    mark(player, mine);
    if (mine) {
      playCue("mine", player.position, player.name);
      setShowSiren(true);
      window.setTimeout(() => setShowSiren(false), 1400);
    } else {
      playCue("taken");
    }
  }

  function takeTyped(mine: boolean) {
    if (takenQ.trim().toLowerCase() === "/undo") {
      runUndo();
      return;
    }
    const fromUrl = extractEspnLeagueId(takenQ);
    if (fromUrl) {
      setLeagueId(fromUrl);
      setTakenQ("");
      setWatchMode("espn");
      setWatchNote(`Polling ESPN draft ${fromUrl}…`);
      setIngestMsg("Practice drafts use a new league ID — syncing that room.");
      window.setTimeout(() => {
        void pullEspn();
      }, 0);
      return;
    }
    const hit = quickMatch(takenQ, available);
    if (!hit) {
      setIngestMsg("No match — type more of the last name.");
      return;
    }
    take(hit, mine);
    setTakenQ("");
    setIngestMsg(`${mine ? "You took" : "Taken"} ${hit.name}`);
  }

  function runUndo() {
    const id = undo();
    const p = PLAYERS_2026.find((x) => x.id === id);
    setTakenQ("");
    setIngestMsg(p ? `Rewound ${p.name}` : "Nothing to undo");
  }

  function runIngest(text: string, quiet = false, live = false) {
    const parsed = parseDump(text, PLAYERS_2026);
    if (parsed.queue.length) {
      setQueue(parsed.queue.map((p) => p.id));
      if (!quiet) setWatchNote(`ESPN queue locked · ${parsed.queue.length} ranks`);
    }
    const hits =
      parsed.taken.length || parsed.queue.length
        ? parsed.taken
        : extractFromText(text, PLAYERS_2026);
    const drafted = useDraft.getState().draftedIds;
    const fresh = hits.filter((p) => !drafted.includes(p.id));
    if (live && fresh.length > 5) {
      if (!quiet) {
        setWatchNote("Ignored the player list — only real picks get locked");
      }
      return 0;
    }
    const n = ingest(fresh);
    if (n) {
      setBeat(Date.now());
      playCue("ingest");
      setIngestMsg(
        `Auto-caught ${n} pick${n === 1 ? "" : "s"}: ${fresh
          .slice(0, 4)
          .map((p) => p.name)
          .join(", ")}`,
      );
    } else if (!quiet) {
      setIngestMsg("No new names matched.");
    }
    return n;
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setOcrBusy(true);
    setIngestMsg("Reading screenshot…");
    try {
      const Tesseract = await import("tesseract.js");
      let combined = "";
      for (const file of Array.from(files)) {
        const { data } = await Tesseract.recognize(file, "eng");
        combined += `\n${data.text}`;
      }
      setRaw((prev) => `${prev}\n${combined}`.trim());
      runIngest(combined);
    } catch {
      setIngestMsg("Could not read that image. Paste the ESPN pick list instead.");
    } finally {
      setOcrBusy(false);
    }
  }

  function stopWatch() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setWatchMode("off");
    setWatchNote("Watch stopped.");
    lastScreenIds.current = new Set();
  }

  async function scanScreenFrame() {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;
    if (!canvasRef.current) canvasRef.current = document.createElement("canvas");
    const canvas = canvasRef.current;
    grabFrame(video, canvas);
    const hash = canvasHash(canvas);
    if (hash === lastHash.current) {
      setWatchNote("Watching ESPN · board unchanged");
      return;
    }
    lastHash.current = hash;
    setWatchNote("Watching ESPN · scanning pick history…");
    try {
      const right = sliceCanvas(canvas, 0.68, 1);
      const left = sliceCanvas(canvas, 0, 0.26);
      const [rightText, leftText, fullText] = await Promise.all([
        ocrSource(right),
        ocrSource(left),
        ocrSource(canvas),
      ]);
      if (watchModeRef.current !== "screen") return;
      const history = extractEspnPickLines(`${rightText}\n${fullText}`, PLAYERS_2026);
      const rosterHits = extractRosterAbbrevs(leftText, PLAYERS_2026);
      const n = history.length ? ingest(history) : 0;
      if (rosterHits.length) {
        for (const p of rosterHits) {
          if (!useDraft.getState().myIds.includes(p.id)) {
            if (useDraft.getState().draftedIds.includes(p.id)) {
              /* already taken — promote to mine */
              useDraft.setState((s) => ({
                myIds: s.myIds.includes(p.id) ? s.myIds : [...s.myIds, p.id],
              }));
            } else {
              mark(p, true);
            }
          }
        }
      }
      lastScreenIds.current = new Set(history.map((p) => p.id));
      if (n || rosterHits.length) {
        playCue("ingest");
        setBeat(Date.now());
        setIngestMsg(
          `Caught ${n} pick${n === 1 ? "" : "s"} from ESPN${rosterHits.length ? ` · ${rosterHits.length} on your roster` : ""}`,
        );
      }
      setWatchNote(
        history.length
          ? `Watching ESPN · ${history.length} names on Pick History`
          : "Watching ESPN · no pick-history names yet — keep the Picks rail visible",
      );
    } catch {
      setWatchNote("Watching ESPN · scan hiccup, retrying");
    }
  }

  async function startScreenWatch() {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setIngestMsg(
        "This phone browser cannot share a window. Open the app on the computer running ESPN, or use clipboard watch.",
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 4 },
        audio: false,
      });
      streamRef.current = stream;
      stream.getVideoTracks()[0]?.addEventListener("ended", () => stopWatch());
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      lastHash.current = 0;
      lastScreenIds.current = new Set();
      setWatchMode("screen");
      setWatchNote("Watching ESPN · share the draft window and leave it up");
      setIngestMsg("Live watch on. New names on that window mark themselves taken.");
    } catch {
      setIngestMsg("Screen share cancelled. Need the ESPN draft window shared once.");
    }
  }

  async function startClipboardWatch() {
    if (!navigator.clipboard?.readText) {
      setIngestMsg("Clipboard watch is blocked here. Use Watch ESPN on desktop.");
      return;
    }
    try {
      lastClip.current = await navigator.clipboard.readText();
    } catch {
      lastClip.current = "";
    }
    setWatchMode("clip");
    setWatchNote("Clipboard armed · copy ESPN picks, no paste needed");
    setIngestMsg("Copy the pick list or a name — it will ingest without pasting.");
  }

  function startArmWatch() {
    setWatchMode("auto");
    setWatchNote("Armed · waiting for Edge sniffer or clipboard");
    setIngestMsg("Run espn-sniffer.py. Picks mark themselves.");
    void pullSniff();
  }

  function startSim() {
    setWatchMode("sim");
    setWatchNote("Simulating live board · auto-taking remaining names");
  }

  async function pullEspn() {
    try {
      const result = await pollEspnDraft({
        data: {
          leagueId: useDraft.getState().leagueId || ESPN_LEAGUE_ID,
          swid: swid.trim() || undefined,
          espnS2: espnS2.trim() || undefined,
        },
      });
      if (!result.ok) {
        setWatchNote(result.message);
        setIngestMsg(result.message);
        if (result.private) setShowUnlock(true);
        return;
      }
      setBeat(Date.now());
      const blob = result.picks.map((p) => p.name).join("\n");
      const n = runIngest(blob, true);
      setWatchNote(
        result.leagueName
          ? `${result.leagueName} · ${result.message}`
          : result.message,
      );
      if (n) setIngestMsg(`ESPN sync · ${n} new pick${n === 1 ? "" : "s"}`);
    } catch {
      setWatchNote("ESPN sync failed — using window watch");
    }
  }

  async function refreshRanks() {
    setRankNote("Pulling ESPN PPR ranks…");
    try {
      const result = await fetchEspnRanks();
      if (!result.ok || !result.names.length) {
        setRankNote(result.message || "No ranks");
        return;
      }
      const ordered = matchInOrder(result.names, PLAYERS_2026);
      setQueue(ordered.map((p) => p.id));
      setRankNote(`Live ESPN queue · ${ordered.length} players`);
    } catch {
      setRankNote("Rank pull failed — using snapshot");
    }
  }

  function startEspnWatch() {
    setWatchMode("espn");
    setWatchNote(`Syncing ESPN league ${leagueId || ESPN_LEAGUE_ID}…`);
    void pullEspn();
  }

  async function pullSniff() {
    try {
      const res = await fetch("/api/draft/stream-picks");
      const data = (await res.json()) as { names?: string[] };
      if (!data.names?.length) {
        setWatchNote("Edge sniffer idle — waiting for ESPN traffic");
        return;
      }
      const n = runIngest(data.names.join("\n"), true);
      setWatchNote(`Edge sniffer · ${data.names.length} names on the ESPN wire`);
      if (n) setIngestMsg(`Sniffer · ${n} new pick${n === 1 ? "" : "s"}`);
    } catch {
      setWatchNote("Sniffer endpoint offline — start helper/sniffer.py");
    }
  }

  function startSniffWatch() {
    setWatchMode("sniff");
    setWatchNote("Listening for Edge → ESPN mDraftDetail…");
    void pullSniff();
  }

  useEffect(() => {
    if (watchMode !== "screen") return;
    const id = window.setInterval(() => {
      void scanScreenFrame();
    }, 2800);
    void scanScreenFrame();
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchMode]);

  useEffect(() => {
    if (watchMode !== "clip" && watchMode !== "auto") return;
    const id = window.setInterval(async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (!text || text === lastClip.current) return;
        lastClip.current = text;
        const n = runIngest(text, true, true);
        setWatchNote(
          n
            ? `Live · ${n} new pick${n === 1 ? "" : "s"} from ESPN`
            : "Armed · ESPN page copied, no new names",
        );
      } catch {
        if (watchMode === "clip") {
          setWatchNote("Clipboard · click this tab if reads are blocked");
        }
      }
    }, 1500);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchMode]);

  useEffect(() => {
    if (watchMode !== "sim") return;
    const id = window.setInterval(() => {
      const state = useDraft.getState();
      const next = PLAYERS_2026.find((p) => !state.draftedIds.includes(p.id));
      if (!next) {
        setWatchMode("off");
        setWatchNote("Sim complete");
        return;
      }
      state.mark(next, false);
      playCue("taken");
      setIngestMsg(`Live pick: ${next.name} (${next.position})`);
      setWatchNote(`Simulating · ${next.name} just went`);
    }, 2200);
    return () => window.clearInterval(id);
  }, [watchMode]);

  useEffect(() => {
    if (watchMode !== "espn") return;
    const id = window.setInterval(() => {
      void pullEspn();
    }, 3000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchMode, swid, espnS2]);

  useEffect(() => {
    if (watchMode !== "sniff" && watchMode !== "auto") return;
    const id = window.setInterval(() => {
      void pullSniff();
    }, 1500);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchMode]);

  useEffect(() => {
    if (clock.isMine && !wasMine.current && draftedIds.length > 0) {
      playCue("clock");
      startBed();
    }
    if (!clock.isMine) stopBed();
    wasMine.current = clock.isMine;
  }, [clock.isMine, draftedIds.length]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (myTeam.length >= 14 && !recapFired.current) {
      recapFired.current = true;
      setShowRecap(true);
    }
  }, [myTeam.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        runUndo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!configured) return <SetupBoot />;

  return (
    <main className="flex min-h-dvh flex-col text-fg">
      <div className="fd-bar" />
      {showSiren && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-danger/20" />
          <div
            className="siren-disc relative size-44 rounded-full"
            style={{
              background:
                "conic-gradient(from 0deg, transparent 0deg, #ff5d5d 50deg, transparent 110deg, transparent 180deg, #ff5d5d 230deg, transparent 300deg)",
              boxShadow: "0 0 64px 16px rgba(255,93,93,0.4)",
            }}
          />
          <div className="absolute font-display text-xl font-extrabold tracking-[0.4em] text-danger">
            PICK
          </div>
        </div>
      )}

      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col px-3 py-3 sm:px-5 lg:px-6">
        <div
          className={cn(
            "mb-4 flex flex-wrap items-center justify-between gap-2 rounded-full px-3 py-2",
            beat && now - beat > 8000 ? "border border-red-500/50 bg-red-950/40" : "fd-glass",
          )}
        >
          <div className="flex min-w-0 items-center gap-2 text-xs font-semibold">
            <span
              className={cn(
                "size-2.5 shrink-0 rounded-full",
                !beat
                  ? "bg-muted"
                  : now - beat > 8000
                    ? "bg-red-500"
                    : "animate-pulse bg-accent shadow-[0_0_12px_#2ba4ff]",
              )}
            />
            <span className="truncate">
              {beat
                ? `Last ESPN sync: ${Math.max(0, Math.floor((now - beat) / 1000))}s ago`
                : "No ESPN heartbeat yet"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setWatchMode("espn");
              void pullEspn();
            }}
            className="h-9 shrink-0 rounded-full fd-ghost px-4 font-mono text-[11px] font-bold"
          >
            REFETCH
          </button>
        </div>
        {watchMode !== "off" && (
          <div className="fd-glass mb-5 flex items-center justify-between gap-3 rounded-2xl px-4 py-3">
            <div className="flex items-center gap-3 text-sm font-semibold">
              <span className="size-2.5 animate-pulse rounded-full bg-accent shadow-[0_0_12px_#2ba4ff]" />
              {watchNote || "Live"}
            </div>
            <button
              type="button"
              onClick={stopWatch}
              className="inline-flex h-9 items-center gap-1 rounded-full border border-white/20 px-3 text-xs font-bold"
            >
              <Square className="size-3" />
              Stop
            </button>
          </div>
        )}

        <header className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <FootballMark />
            <div>
              <p className="font-display text-sm font-bold tracking-[0.32em] text-accent-bright">
                FANTASY FORCE · ESPN {ESPN_LEAGUE_ID}
              </p>
              <h1 className="title-glow font-display text-5xl font-extrabold leading-[0.88] tracking-tight sm:text-6xl">
                DRAFT COMMAND
              </h1>
              <p className="mt-2 max-w-xl text-sm text-muted">
                Best player left. On the clock. No second-guessing.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={ESPN_LEAGUE_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="fd-ghost inline-flex h-10 items-center gap-1.5 px-4 font-mono text-[11px] font-bold"
                >
                  <Link2 className="size-3.5" />
                  League office
                </a>
                <a
                  href={ESPN_DRAFT_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="fd-ghost inline-flex h-10 items-center gap-1.5 px-4 font-mono text-[11px] font-bold"
                >
                  <Trophy className="size-3.5" />
                  Draft room
                </a>
                <button
                  type="button"
                  onClick={() => {
                    const next = !muted;
                    setMutedUi(next);
                    setMuted(next);
                    if (!next) {
                      warmupAudio();
                      playCue("click");
                    }
                  }}
                  className="fd-ghost inline-flex h-10 items-center gap-1.5 px-4 font-mono text-[11px] font-bold"
                >
                  {muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
                  {muted ? "Muted" : "Sound on"}
                </button>
                {myTeam.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowRecap(true)}
                    className="fd-btn inline-flex h-10 items-center gap-1.5 px-4 font-mono text-[11px] font-bold"
                  >
                    <Trophy className="size-3.5" />
                    Recap
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="fd-glass flex items-center gap-4 px-5 py-4">
            <PowerDial power={power} grade={grade} />
            <div>
              <div className="font-mono text-[11px] font-bold tracking-[0.28em] text-accent">
                TEAM POWER
              </div>
              <div className="mt-1 font-mono text-xs text-muted">
                {myTeam.length} / 9 STARTERS
              </div>
              <button
                type="button"
                onClick={reset}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-subtle hover:text-fg"
              >
                <RotateCcw className="size-3.5" />
                Reset board
              </button>
            </div>
          </div>
        </header>

        <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
          <form
            className="fd-glass flex flex-col gap-2 rounded-[28px] p-3 lg:flex-row lg:items-center"
            onSubmit={(e) => {
              e.preventDefault();
              takeTyped(false);
            }}
          >
            <input
              value={takenQ}
              onChange={(e) => setTakenQ(e.target.value)}
              placeholder="Last name just went — Enter"
              className="h-12 flex-1 rounded-xl bg-transparent px-4 text-sm text-fg placeholder:text-subtle outline-none"
            />
            <button type="submit" className="fd-btn h-12 w-full text-sm font-bold lg:w-auto lg:px-6">
              <span className="inline-flex items-center gap-2">
                <X className="size-4" />
                MARK TAKEN
              </span>
            </button>
            <button
              type="button"
              onClick={() => takeTyped(true)}
              className="go-btn h-12 w-full text-sm font-bold lg:w-auto lg:px-6"
            >
              <span className="inline-flex items-center gap-2">
                <Check className="size-4" />
                That was me
              </span>
            </button>
            <button
              type="button"
              onClick={runUndo}
              className="go-btn h-12 w-full text-sm font-bold lg:w-auto lg:px-6"
            >
              <span className="inline-flex items-center gap-2">
                <Undo2 className="size-4" />
                Undo
              </span>
            </button>
          </form>
          <label className="fd-glass flex h-[60px] items-center gap-3 rounded-2xl px-4 text-sm font-bold">
            <Target className="size-4 text-accent-bright" />
            SLOT
            <select
              value={slot}
              onChange={(e) => setSlot(Number(e.target.value))}
              className="bg-transparent font-display text-2xl font-extrabold outline-none"
            >
              {Array.from({ length: teams }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n} className="bg-surface">
                  {n}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={unlockRoom}
            className="fd-glass h-[60px] rounded-2xl px-4 text-xs font-bold tracking-widest"
          >
            ROOM
          </button>
        </div>
        <div className="mb-4 fd-glass rounded-2xl px-3 py-3">
          <div className="mb-2 font-mono text-[10px] font-bold tracking-widest text-subtle">
            SEATS · TAP HUMAN / PRINTER · {humanSlots.length} LIVE
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: teams }, (_, i) => i + 1).map((n) => {
              const mine = n === slot;
              const live = humanSlots.includes(n);
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => cycleSeat(n)}
                  className={cn(
                    "h-9 min-w-9 rounded-lg px-2 font-mono text-xs font-bold",
                    mine && "bg-accent text-black",
                    !mine && live && "border border-red-500/80 bg-red-950 text-red-100",
                    !mine && !live && "border border-white/15 text-muted",
                  )}
                >
                  {mine ? "YOU" : live ? `H${n}` : n}
                </button>
              );
            })}
          </div>
        </div>

        <div
          className={cn(
            "mb-5 rounded-2xl px-5 py-3.5 font-display text-xl font-extrabold tracking-wide sm:text-2xl",
            clock.isMine ? "clock-hot clock-pulse" : "fd-glass text-accent-bright",
          )}
        >
          {clock.isMine ? (
            <span className="inline-flex items-center gap-2">
              <Timer className="size-6" />
              ON THE CLOCK · R{clock.round} · PICK {draftedIds.length + 1}
            </span>
          ) : (
            <span className="inline-flex items-center gap-2">
              <Timer className="size-6" />
              {untilMine} PICK{untilMine === 1 ? "" : "S"} UNTIL YOU · ROUND {clock.round}
            </span>
          )}
        </div>

        <div className="roster-field-bar mb-4 flex flex-wrap gap-2 px-3 py-3">
          {(Object.keys(needs) as Array<keyof typeof needs>).map((key) => {
            const item = needs[key];
            const Icon = NEED_ICON[key];
            return (
              <span
                key={key}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1 font-mono text-[12px] font-bold tracking-wide",
                  item.filled ? "need-lock" : "need-open",
                )}
              >
                <Icon className="size-3" />
                {key} {item.have}/{item.need}
              </span>
            );
          })}
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3">
          <TierTrack label="WR TIER LEFT" count={wrElite} kind="wr" />
          <TierTrack label="RB TIER LEFT" count={rbElite} kind="rb" />
        </div>

        {badges.length > 0 && (
          <div className="mb-5 flex flex-wrap gap-2">
            {badges.map((b) => (
              <span
                key={b}
                className="metric-badge-cyber"
              >
                {b}
              </span>
            ))}
          </div>
        )}

        <div className="grid min-w-0 flex-1 gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.95fr)]">
          <section className="flex min-h-0 flex-col gap-5">
            <div
              className={cn(
                "fd-glass fd-hero relative z-10 overflow-hidden rounded-3xl p-6 sm:p-7",
                rec ? `stripe-${rec.position.toLowerCase()}` : "",
              )}
            >
              <div className="pointer-events-none absolute -right-6 -top-8 font-display text-[160px] font-extrabold leading-none text-white/5">
                {rec ? rec.rank : "—"}
              </div>
              <div className="font-display text-sm font-bold tracking-[0.32em] text-accent-bright">
                <span className="inline-flex items-center gap-2">
                  <Radio className="size-4" />
                  NEXT {untilMine > 1 ? "TURN" : "PICK"}
                </span>
              </div>
              {untilMine > 1 && (
                <p className="mt-1 text-[11px] font-bold tracking-wide text-accent-bright/80">
                  Projected at pick {draftedIds.length + untilMine + 1} · elites above him go first
                </p>
              )}
              {rec ? (
                <>
                  <div className="relative mt-2 flex flex-wrap items-end gap-3">
                    <h2
                      className="min-w-0 cursor-pointer break-words font-display text-3xl font-extrabold leading-[0.92] tracking-tight underline decoration-white/20 underline-offset-4 sm:text-5xl lg:text-6xl"
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelected(rec)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") setSelected(rec);
                      }}
                    >
                      {rec.name}
                    </h2>
                    <PosChip pos={rec.position} />
                    <ImpactBadge grade={rosterImpact(rec, myTeam, liveCount + 1).grade} />
                    {rec.isRookie && (
                      <span className="rounded-full border border-white/20 px-2 py-0.5 text-[10px] font-extrabold tracking-widest">
                        ROOKIE
                      </span>
                    )}
                    {rec.isDarkHorse && (
                      <span className="rounded-full border border-white/20 px-2 py-0.5 text-[10px] font-extrabold tracking-widest">
                        DARK HORSE
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-sm font-medium text-muted">
                    {rec.team} · Bye {rec.bye} · ADP {rec.adp.toFixed(1)} · {rec.ppg.toFixed(1)} PPG
                  </p>
                  <p className="mt-1 text-sm font-semibold text-accent-bright">
                    {rosterImpact(rec, myTeam, liveCount + 1).label}
                  </p>
                    <button
                      type="button"
                      onClick={() => setSelected(rec)}
                      className="mt-3 h-10 rounded-full border border-white/20 px-4 font-mono text-[11px] font-bold tracking-widest"
                    >
                      OPEN PLAYER CARD
                    </button>
                    <div className="mt-3 flex flex-wrap gap-2">
                    {(room?.tags ?? []).map((t) => (
                      <span
                        key={t}
                        className="rounded-md border border-accent/40 bg-accent/10 px-2 py-0.5 font-mono text-[10px] font-bold tracking-widest text-accent-bright"
                      >
                        {t === "HANDCUFF" ? "HANDCUFF" : "STACK"}
                      </span>
                    ))}
                    {room && (
                      <>
                        <span className="rounded-md border border-white/15 px-2 py-0.5 font-mono text-[10px] font-bold">
                          VORP {room.vorp >= 0 ? "+" : ""}
                          {room.vorp.toFixed(0)}
                        </span>
                        <span className="rounded-md border border-white/15 px-2 py-0.5 font-mono text-[10px] font-bold">
                          VONA {room.vona >= 0 ? "+" : ""}
                          {room.vona.toFixed(0)}
                        </span>
                      </>
                    )}
                  </div>
                  <StatSheet player={rec} />
                  <div className="mt-4 grid min-w-0 grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                    <div className="min-w-0 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                      <div className="font-mono text-[10px] font-bold tracking-widest text-accent-bright">
                        WHY
                      </div>
                      <p className="break-words">{room?.why || why.join(" · ")}</p>
                    </div>
                    <div className="min-w-0 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                      <div className="font-mono text-[10px] font-bold tracking-widest text-accent-bright">
                        DEAD ZONE
                      </div>
                      <p className="break-words">{room?.deadZone}</p>
                    </div>
                    <div className="min-w-0 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-mono text-[10px] font-bold tracking-widest text-accent-bright">
                          SHIELD
                        </div>
                        <span className="shrink-0 font-mono text-sm font-bold">{room?.integrity ?? 100}%</span>
                      </div>
                      <p className="break-words text-muted">
                        {room?.shield.length
                          ? room.shield.map((p) => p.name).join(" · ")
                          : "Printers only — or a human is in the way"}
                      </p>
                    </div>
                    <div className="min-w-0 rounded-xl border border-white/10 bg-black/20 px-3 py-2 sm:col-span-2">
                      <div className="font-mono text-[10px] font-bold tracking-widest text-accent-bright">
                        TIER CLIFF
                      </div>
                      <p className="break-words">{room?.cliff?.label ?? "No cliff — slopes are even"}</p>
                    </div>
                    <div className="min-w-0 rounded-xl border border-white/10 bg-black/20 px-3 py-2 sm:col-span-2">
                      <div className="font-mono text-[10px] font-bold tracking-widest text-accent-bright">
                        INTEL
                      </div>
                      <p className="break-words">{room?.intel}</p>
                    </div>
                    <div className="min-w-0 rounded-xl border border-white/10 bg-black/20 px-3 py-2 sm:col-span-2">
                      <div className="font-mono text-[10px] font-bold tracking-widest text-accent-bright">
                        CPU FALLBACK
                      </div>
                      <p className="break-words">
                        {room?.cpuFallback
                          ? `${room.cpuFallback.name} · ${room.cpuFallback.position}`
                          : room?.contingency
                            ? `${room.contingency.name} · ${room.contingency.position}`
                            : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="relative z-20 mt-6 flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => take(rec, true)}
                      className="go-btn inline-flex h-14 items-center justify-center gap-2 rounded-2xl px-6 text-base font-extrabold"
                    >
                      <Check className="size-5" />I TOOK THIS
                    </button>
                    <button
                      type="button"
                      onClick={() => take(rec, false)}
                      className="stop-btn inline-flex h-14 items-center justify-center gap-2 rounded-2xl px-6 text-base font-extrabold"
                    >
                      <X className="size-5" />
                      SOMEONE ELSE
                    </button>
                  </div>
                </>
              ) : (
                <p className="mt-3 text-lg">Board is empty.</p>
              )}
            </div>

            <div className="relative z-0">
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-subtle" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Find a player"
                    className="fd-glass h-12 w-full rounded-2xl pl-11 pr-4 text-sm text-fg placeholder:text-subtle outline-none"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(["ALL", "WR", "RB", "TE", "QB", "K", "DST"] as const).map((pos) => (
                    <button
                      key={pos}
                      type="button"
                      onClick={() => setPosFilter(pos)}
                      className={cn(
                        "h-10 rounded-full px-3.5 text-xs font-extrabold tracking-wide",
                        posFilter === pos ? "fd-btn" : "fd-glass",
                      )}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
              </div>
              <p className="mb-3 text-xs font-semibold tracking-wide text-subtle">
                {available.length} ON THE BOARD
              </p>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 2xl:grid-cols-3">
                {filtered.slice(0, 60).map((p) => (
                  <div
                    key={p.id}
                    className="fd-pill flex cursor-pointer items-center justify-between gap-2 rounded-2xl px-3 py-3"
                    onClick={() => setSelected(p)}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      <div className="font-display w-8 text-center text-lg font-extrabold text-white/35">
                        {p.rank}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <PosChip pos={p.position} />
                          <span className="truncate text-sm font-bold">{p.name}</span>
                          <ImpactBadge grade={rosterImpact(p, myTeam, liveCount + 1).grade} compact />
                          {synergyTags(p, myTeam).map((t) => (
                            <span
                              key={t}
                              className="rounded border border-white/20 px-1 font-mono text-[9px] font-bold tracking-widest text-accent-bright"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                        <div className="mt-0.5 text-[11px] font-medium text-subtle">
                          {p.team} · {p.proj.toFixed(0)} PPR
                          {p.position === "RB"
                            ? ` · ${p.rushYds.toFixed(0)} rush · ${p.rec.toFixed(0)} rec`
                            : p.position === "QB"
                              ? ` · ${p.passYds.toFixed(0)} yds · ${p.passTd.toFixed(0)} TD`
                              : p.rec > 0
                                ? ` · ${p.rec.toFixed(0)} rec · ${p.recYds.toFixed(0)} yds`
                                : ""}
                          {p.isRookie ? " · R" : ""}
                          {p.isDarkHorse ? " · DH" : ""}
                          {" · "}
                          {rosterImpact(p, myTeam, liveCount + 1).grade}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          take(p, true);
                        }}
                        className="fd-btn h-9 rounded-full px-3 text-[11px] font-extrabold"
                      >
                        MINE
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          take(p, false);
                        }}
                        className="h-9 rounded-full border border-white/20 px-3 text-[11px] font-extrabold"
                      >
                        TAKEN
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <aside className="flex flex-col gap-4">
            <div className="fd-glass rounded-3xl p-5">
              <div className="mb-2 flex items-center gap-2 font-display text-lg font-extrabold tracking-wide">
                <Radar className="size-4 text-accent-bright" />
                LIVE BOARD
              </div>
              <p className="text-xs leading-relaxed text-muted">
                Practice drafts get a <span className="text-fg">new ESPN league ID</span>.
                Copy the URL from the ESPN draft tab and paste it below, then hit SYNC.
              </p>
              <input
                value={leagueId}
                onChange={(e) => {
                  const v = e.target.value;
                  setLeagueId(extractEspnLeagueId(v) ?? v.replace(/\D/g, ""));
                }}
                onPaste={(e) => {
                  const text = e.clipboardData.getData("text");
                  const id = extractEspnLeagueId(text);
                  if (id) {
                    e.preventDefault();
                    setLeagueId(id);
                  }
                }}
                placeholder="Paste ESPN draft URL or leagueId"
                className="mt-3 h-11 w-full rounded-xl border border-white/15 bg-black/25 px-3 text-sm outline-none"
              />
              <p className="mt-2 font-mono text-[10px] text-subtle">
                Watching {leagueId || ESPN_LEAGUE_ID}
              </p>
              <p className="mt-2 text-[10px] tracking-wide text-white/40">
                Broadcast bumpers — Kevin MacLeod / incompetech
              </p>
              <div className="mt-4 grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    watchMode === "auto" ? stopWatch() : startArmWatch()
                  }
                  className="fd-btn inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-extrabold"
                >
                  <Radar className="size-4" />
                  {watchMode === "auto" ? "DISARM" : "ARM ESPN"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    watchMode === "espn" ? stopWatch() : startEspnWatch()
                  }
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-4 text-sm font-extrabold"
                >
                  <Radar className="size-4" />
                  {watchMode === "espn" ? "STOP ESPN SYNC" : "SYNC ESPN LEAGUE"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    watchMode === "sniff" ? stopWatch() : startSniffWatch()
                  }
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-4 text-sm font-extrabold"
                >
                  <Radar className="size-4" />
                  {watchMode === "sniff" ? "STOP EDGE SNIFFER" : "LISTEN TO EDGE"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    watchMode === "screen" ? stopWatch() : startScreenWatch()
                  }
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-4 text-sm font-extrabold"
                >
                  <MonitorUp className="size-4" />
                  {watchMode === "screen" ? "STOP WINDOW" : "WATCH ESPN WINDOW"}
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      watchMode === "clip" ? stopWatch() : startClipboardWatch()
                    }
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/15 px-3 text-xs font-bold"
                  >
                    <ClipboardCopy className="size-4" />
                    {watchMode === "clip" ? "Stop clip" : "Clipboard"}
                  </button>
                  <button
                    type="button"
                    onClick={() => (watchMode === "sim" ? stopWatch() : startSim())}
                    className="h-11 rounded-2xl border border-white/15 px-3 text-xs font-bold"
                  >
                    {watchMode === "sim" ? "Stop sim" : "Simulate live"}
                  </button>
                </div>
              </div>
              {showUnlock && (
                <div className="mt-3 space-y-2 rounded-2xl border border-white/10 bg-black/20 p-3">
                  <p className="text-xs">
                    Private league. Paste SWID + espn_s2 from ESPN cookies, or watch the window.
                  </p>
                  <input
                    value={leagueId}
                    onChange={(e) => setLeagueId(e.target.value)}
                    placeholder="League ID"
                    className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none"
                  />
                  <input
                    value={swid}
                    onChange={(e) => setSwid(e.target.value)}
                    placeholder="SWID"
                    className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none"
                  />
                  <input
                    value={espnS2}
                    onChange={(e) => setEspnS2(e.target.value)}
                    placeholder="espn_s2"
                    className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none"
                  />
                  <button
                    type="button"
                    onClick={startEspnWatch}
                    className="fd-btn h-10 w-full rounded-xl text-sm font-extrabold"
                  >
                    RETRY ESPN SYNC
                  </button>
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void refreshRanks()}
                  className="h-10 rounded-full border border-white/15 px-4 text-xs font-bold"
                >
                  Refresh ESPN ranks
                </button>
                {rankNote ? <span className="text-xs text-muted">{rankNote}</span> : null}
                {queueIds.length ? (
                  <span className="text-xs text-muted">Queue {queueIds.length}</span>
                ) : null}
              </div>
              <video ref={videoRef} className="hidden" muted playsInline />
              <textarea
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                placeholder="Manual backup — paste recap if watch is off"
                className="mt-3 h-20 w-full resize-none rounded-2xl border border-white/10 bg-black/20 p-3 text-sm placeholder:text-subtle outline-none"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => runIngest(raw)}
                  className="h-10 rounded-full border border-white/15 px-4 text-xs font-bold"
                >
                  Scan paste
                </button>
                <button
                  type="button"
                  onClick={() => dropRef.current?.click()}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-white/15 px-4 text-xs font-bold"
                >
                  <Upload className="size-4" />
                  {ocrBusy ? "Reading…" : "Screenshot"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRaw(DEMO_ESPN);
                    runIngest(DEMO_ESPN);
                  }}
                  className="h-10 rounded-full border border-white/15 px-4 text-xs font-bold"
                >
                  Demo board
                </button>
              </div>
              <input
                ref={dropRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => onFiles(e.target.files)}
              />
              {ingestMsg && <p className="mt-3 text-xs font-semibold">{ingestMsg}</p>}
              {lastIngest && (
                <p className="mt-1 text-[11px] text-subtle">Last scan {lastIngest}</p>
              )}
            </div>

            <div className="fd-glass flex-1 rounded-3xl p-5">
              <h3 className="font-display text-lg font-extrabold tracking-wide">
                <span className="inline-flex items-center gap-2">
                  <Users className="size-4 text-accent-bright" />
                  MY ROSTER · {myTeam.length}/10
                </span>
              </h3>
              <ul className="mt-3 space-y-1.5">
                {STARTER_SLOTS.map((slotDef) => {
                  const filled = assignSlots(myTeam)[slotDef.key];
                  return (
                    <li
                      key={slotDef.key}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm",
                        filled
                          ? "fd-pill cursor-pointer"
                          : "border border-dashed border-white/15 bg-white/[0.03]",
                      )}
                      onClick={() => filled && setSelected(filled)}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="w-9 shrink-0 font-mono text-[10px] font-bold tracking-widest text-subtle">
                          {slotDef.key}
                        </span>
                        {filled ? (
                          <span className="truncate font-bold">{filled.name}</span>
                        ) : (
                          <span className="text-subtle">Open</span>
                        )}
                      </span>
                      {filled ? (
                        <span className="font-display text-sm font-extrabold text-white/40">#{filled.rank}</span>
                      ) : (
                        <span className="text-[10px] text-white/20">—</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="fd-glass rounded-3xl p-5">
              <h3 className="font-display text-lg font-extrabold tracking-wide">
                <span className="inline-flex items-center gap-2">
                  <Shield className="size-4 text-accent-bright" />
                  TAKEN · {draftedPlayers.length}
                </span>
              </h3>
              {draftedPlayers.length === 0 ? (
                <ul className="mt-3 space-y-1.5">
                  {ranked.slice(0, 8).map((p) => (
                    <li
                      key={`watch-${p.id}`}
                      className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-white/5 px-3 py-1.5 text-sm"
                      onClick={() => setSelected(p)}
                    >
                      <span className="truncate text-muted">
                        {p.name}
                        <span className="ml-1 text-subtle">· {p.position}</span>
                      </span>
                      <span className="font-mono text-[10px] text-subtle">ADP {p.adp.toFixed(0)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className="mt-3 max-h-56 space-y-1 overflow-y-auto text-sm">
                  {draftedPlayers.map((p) => (
                    <li
                      key={p.id}
                      className="flex cursor-pointer justify-between gap-2 py-1"
                      onClick={() => setSelected(p)}
                    >
                      <span className="font-semibold">
                        {p.name}
                        {myIds.includes(p.id) ? " · YOU" : ""}
                      </span>
                      <span className="text-subtle">{p.position}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      </div>
      {selected && (
        <PlayerSheet
          player={selected}
          team={myTeam}
          available={available}
          untilMine={untilMine}
          pickOverall={liveCount + 1}
          taken={draftedSet.has(selected.id)}
          onClose={() => setSelected(null)}
          onTake={(mine) => {
            take(selected, mine);
            setSelected(null);
          }}
        />
      )}
      {showRecap && myTeam.length > 0 && (
        <RecapSheet
          team={myTeam}
          available={available}
          slot={slot}
          teams={teams}
          myIds={myIds}
          onClose={() => setShowRecap(false)}
        />
      )}
    </main>
  );
}
