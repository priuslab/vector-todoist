import React from "react";
import { DEFAULT_ROUTE } from "./navigation/routes";
import { ScreenCatalog } from "./screens/ScreenCatalog";
import { ScreenRouter } from "./screens/ScreenRouter";
import { PrototypeProvider, usePrototype } from "./state/prototypeState";

function PrototypeExperience({ initialCatalog = false }) {
  const { route, navigate } = usePrototype();
  const [catalog, setCatalog] = React.useState(initialCatalog);
  const go = (nextRoute) => {
    navigate(nextRoute);
    setCatalog(false);
    window.history.replaceState({}, "", `?screen=${nextRoute}`);
  };
  return (
    <main className="mobile-prototype" data-testid="mobile-prototype">
      {catalog ? <ScreenCatalog onOpen={go} /> : <ScreenRouter route={route} onNavigate={go} />}
    </main>
  );
}

export function App() {
  const params = new URLSearchParams(window.location.search);
  return <PrototypeProvider initialRoute={params.get("screen") ?? DEFAULT_ROUTE}><PrototypeExperience initialCatalog={params.get("catalog") === "1"} /></PrototypeProvider>;
}
