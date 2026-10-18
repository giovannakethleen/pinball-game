import { describe, it, expect } from "vitest";
import { sortRanking } from "@/game/ranking";

describe("ranking", () => {
  it("orders by score desc, earlier date wins ties, max 10", () => {
    const list = Array.from({ length: 12 }, (_, i) => ({ name: "p" + i, score: i === 11 ? 500 : 100, date: i }));
    const r = sortRanking(list);
    expect(r[0]!.score).toBe(500);
    expect(r[1]!.name).toBe("p0");
    expect(r).toHaveLength(10);
  });
});
