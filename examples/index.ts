import { createStore, selector } from "../src/index";

const store = createStore({
  state: {
    count: 0,
    text: "",
    deep: {
      nested: {
        value: 0,
      },
    },
  },
  actions: {
    hello(state, text: string) {
      return { ...state, text };
    },

    increment(state, amount: number) {
      return {
        ...state,
        count: state.count + amount,
      };
    },

    async asyncInc(state, amount: number) {
      const square = await Promise.resolve(amount * 2);
      return {
        ...state,
        count: state.count + square,
      };
    },

    decrement: selector(
      "state.count",
      (count: number, amount: number, text: string) => {
        console.log(text);
        return count - amount;
      }
    ),
  },
});

store.getState().count;
store.getState((s) => s.text);
store.decrement(2, "Hello, World!");
store.decrement(2, "Hello, World!");
store.hello("Hello, World!");

store.asyncInc(5);
store.increment(5);

store.getState().text;

store.hello("Hello, World!");

store.on("hello", (state, action) => {
  console.log(`Hello action: "${action}" was called with text: ${state.text}`);
});
