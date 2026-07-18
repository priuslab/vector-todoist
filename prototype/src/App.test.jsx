import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { App } from "./App";

it("renders the approved entry screen and continues into Google auth", async () => {
  const user = userEvent.setup();
  render(<App />);

  expect(screen.getByTestId("mobile-prototype")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Вислови все, що в голові. Отримай реалістичний план." })).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Продовжити з Google" }));

  expect(screen.getByText("Підключаємо Google Calendar…")).toBeInTheDocument();
});

it("opens the complete screen catalog from the URL", () => {
  window.history.pushState({}, "", "/?catalog=1");
  render(<App />);

  expect(screen.getByRole("heading", { name: "Каталог екранів" })).toBeInTheDocument();
  expect(screen.getByText("82 стани · 12 груп")).toBeInTheDocument();
  window.history.pushState({}, "", "/");
});
