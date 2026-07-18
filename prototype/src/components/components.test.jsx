import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { AppFrame } from "./AppFrame";
import { Button } from "./Button";
import { UndoSnackbar } from "./UndoSnackbar";

it("gives the primary action an accessible name", () => {
  render(<Button>Продовжити</Button>);

  expect(screen.getByRole("button", { name: "Продовжити" })).toHaveClass(
    "button--primary",
  );
});

it("announces undo changes", () => {
  render(<UndoSnackbar message="План змінено" onUndo={vi.fn()} />);

  expect(screen.getByRole("status")).toHaveTextContent("План змінено");
  expect(screen.getByRole("button", { name: "Скасувати" })).toBeInTheDocument();
});

it("separates scrollable content from the persistent action footer", () => {
  render(
    <AppFrame footer={<Button>Продовжити</Button>} noNav>
      <p>Контент екрана</p>
    </AppFrame>,
  );

  expect(screen.getByTestId("action-footer-content")).toHaveTextContent("Контент екрана");
  expect(screen.getByTestId("action-footer")).toHaveTextContent("Продовжити");
});

it("keeps the legacy scroll wrapper when no footer is provided", () => {
  render(<AppFrame noNav><p>Звичайний екран</p></AppFrame>);

  expect(screen.getByTestId("app-frame-scroll")).toHaveTextContent("Звичайний екран");
  expect(screen.queryByTestId("action-footer")).not.toBeInTheDocument();
});
