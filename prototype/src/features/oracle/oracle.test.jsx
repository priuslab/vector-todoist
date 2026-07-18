import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { OracleScreens } from "./OracleScreens";
import { GoalScreens } from "../goals/GoalScreens";
import { PaywallScreens } from "../goals/PaywallScreens";

it("selects an idea and dims unrelated nodes", async () => {
  const user = userEvent.setup();
  render(<OracleScreens screenId="oracle-balanced" />);

  await user.click(
    screen.getByRole("button", { name: "Зробити епізод про синдром самозванця" }),
  );

  expect(screen.getByTestId("oracle-graph")).toHaveAttribute(
    "data-selection",
    "idea-impostor",
  );
});

it("shows one free goal and the lifetime offer", () => {
  const { rerender } = render(<GoalScreens screenId="goals-default" />);
  expect(screen.getByText(/Запустити перший сезон подкасту/)).toBeInTheDocument();
  rerender(<PaywallScreens screenId="paywall-lifetime" />);
  expect(screen.getByText("$100")).toBeInTheDocument();
});
