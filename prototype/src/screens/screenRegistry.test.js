import { expect, it } from "vitest";
import { SCREEN_REGISTRY } from "./screenRegistry";

it("contains every required design state", () => {
  expect(SCREEN_REGISTRY.length).toBeGreaterThanOrEqual(82);
  expect(new Set(SCREEN_REGISTRY.map((item) => item.id)).size).toBe(
    SCREEN_REGISTRY.length,
  );
  expect(SCREEN_REGISTRY.map((item) => item.group)).toEqual(
    expect.arrayContaining([
      "Entry",
      "Onboarding",
      "Capture",
      "Today",
      "Inbox",
      "Task",
      "Calendar",
      "Oracle",
      "Goals",
      "Settings",
      "System",
    ]),
  );
});
