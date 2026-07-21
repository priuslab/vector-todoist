import { describe, expect, it } from "vitest";
import { isInternalRouteAllowed, resolveInternalRoute, resolveProductionRoute } from "./routeAccess";

describe("resolveProductionRoute", () => {
  it("routes an authenticated person straight to today", () => {
    expect(resolveProductionRoute({ pathname: "/", auth: { status: "authenticated", record: { onboardingCompleted: false } } })).toBe("today-normal");
  });

  it("keeps optional feature deep links on a safe enabled screen", () => {
    for (const pathname of ["/telegram", "/stripe", "/goalFocus", "/pomodoro", "/adaptation"]) {
      expect(resolveProductionRoute({ pathname, auth: { status: "authenticated", record: { onboardingCompleted: true } }, env: {} })).toBe("today-normal");
    }
    expect(resolveProductionRoute({ pathname: "/calendar", auth: { status: "authenticated", record: { onboardingCompleted: true } }, env: {} })).toBe("today-normal");
    expect(resolveProductionRoute({ pathname: "/oracle", auth: { status: "authenticated", record: { onboardingCompleted: true } }, env: {} })).toBe("today-normal");
    expect(resolveProductionRoute({ pathname: "/oracle", auth: { status: "authenticated", record: { onboardingCompleted: true } }, env: { VITE_FEATURE_ORACLE: "false" } })).toBe("today-normal");
  });

  it("keeps callback and anonymous entry routes outside protected screens", () => {
    expect(resolveProductionRoute({ pathname: "/auth/callback", auth: { status: "anonymous" } })).toBe("auth-callback");
    expect(resolveProductionRoute({ pathname: "/calendar", auth: { status: "anonymous" } })).toBe("entry-chaos");
  });

  it("keeps core navigation enabled unless it is explicitly disabled", () => {
    expect(resolveInternalRoute({ route: "inbox-default", env: { DEV: false } })).toBe("inbox-default");
  });

  it("hides demo-hidden Calendar and Oracle routes in production regardless of feature flags", () => {
    expect(isInternalRouteAllowed({ route: "calendar-day", env: { DEV: false, VITE_FEATURE_CALENDAR: "true" } })).toBe(false);
    expect(resolveInternalRoute({ route: "calendar-day", env: { DEV: false } })).toBe("today-normal");
    expect(resolveInternalRoute({ route: "oracle-balanced", env: { DEV: false } })).toBe("today-normal");
    expect(resolveInternalRoute({ route: "calendar-day", env: { DEV: false, VITE_FEATURE_CALENDAR: "false" } })).toBe("today-normal");
    expect(resolveInternalRoute({ route: "calendar-day", env: { DEV: true } })).toBe("calendar-day");
    expect(resolveInternalRoute({ route: "oracle-balanced", env: { MODE: "test" } })).toBe("oracle-balanced");
  });
});
