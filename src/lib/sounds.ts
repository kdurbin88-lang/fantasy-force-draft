import type { Position } from "./players";

let muted = false;
const cache = new Map<string, HTMLAudioElement>();
let bed: HTMLAudioElement | null = null;

const CUE: Record<string, string> = {
  siren: "/sfx/mine.mp3",
  mine: "/sfx/mine.mp3",
  taken: "/sfx/taken.mp3",
  clock: "/sfx/clock.mp3",
  ingest: "/sfx/ingest.mp3",
  click: "/sfx/whoosh.mp3",
};

export function setMuted(next: boolean) {
  muted = next;
  if (next) stopBed();
}

export function isMuted() {
  return muted;
}

function node(src: string) {
  let a = cache.get(src);
  if (!a) {
    a = new Audio(src);
    a.preload = "auto";
    cache.set(src, a);
  }
  return a;
}

function sample(src: string, volume = 1) {
  if (typeof Audio === "undefined") return;
  const play = node(src).cloneNode(true) as HTMLAudioElement;
  play.volume = volume;
  void play.play().catch(() => undefined);
}

export function warmupAudio() {
  Object.values(CUE).forEach((src) => node(src));
  node("/sfx/bed.mp3");
}

export function startBed() {
  if (muted || typeof Audio === "undefined") return;
  if (!bed) {
    bed = new Audio("/sfx/bed.mp3");
    bed.loop = true;
    bed.volume = 0.28;
  }
  void bed.play().catch(() => undefined);
}

export function stopBed() {
  if (!bed) return;
  bed.pause();
  bed.currentTime = 0;
}

export function playCue(
  kind: "siren" | "taken" | "clock" | "ingest" | "click" | "mine",
  _pos?: Position,
  _name?: string,
) {
  if (muted) return;
  warmupAudio();
  sample(CUE[kind] ?? CUE.click, kind === "mine" ? 1 : 0.92);
}
