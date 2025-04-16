import { useState, useEffect } from "react";
import type { Store, Action } from "./index";

export default function createStoreHooks<
  S,
  A extends Record<string, Action<S>>
>(store: Store<S, A>) {
  const { state, on, actions } = store;

  function useStore<T = S>(
    selector?: (state: S) => T
  ): [T, Store<S, A>["actions"]] {
    const [data, setData] = useState(
      typeof selector === "function" ? selector(state()) : state()
    );

    const updateSlice = (state: S) => {
      const slice = typeof selector === "function" ? selector(state) : state;
      slice !== data && setData(slice);
    };

    // Subscribe & unsubscribe to store.
    useEffect(() => on(updateSlice), [data]);

    return [data as T, actions];
  }

  function useStoreActions(): Store<S, A>["actions"] {
    return actions;
  }

  function useStoreListeners() {
    return on;
  }

  return { useStore, useStoreActions, useStoreListeners };
}
