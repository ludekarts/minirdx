type Action<S> = (state: S, ...args: any[]) => S;
type Selector<S, T> = (state: S, ...args: any[]) => T;
type HigherOrderAction<S> = Selector<S, any>;
type AnyAction<S> = Action<S> | HigherOrderAction<S>;

type OmitFirstParam<T extends (...args: any[]) => any> = T extends (
  state: any,
  ...args: infer P
) => any
  ? P
  : never;

function selector<S, K extends keyof S>(
  path: K,
  fn: (value: S[K], ...args: any[]) => S[K]
): (state: S, ...args: any[]) => S {
  return (state, ...args) => {
    const newValue = fn(state[path], ...args);
    return { ...state, [path]: newValue };
  };
}

function createStore<S, A extends Record<string, AnyAction<S>>>(config: {
  state: S;
  actions: A;
}) {
  let { state, actions } = config;

  const apiActions = Object.fromEntries(
    Object.entries(actions).map(([key, action]) => {
      return [
        key,
        async (...args: OmitFirstParam<typeof action>) => {
          if (typeof action === "function") {
            state = action(state, ...args);
          }
          return state;
        },
      ];
    })
  ) as {
    [K in keyof A]: (...args: OmitFirstParam<A[K]>) => Promise<S>;
  };

  return {
    getState() {
      return state;
    },
    ...apiActions,
  };
}

// Store configuration
const store = createStore({
  state: {
    count: 0,
    text: "",
  },
  actions: {
    hello(state, text: string) {
      return { ...state, text };
    },

    increment(state, amount: number) {
      return { ...state, count: state.count + amount };
    },

    decrement: selector("count", (count, amount: number) => count - amount),
  },
});

// Example usage
(async () => {
  await store.increment(5);
  console.log(store.getState()); // { count: 5, text: "" }

  await store.decrement(2);
  console.log(store.getState()); // { count: 3, text: "" }

  await store.hello("Hello World");
  console.log(store.getState()); // { count: 3, text: "Hello World" }
})();
