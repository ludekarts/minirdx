import { createStore } from "../dist/minirdx.index.es.js";

const store = createStore({
  state: {
    counter: 0,
  },

  actions: {
    increment(state) {
      return { ...state(), counter: state().counter + 1 };
    },
    decrement(state) {
      return { ...state(), counter: state().counter - 1 };
    },
  },
});

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

inc.onclick = () => store.actions.increment();
dec.onclick = () => store.actions.decrement();

store.on((state) => {
  counter.textContent = state.counter;
});

store.on("increment", (state) => {
  console.log("Counter incremented to", state.counter);
});

store.on("decrement", (state) => {
  console.log("Counter decremented to", state.counter);
});

store.tap("decrement", async (state) => {
  await wait(1000);
  // State powine być funkcją zwracającą aktualny stan, a nie sam stan, ponieważ może być on już zaktualizowany przez inne akcje
  const newState = { ...state(), counter: state().counter - 2 };
  return newState;
});
