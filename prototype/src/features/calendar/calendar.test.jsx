import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { CalendarScreens } from "./CalendarScreens";

it("marks Google events as locked", () => {
  render(<CalendarScreens screenId="calendar-day" />);

  expect(screen.getByRole("button", { name: "Командний синк" })).toHaveAttribute(
    "data-locked",
    "true",
  );
});
