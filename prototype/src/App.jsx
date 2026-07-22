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

function requestedDraftRoute() {
  const params = new URLSearchParams(window.location.search);
  const draft = params.get("draft");
  return params.get("screen") === "draft-plan-review" && draft ? { route: "draft-plan-review", draft } : { route: null, draft: null };
}

function persistRoute(nextRoute, draft) {
  const params = new URLSearchParams({ screen: nextRoute });
  if (nextRoute === "draft-plan-review" && draft) params.set("draft", draft);
  window.history.replaceState({}, "", `?${params.toString()}`);
}

function PrototypeExperience({ initialCatalog = false }) {
  const { route, navigate } = usePrototype();
  const [catalog, setCatalog] = React.useState(initialCatalog);
  const [draftId, setDraftId] = React.useState(() => requestedDraftRoute().draft);
  const go = (nextRoute, options = {}) => {
    const nextDraft = nextRoute === "draft-plan-review" ? options.draft ?? draftId : null;
    navigate(nextRoute);
    setDraftId(nextDraft);
    setCatalog(false);
    persistRoute(nextRoute, nextDraft);
  };
  return (
    <main className="mobile-prototype" data-testid="mobile-prototype">
      {catalog ? <ScreenCatalog onOpen={go} /> : <ScreenRouter route={route} draftId={draftId} onNavigate={go} />}
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
  const routeFromLocation = React.useCallback(() => {
    const requested = requestedDraftRoute();
    return auth.status === "authenticated" && requested.route ? requested.route : resolvedRoute;
  }, [auth.status, resolvedRoute]);
  const [route, setRoute] = React.useState(routeFromLocation);
  const [draftId, setDraftId] = React.useState(() => requestedDraftRoute().draft);
  React.useEffect(() => {
    setRoute(routeFromLocation());
    setDraftId(requestedDraftRoute().draft);
  }, [routeFromLocation]);
  const navigate = (nextRoute, options = {}) => {
    const allowedRoute = resolveInternalRoute({ route: nextRoute, env });
    const nextDraft = allowedRoute === "draft-plan-review" ? options.draft ?? draftId : null;
    setRoute(allowedRoute);
    setDraftId(nextDraft);
    persistRoute(allowedRoute, nextDraft);
  };
  const completeAuth = React.useCallback(() => {
    window.history.replaceState({}, "", "/");
    setPathname("/");
  }, []);
  return <main className="mobile-prototype" data-testid="mobile-prototype">
    <ScreenRouter route={route} draftId={draftId} onNavigate={navigate} onAuthComplete={completeAuth} pocketBase={pocketBase} apiClient={apiClient} onGoogleLogin={() => startGoogleLogin({ clientId: env.VITE_GOOGLE_CLIENT_ID })} />
  </main>;
}

export function App({ env = import.meta.env, pocketBase } = {}) {
  const params = new URLSearchParams(window.location.search);
  if (!isQaEnvironment(env)) return <ProductionExperience env={env} pocketBase={pocketBase} />;
  return <PrototypeProvider initialRoute={params.get("screen") ?? DEFAULT_ROUTE}><PrototypeExperience initialCatalog={params.get("catalog") === "1"} /></PrototypeProvider>;
}
