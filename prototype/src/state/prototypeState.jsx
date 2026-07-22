import { createContext, useContext, useMemo, useState } from "react";
import { DEFAULT_ROUTE } from "../navigation/routes";
import { DEMO_DRAFTS, DEMO_IDEAS } from "../data/demoData";

const PrototypeContext = createContext(null);

const INITIAL_STATE = {
  onboardingStep: 0,
  focusMode: false,
  completedTaskIds: [],
  notifications: true,
  quietHours: "21:00–08:00",
  pro: false,
  selectedNodeId: null,
  plannedTasks: null,
  pendingPlanTasks: null,
  lastBrainDump: "",
  planApplied: false,
  inboxDrafts: DEMO_DRAFTS,
  inboxIdeas: DEMO_IDEAS,
  activeDraftId: null,
};

const FALLBACK_CONTEXT = {
  route: DEFAULT_ROUTE,
  state: INITIAL_STATE,
  history: [],
  navigate: () => {},
  updateState: () => {},
  undo: () => {},
};

export function PrototypeProvider({ children, initialRoute = DEFAULT_ROUTE }) {
  const [route, setRoute] = useState(initialRoute);
  const [state, setState] = useState(INITIAL_STATE);
  const [history, setHistory] = useState([]);

  const value = useMemo(() => ({
    route,
    state,
    history,
    navigate(nextRoute) {
      setRoute(nextRoute);
    },
    updateState(patch) {
      setHistory((items) => [...items, state]);
      setState((current) => ({ ...current, ...patch }));
    },
    undo() {
      setHistory((items) => {
        if (!items.length) return items;
        setState(items.at(-1));
        return items.slice(0, -1);
      });
    },
  }), [history, route, state]);

  return <PrototypeContext.Provider value={value}>{children}</PrototypeContext.Provider>;
}

export function usePrototype() {
  const value = useContext(PrototypeContext);
  return value ?? FALLBACK_CONTEXT;
}
