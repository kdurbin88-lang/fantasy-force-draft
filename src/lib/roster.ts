import { PLAYERS_2026, type Player } from "./players";

/** Locked 2026 Foolish Club roster — pick 3. */
export const MY_TEAM_2026_NAMES = [
  "Matthew Stafford",
  "Javonte Williams",
  "D'Andre Swift",
  "Puka Nacua",
  "Drake London",
  "Mark Andrews",
  "Ladd McConkey",
  "Eagles D/ST",
  "Tyler Loop",
  "DK Metcalf",
  "Jaylen Warren",
  "Parker Washington",
  "Matthew Golden",
  "Quentin Johnston",
  "Romeo Doubs",
  "Alvin Kamara",
];

export function myTeam2026(): Player[] {
  return MY_TEAM_2026_NAMES.map((name) => PLAYERS_2026.find((p) => p.name === name)).filter(
    (p): p is Player => Boolean(p),
  );
}
