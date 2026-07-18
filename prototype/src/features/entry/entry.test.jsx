import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { EntryCarousel } from "./EntryCarousel";

it("starts on Chaos to Plan and advances after manual interaction", async () => {
  const user = userEvent.setup();
  render(<EntryCarousel reducedMotion />);

  expect(screen.getByRole("heading", { name: "Вислови все, що в голові. Отримай реалістичний план." })).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Наступний слайд" }));

  expect(screen.getByText("Не тримай усе в голові.")).toBeInTheDocument();
});
