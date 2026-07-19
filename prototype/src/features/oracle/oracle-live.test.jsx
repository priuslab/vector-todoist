import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { OracleScreens } from "./OracleScreens";

const graph = {
  nodes: [
    { id: "g1", type: "goal", title: "Мета Олени" },
    { id: "i1", type: "idea", title: "Ідея епізоду" },
    { id: "t1", type: "task", title: "Наступний крок" },
    { id: "c1", type: "completed", title: "Виконано", completed: true },
  ],
  edges: [{ id: "e1", fromId: "i1", toId: "g1", status: "confirmed" }],
};

it("loads live graph, filters nodes, selects an idea and loads its path", async () => {
  const apiClient = { request: vi.fn(async (path) => path.startsWith("/api/v1/oracle/path") ? { found: true, nodeIds: ["i1", "g1"], edgeIds: ["e1"], score: .85, explanation: "Є короткий шлях до мети." } : graph) };
  const user = userEvent.setup();
  render(<OracleScreens apiClient={apiClient} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Ідея епізоду" })).toBeInTheDocument());
  await user.click(screen.getByRole("button", { name: "Фільтри" }));
  await user.click(screen.getByRole("button", { name: "Ідеї" }));
  await user.click(screen.getByRole("button", { name: "Показати карту" }));
  expect(screen.getByRole("button", { name: "Ідея епізоду" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Наступний крок" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Ідея епізоду" }));
  await waitFor(() => expect(apiClient.request).toHaveBeenCalledWith(expect.stringContaining("/api/v1/oracle/path")));
  expect(screen.getByText("Є короткий шлях до мети.")).toBeInTheDocument();
});

it("provides keyboard list alternative and reset viewport control", async () => {
  const user = userEvent.setup();
  render(<OracleScreens />);
  await user.click(screen.getByRole("button", { name: "Списком" }));
  expect(screen.getByRole("heading", { name: "Вузли карти" })).toBeInTheDocument();
  expect(screen.getByRole("list", { name: "Список вузлів Oracle" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Скинути карту" })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Зробити епізод про синдром самозванця" }));
  expect(screen.getByTestId("oracle-graph")).toHaveAttribute("data-selection", "idea-impostor");
});

it("renders loading and error states without a page overflow dependency", async () => {
  const deferred = new Promise(() => {});
  const { rerender } = render(<OracleScreens apiClient={{ request: () => deferred }} />);
  expect(screen.getByTestId("oracle-graph-loading")).toBeInTheDocument();
  rerender(<OracleScreens apiClient={{ request: vi.fn().mockRejectedValue(new Error("offline")) }} />);
  await waitFor(() => expect(screen.getByTestId("oracle-graph-error")).toBeInTheDocument());
});
