import { describe, expect, it } from "vitest";
import { resolveInternalRoute, resolveProductionRoute } from "./routeAccess";

describe("resolveProductionRoute", () => {
  it("routes an authenticated person without onboarding to the welcome flow", () => {
    expect(resolveProductionRoute({ pathname: "/", auth: { status: "authenticated", record: { onboardingCompleted: false } } })).toBe("onboarding-welcome");
  });

  it("keeps disabled feature deep links on a safe enabled screen", () => {
    for (const pathname of ["/calendar", "/telegram", "/oracle", "/stripe", "/goalFocus", "/pomodoro", "/adaptation"]) {
      expect(resolveProductionRoute({ pathname, auth: { status: "authenticated", record: { onboardingCompleted: true } }, env: {} })).toBe("today-normal");
    }
    expect(resolveProductionRoute({ pathname: "/oracle", auth: { status: "authenticated", record: { onboardingCompleted: true } }, env: { VITE_FEATURE_ORACLE: "true" } })).toBe("oracle-balanced");
  });

  it("keeps callback and anonymous entry routes outside protected screens", () => {
    expect(resolveProductionRoute({ pathname: "/auth/callback", auth: { status: "anonymous" } })).toBe("auth-callback");
    expect(resolveProductionRoute({ pathname: "/calendar", auth: { status: "anonymous" } })).toBe("entry-chaos");
  });

  it("blocks internal feature navigation when the relevant flag is disabled", () => {
    expect(resolveInternalRoute({ route: "calendar-day", env: { DEV: false } })).toBe("today-normal");
    expect(resolveInternalRoute({ route: "oracle-balanced", env: { DEV: false } })).toBe("today-normal");
    expect(resolveInternalRoute({ route: "calendar-day", env: { DEV: false, VITE_FEATURE_CALENDAR: "true" } })).toBe("calendar-day");
    expect(resolveInternalRoute({ route: "inbox-default", env: { DEV: false } })).toBe("inbox-default");
  });
});
