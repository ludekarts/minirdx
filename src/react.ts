import { useState, useEffect } from "react";

export default function createStoreHook(store: any) {
  return function useStore(selector?: any) {
    const { state, on, ...actions } = store;
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
  };
}
