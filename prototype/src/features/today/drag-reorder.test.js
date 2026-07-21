import { describe, expect, it } from "vitest";
import { computeDropPlannedTimes } from "./useDragReorder";

describe("computeDropPlannedTimes", () => {
  it("дроп першим у списку → старт 09:00 локальної дати", () => {
    const tasks = [
      { id: "a", plannedStart: "2026-07-21T09:30:00+02:00", plannedEnd: "2026-07-21T10:30:00+02:00", estimatedMinutes: 60 },
      { id: "b", plannedStart: "2026-07-21T11:00:00+02:00", plannedEnd: "2026-07-21T11:30:00+02:00", estimatedMinutes: 30 },
    ];
    const result = computeDropPlannedTimes({ tasks, taskId: "b", dropIndex: 0, date: "2026-07-21" });
    expect(result.plannedStart.slice(11, 16)).toBe("09:00");
  });

  it("дроп після картки → plannedStart = plannedEnd попередньої картки", () => {
    const tasks = [
      { id: "a", plannedStart: "2026-07-21T09:30:00+02:00", plannedEnd: "2026-07-21T10:30:00+02:00", estimatedMinutes: 60 },
      { id: "b", plannedStart: "2026-07-21T11:00:00+02:00", plannedEnd: "2026-07-21T11:30:00+02:00", estimatedMinutes: 30 },
    ];
    const result = computeDropPlannedTimes({ tasks, taskId: "b", dropIndex: 1, date: "2026-07-21" });
    expect(result.plannedStart).toBe("2026-07-21T10:30:00+02:00");
  });

  it("дроп між двома locked-якорями бере попередню картку в новому порядку", () => {
    const tasks = [
      { id: "locked-1", plannedStart: "2026-07-21T08:00:00+02:00", plannedEnd: "2026-07-21T08:45:00+02:00", estimatedMinutes: 45, locked: true },
      { id: "a", plannedStart: "2026-07-21T09:30:00+02:00", plannedEnd: "2026-07-21T10:30:00+02:00", estimatedMinutes: 60 },
      { id: "locked-2", plannedStart: "2026-07-21T12:00:00+02:00", plannedEnd: "2026-07-21T12:30:00+02:00", estimatedMinutes: 30, locked: true },
    ];
    const result = computeDropPlannedTimes({ tasks, taskId: "a", dropIndex: 2, date: "2026-07-21" });
    expect(result.plannedStart).toBe("2026-07-21T12:30:00+02:00");
  });

  it("таска без estimatedMinutes отримує тривалість 30 хв", () => {
    const tasks = [
      { id: "a", plannedStart: "2026-07-21T09:30:00+02:00", plannedEnd: "2026-07-21T10:30:00+02:00", estimatedMinutes: 60 },
      { id: "b", plannedStart: "2026-07-21T11:00:00+02:00", plannedEnd: "2026-07-21T11:30:00+02:00" },
    ];
    const result = computeDropPlannedTimes({ tasks, taskId: "b", dropIndex: 1, date: "2026-07-21" });
    const startMs = new Date(result.plannedStart).getTime();
    const endMs = new Date(result.plannedEnd).getTime();
    expect((endMs - startMs) / 60000).toBe(30);
  });
});
