import { render } from "@testing-library/react";
import { expect, it } from "vitest";
import { SCREEN_REGISTRY } from "./screenRegistry";
import { ScreenRouter } from "./ScreenRouter";

it("renders every registered prototype state without crashing", () => {
  for (const screen of SCREEN_REGISTRY) {
    const view = render(<ScreenRouter route={screen.id} onNavigate={() => {}} />);
    expect(view.container.firstChild, screen.id).toBeTruthy();
    view.unmount();
  }
});
