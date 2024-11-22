import { createStore, selector } from "../src/index";

interface State {
  count: number;
  text: string;
  deep: {
    nested: {
      value: number;
    };
  };
}

type Actions = {
  hello: (text: string) => State;
  increment: (amount: number) => State;
  decrement: (amount: number) => State;
  asyncInc: (amount: number) => Promise<State>;
};

type DecrementType = Actions["decrement"];

const store = createStore<State, Actions>({
  state: {
    count: 0,
    text: "",
    deep: {
      nested: {
        value: 0,
      },
    },
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

  async asyncInc(state, amount) {
    const square = await Promise.resolve(amount * 2);
    return {
      ...state,
      count: state.count + square,
    };
  },

  decrement: selector<DecrementType, number>(
    "state.count",
    (count, amount) => count - amount
  ),
});

store.getState().count;
store.getState((s) => s.text);
store.decrement(3);
store.decrement(2);
store.hello("Hello, World!");

store.asyncInc(10);

store.getState().text;

store.hello("Hello, World!");

store.on("hello", (state, action) => {
  console.log(`Hello action: "${action}" was called with text: ${state.text}`);
});
