type ActionStore<S> = Record<string, (...args: any[]) => S>;

type ActionWithState<S, A extends Record<string, (...args: any[]) => any>> = {
  [K in keyof A]: (state: S, ...args: Parameters<A[K]>) => ReturnType<A[K]>;
};

type OmitFirstParam<T extends (...args: any[]) => any> = T extends (
  state: any,
  ...args: infer P
) => any
  ? P
  : never;

function createStore<S, A extends ActionStore<S>>(
  config: { state: S } & ActionWithState<S, A>
) {
  let { state, ...actions } = config;
  type Actions = typeof actions;

  const apiActions = Object.entries(actions).reduce((acc, [key, action]) => {
    acc[key as keyof Actions] = (...args) =>
      (action as Function)(state, ...args);
    return acc;
  }, {} as { [K in keyof Actions]: (...args: OmitFirstParam<Actions[K]>) => State });

  return {
    getState() {
      return state;
    },

    on(
      action: keyof Actions,
      callback: (state: S, action: keyof Actions) => void
    ) {
      callback?.(state, action);
    },

    ...apiActions,
  };
}

interface State {
  count: number;
  text: string;
}

type Actions = {
  hello: (text: string) => State;
  increment: (amount: number) => State;
  decrement: (amount: number) => State;
};

const store = createStore<State, Actions>({
  state: {
    count: 0,
    text: "",
  },

  hello(state, text) {
    return { ...state, text };
  },

  increment(state, amount) {
    return {
      ...state,
      count: state.count + amount,
    };
  },

  decrement(state, amount) {
    return {
      ...state,
      count: state.count + amount,
    };
  },
});

store.getState().count;
store.decrement(3);
store.hello("Hello, World!");
store.hello("Hello, World!");
store.decrement(2);

store.getState().text;

store.hello("Hello, World!");

store.on("hello", (state, action) => {
  console.log(`Hello action: "${action}" was called with text: ${state.text}`);
});
