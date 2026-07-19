import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { SettingsScreens } from "./SettingsScreens";

it("applies an AI adaptation suggestion explicitly", async () => {
  const user = userEvent.setup();
  render(<SettingsScreens screenId="settings-adaptation" />);

  await user.click(screen.getByRole("button", { name: "Прийняти зміну" }));

  expect(screen.getByRole("status")).toHaveTextContent("Налаштування оновлено");
});

it.each([
  ["settings-work", "Зберегти"],
  ["settings-energy", "Зберегти"],
  ["settings-notifications", "Зберегти"],
  ["settings-telegram", "Відключити Telegram"],
  ["settings-calendar", "Синхронізувати зараз"],
  ["settings-adaptation", "Прийняти зміну"],
  ["settings-pro", "Відновити покупку"],
])("renders %s primary action in the footer", (screenId, actionName) => {
  render(<SettingsScreens screenId={screenId} />);
  expect(within(screen.getByTestId("action-footer")).getByRole("button", { name: actionName })).toBeInTheDocument();
});

it("does not add an action footer to settings home", () => {
  render(<SettingsScreens screenId="settings-home" />);
  expect(screen.queryByTestId("action-footer")).not.toBeInTheDocument();
});

it("uses editable native controls for work and energy settings", () => {
  const work = render(<SettingsScreens screenId="settings-work" />);
  expect(work.getByLabelText("Початок")).toHaveAttribute("type", "time");
  expect(work.getByLabelText("Завершення")).toHaveAttribute("type", "time");
  work.unmount();

  render(<SettingsScreens screenId="settings-energy" />);
  expect(screen.getByLabelText("Пік енергії").tagName).toBe("SELECT");
  expect(screen.getByLabelText("Фокус-блок").tagName).toBe("SELECT");
  expect(screen.getByLabelText("Перерва").tagName).toBe("SELECT");
  expect(screen.getByLabelText("Денний ліміт").tagName).toBe("SELECT");
});
