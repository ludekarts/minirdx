import { useState, useEffect } from "react";
import type { Store, Action } from "./index";

export default function createStoreHooks<
  S,
  A extends Record<string, Action<S>>,
>(store: Store<S, A>) {
  const { state, on, actions } = store;

  function useStore<T = S>(selector?: (state: S) => T): T {
    const [data, setData] = useState(
      typeof selector === "function" ? selector(state()) : state(),
    );

    // Subscribe & unsubscribe to store.
    useEffect(() => {
      const updateSlice = (nextState: S) => {
        const slice =
          typeof selector === "function" ? selector(nextState) : nextState;

        setData((prev) => (Object.is(prev, slice) ? prev : slice));
      };

      return on(updateSlice);
    }, [on, selector]);

    return data as T;
  }

  function useStoreActions(): Store<S, A>["actions"] {
    return actions;
  }

  function useStoreListeners() {
    return on;
  }

  return { useStore, useStoreActions, useStoreListeners };
}
