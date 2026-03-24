import { useState, useEffect } from "react";
import type { Store, Action } from "./index";

export default function createStoreHooks<
  S,
  A extends Record<string, Action<S>>,
>(store: Store<S, A>) {
  const { state, on, actions } = store;

  function useStore<T = S>(
    selector?: (state: S) => T,
    equalityFn?: (prev: T, next: T) => boolean,
  ): T {
    const initialData =
      typeof selector === "function"
        ? selector(state())
        : (state() as unknown as T);

    const [data, setData] = useState<T>(initialData);

    // Subscribe & unsubscribe to store.
    useEffect(() => {
      const isEqual =
        typeof equalityFn === "function"
          ? equalityFn
          : (prev: T, next: T) => Object.is(prev, next);

      const updateSlice = (nextState: S) => {
        const slice =
          typeof selector === "function"
            ? selector(nextState)
            : (nextState as unknown as T);

        setData((prev) => (isEqual(prev, slice) ? prev : slice));
      };

      return on(updateSlice);
    }, [on, selector, equalityFn]);

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
