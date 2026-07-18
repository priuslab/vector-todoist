import { render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { CalendarScreens } from "./CalendarScreens";

it("renders a stale calendar warning and keeps Google slots locked", async () => {
  const apiClient = { request: vi.fn().mockResolvedValue({ date: "2026-07-18", stale: true, warning: "Календар може бути застарілим.", slots: [{ id: "meeting", start: "2026-07-18T09:00:00Z", end: "2026-07-18T10:00:00Z" }] }) };
  render(<CalendarScreens apiClient={apiClient} />);
  await waitFor(() => expect(screen.getByText("Календар може бути застарілим")).toBeInTheDocument());
  expect(screen.getByRole("button", { name: "Зайнято" })).toHaveAttribute("data-locked", "true");
});

it("syncs connected Google Calendar before reading the day", async () => {
  const apiClient = { request: vi.fn(async (path) => path.includes("status") ? { status: "connected" } : { date: "2026-07-18", stale: false, slots: [] }) };
  render(<CalendarScreens apiClient={apiClient} />);
  await waitFor(() => expect(apiClient.request).toHaveBeenCalledWith(expect.stringContaining("/api/v1/calendar/day")));
  expect(apiClient.request.mock.calls.some(([path, options]) => path === "/api/v1/calendar/sync" && options?.method === "POST")).toBe(true);
});
