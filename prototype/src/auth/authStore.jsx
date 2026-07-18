import { useSyncExternalStore } from "react";
import PocketBase from "pocketbase";

export function createPocketBaseClient(url = import.meta.env.VITE_POCKETBASE_URL) {
  return new PocketBase(url || "http://127.0.0.1:8090");
}

export function createAuthStore(pb) {
  let expired = false;
  const state = () => {
    if (expired) return { status: "expired", record: null };
    return (pb.authStore.isValid ?? Boolean(pb.authStore.token)) && pb.authStore.record
      ? { status: "authenticated", record: pb.authStore.record }
      : { status: "anonymous", record: null };
  };
  let snapshot = { status: "loading", record: null };

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      return pb.authStore.onChange((_token, record) => {
        if (record) expired = false;
        snapshot = state();
        listener();
      }, true);
    },
    markExpired() {
      expired = true;
      snapshot = state();
      pb.authStore.clear();
    },
    getToken() { return pb.authStore.token; },
    async refreshToken() {
      try {
        const result = await pb.collection("users").authRefresh();
        return result?.token ?? pb.authStore.token ?? null;
      } catch {
        this.markExpired();
        return null;
      }
    },
  };
}

export function useAuthState(store) {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
