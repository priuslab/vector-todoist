import React from "react";
import { DEFAULT_ROUTE } from "./navigation/routes";
import { ScreenCatalog } from "./screens/ScreenCatalog";
import { ScreenRouter } from "./screens/ScreenRouter";
import { PrototypeProvider, usePrototype } from "./state/prototypeState";
import { createAuthStore, createPocketBaseClient, useAuthState } from "./auth/authStore";
import { startGoogleLogin } from "./auth/pocketBaseOAuth";
import { isQaEnvironment, resolveInternalRoute, resolveProductionRoute } from "./navigation/routeAccess";
import { AuthStateScreen } from "./features/entry/AuthStateScreen";
import { createApiClient } from "./lib/apiClient";

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

export function ProductionExperience({ env = import.meta.env, pocketBase: providedPocketBase }) {
  const [connection] = React.useState(() => {
    try {
      const pocketBase = providedPocketBase ?? createPocketBaseClient({ env });
      return { pocketBase, authStore: createAuthStore(pocketBase) };
    } catch {
      return { error: true };
    }
  });
  if (connection.error) return <main className="mobile-prototype" data-testid="mobile-prototype"><AuthStateScreen state="configuration" /></main>;
  const { pocketBase, authStore } = connection;
  const auth = useAuthState(authStore);
  const apiClient = React.useMemo(() => env.VITE_GATEWAY_URL ? createApiClient({
    baseUrl: env.VITE_GATEWAY_URL,
    getToken: () => authStore.getToken(),
    refreshToken: () => authStore.refreshToken(),
    onAuthExpired: () => authStore.markExpired(),
  }) : null, [authStore, env.VITE_GATEWAY_URL]);
  const [pathname, setPathname] = React.useState(() => window.location.pathname);
  const resolvedRoute = resolveProductionRoute({ pathname, auth, env });
  const [route, setRoute] = React.useState(resolvedRoute);
  React.useEffect(() => setRoute(resolvedRoute), [resolvedRoute]);
  const navigate = (nextRoute) => setRoute(resolveInternalRoute({ route: nextRoute, env }));
  const completeAuth = React.useCallback(() => {
    window.history.replaceState({}, "", "/");
    setPathname("/");
  }, []);
  return <main className="mobile-prototype" data-testid="mobile-prototype">
    <ScreenRouter route={route} onNavigate={navigate} onAuthComplete={completeAuth} pocketBase={pocketBase} apiClient={apiClient} onGoogleLogin={() => startGoogleLogin({ clientId: env.VITE_GOOGLE_CLIENT_ID })} />
  </main>;
}

export function App({ env = import.meta.env, pocketBase } = {}) {
  const params = new URLSearchParams(window.location.search);
  if (!isQaEnvironment(env)) return <ProductionExperience env={env} pocketBase={pocketBase} />;
  return <PrototypeProvider initialRoute={params.get("screen") ?? DEFAULT_ROUTE}><PrototypeExperience initialCatalog={params.get("catalog") === "1"} /></PrototypeProvider>;
}
