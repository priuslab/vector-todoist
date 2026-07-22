import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it, vi } from "vitest";
import { AppFrame } from "./AppFrame";
import { Button } from "./Button";
import { UndoSnackbar } from "./UndoSnackbar";
import { ActionFooterLayout } from "./ActionFooterLayout";
import { BottomNav } from "./BottomNav";

const componentsCss = readFileSync(resolve(process.cwd(), "src/styles/components.css"), "utf8");

it("gives the primary action an accessible name", () => {
  render(<Button>Продовжити</Button>);

  expect(screen.getByRole("button", { name: "Продовжити" })).toHaveClass(
    "button--primary",
  );
});

it("keeps Calendar and Oracle available in the primary bottom navigation", () => {
  render(<BottomNav active="today-normal" onNavigate={vi.fn()} />);

  expect(screen.getByRole("button", { name: "Сьогодні" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Inbox" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Brain Dump" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Календар" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Oracle" })).toBeInTheDocument();
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

it("applies the two-row footer modifier directly", () => {
  const { container } = render(
    <ActionFooterLayout footer={<Button>Продовжити</Button>} footerRows={2}>
      <p>Контент</p>
    </ActionFooterLayout>,
  );

  expect(container.firstChild).toHaveClass("action-footer-layout--rows-2");
});

it("applies the centered-content modifier directly", () => {
  const { container } = render(
    <ActionFooterLayout footer={<Button>Продовжити</Button>} contentAlign="center">
      <p>Контент</p>
    </ActionFooterLayout>,
  );

  expect(container.firstChild).toHaveClass("action-footer-layout--center");
});

it("keeps undo offsets aligned with footer rows and the safe-area delta", () => {
  expect(componentsCss).toMatch(/--action-footer-offset-base:\s*92px/);
  expect(componentsCss).toMatch(/action-footer-layout--rows-2\s*\{\s*--action-footer-offset-base:\s*154px/);
  expect(componentsCss).toMatch(/--action-footer-safe-area-delta:\s*max\(0px,\s*calc\(env\(safe-area-inset-bottom\)\s*-\s*14px\)\)/);
  expect(componentsCss).toMatch(/--action-footer-offset:\s*calc\(var\(--action-footer-offset-base\)\s*\+\s*var\(--action-footer-safe-area-delta\)\)/);
});

it("centers short content safely when it fits", () => {
  expect(componentsCss).toMatch(/justify-content:\s*safe center/);
});

it("keeps Calendar and Oracle visible in production navigation", () => {
  render(<BottomNav active="today-normal" onNavigate={vi.fn()} env={{ DEV: false }} />);

  expect(screen.getByRole("button", { name: "Календар" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Oracle" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Сьогодні" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Brain Dump" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Inbox" })).toBeInTheDocument();
});
