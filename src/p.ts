type Action<S> = (state: S, ...args: any[]) => S;
type OmitFirstParam<T extends (...args: any[]) => any> = T extends (
  state: any,
  ...args: infer P
) => any
  ? P
  : never;

function createStore<S, A extends Record<string, Action<S>>>(config: {
  state: S;
  actions: A;
}) {
  let { state, actions } = config;

  const apiActions = Object.fromEntries(
    Object.entries(actions).map(([key, action]) => {
      return [
        key,
        async (...args: OmitFirstParam<typeof action>) => {
          state = action(state, ...args);
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
  },
});

store.getState().count;
store.hello("world"); // TypeScript correctly infers this
store.increment(1); // TypeScript correctly infers this

// store.decrement(3);
// store.hello("Hello, World!");
// store.hello("Hello, World!");
// store.decrement(2);

// store.getState().text;

// store.hello("Hello, World!");

// store.on("hello", (state, action) => {
//   console.log(`Hello action: "${action}" was called with text: ${state.text}`);
// });
