export type ScoreEntry = { name: string; score: number; date: number };
const KEY = "cosmic-pinball-ranking";

export function sortRanking(list: ScoreEntry[]): ScoreEntry[] {
  return [...list].sort((a, b) => b.score - a.score || a.date - b.date).slice(0, 10);
}
export function loadRanking(): ScoreEntry[] {
  try { return sortRanking(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch { return []; }
}
export function saveScore(name: string, score: number): ScoreEntry[] {
  const clean = name.trim().slice(0, 12) || "Astronauta";
  const list = sortRanking([...loadRanking(), { name: clean, score, date: Date.now() }]);
  localStorage.setItem(KEY, JSON.stringify(list));
  return list;
}
