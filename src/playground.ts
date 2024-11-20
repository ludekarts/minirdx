function createStore<
  S,
  A extends { [key: string]: (state: S, ...args: any[]) => S }
>(config: { state: S } & A) {
  let { state, ...actions } = config;

  type Actions = typeof actions;

  // Utility type to exclude the first parameter
  type ExcludeFirstParameter<T extends (...args: any) => any> = T extends (
    state: any,
    ...args: infer P
  ) => any
    ? P
    : never;

  const ac = Object.entries(actions).reduce((acc, [key, action]) => {
    acc[key as keyof Actions] = (
      ...args: ExcludeFirstParameter<typeof action>
    ) => (action as Function)(state, ...args);
    return acc;
  }, {} as { [K in keyof Actions]: (...args: ExcludeFirstParameter<Actions[K]>) => State });

  return {
    getState() {
      return state;
    },
    ...ac,
  };
}

interface State {
  count: number;
  text: string;
}

type Actions = {
  hello: (s: State, text: string) => State;
  increment: (s: State, amount: number) => State;
  decrement: (s: State, amount: number) => State;
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
store.decrement(1);
store.hello("Hello, World!");
store.decrement(2);

store.getState().text;

store.hello("Hello, World!");
