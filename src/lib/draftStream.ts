export type StreamPicks = {
  names: string[];
  at: number;
};

const g = globalThis as unknown as { __draftStream?: StreamPicks };

export function setStreamPicks(names: string[]) {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  g.__draftStream = { names: unique, at: Date.now() };
  return unique;
}

export function getStreamPicks(): StreamPicks {
  return g.__draftStream ?? { names: [], at: 0 };
}
