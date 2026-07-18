import { createContext, useContext, useMemo, useState } from "react";
import { DEFAULT_ROUTE } from "../navigation/routes";

const PrototypeContext = createContext(null);

const INITIAL_STATE = {
  onboardingStep: 0,
  focusMode: false,
  completedTaskIds: [],
  notifications: true,
  quietHours: "21:00–08:00",
  pro: false,
  selectedNodeId: null,
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
  if (!value) throw new Error("usePrototype must be used inside PrototypeProvider");
  return value;
}
