/** ESPN default PPR — league default 3. Matches this ESPN league. */
export const SCORING = {
  passYd: 1 / 25,
  passTd: 4,
  int: -2,
  rushYd: 1 / 10,
  rushTd: 6,
  rec: 1,
  recYd: 1 / 10,
  recTd: 6,
  fumbleLost: -2,
} as const;

/** 12-team starter pool used for replacement (VORP). */
export const REPLACEMENT_INDEX = {
  QB: 12,
  RB: 28,
  WR: 42,
  TE: 14,
  K: 12,
  DST: 12,
} as const;
