import { useState, useEffect } from "react";

export default function createStoreHooks(store: any) {
  const { state, on, actions } = store;

  function useStore(selector?: any) {
    const [data, setData] = useState(
      typeof selector === "function" ? selector(state()) : state()
    );

    const updateSlice = (state: any) => {
      const slice = typeof selector === "function" ? selector(state) : state;
      slice !== data && setData(slice);
    };

    // Subscribe & unsubscribe to store.
    useEffect(() => on(updateSlice), [data]);

    return [data, actions];
  }

  function useStoreActions() {
    return actions;
  }

  function useStoreListeners() {
    return on;
  }

  return { useStore, useStoreActions, useStoreListeners };
}
