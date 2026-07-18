import React from "react";
import { DEFAULT_ROUTE } from "./navigation/routes";
import { ScreenCatalog } from "./screens/ScreenCatalog";
import { ScreenRouter } from "./screens/ScreenRouter";
import { PrototypeProvider, usePrototype } from "./state/prototypeState";
import { createAuthStore, createPocketBaseClient, useAuthState } from "./auth/authStore";
import { startGoogleLogin } from "./auth/pocketBaseOAuth";
import { isQaEnvironment, resolveInternalRoute, resolveProductionRoute } from "./navigation/routeAccess";

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

function ProductionExperience() {
  const [pocketBase] = React.useState(() => createPocketBaseClient());
  const [authStore] = React.useState(() => createAuthStore(pocketBase));
  const auth = useAuthState(authStore);
  const resolvedRoute = resolveProductionRoute({ pathname: window.location.pathname, auth });
  const [route, setRoute] = React.useState(resolvedRoute);
  React.useEffect(() => setRoute(resolvedRoute), [resolvedRoute]);
  const navigate = (nextRoute) => setRoute(resolveInternalRoute({ route: nextRoute }));
  return <main className="mobile-prototype" data-testid="mobile-prototype">
    <ScreenRouter route={route} onNavigate={navigate} pocketBase={pocketBase} onGoogleLogin={() => startGoogleLogin()} />
  </main>;
}

export function App() {
  const params = new URLSearchParams(window.location.search);
  if (!isQaEnvironment()) return <ProductionExperience />;
  return <PrototypeProvider initialRoute={params.get("screen") ?? DEFAULT_ROUTE}><PrototypeExperience initialCatalog={params.get("catalog") === "1"} /></PrototypeProvider>;
}
