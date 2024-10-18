import "../../dist/minirdx.umd.js";

const { createStore } = MiniRdx;

// New API Design:

const counterStore = createStore({
  state: {
    counter: 0,
    showLoader: false,
  },

  increment: (state, payload) => {
    return { ...state, counter: state.counter + payload };
  },

  decrement: (state, payload) => {
    return { ...state, counter: state.counter - payload };
  },

  reset: (state) => {
    return { ...state, counter: 0 };
  },

  toggleLoader: (state) => {
    return { ...state, showLoader: !state.showLoader };
  },

  asyncUpdate: async (state) => {
    const amount = await getRandomAmout();
    return { ...state, counter: state.counter + amount };
  },
});

// ---- Usage ------------------

const cancelGlobalSub = counterStore.on((state) =>
  console.log("State updated:", state)
);

const cancelIncSub = counterStore.on(
  "increment",
  (state) => state.counter,
  (counter) => console.log("⬆️", counter)
);

const cancelDecSub = counterStore.on(
  "decrement",
  (state) => state.counter,
  (counter) => console.log("⬇️", counter)
);

const cancelIncTap = counterStore.tap(
  "increment",
  "tapped",
  ({ state, slice, payload }) => {
    return state.counter > 5;
  }
);

(async function App() {
  counterStore.increment(1);
  counterStore.increment(1);
  counterStore.increment(3);
  counterStore.decrement(1);

  // This would be a nice way to handle async actions.
  // THe async action should return a promise thate resolves when the action is done.
  counterStore.toggleLoader();
  await counterStore.asyncUpdate();
  counterStore.toggleLoader();
})();

/*

TO CONSIDER:

counterStore.extend({
  store: "emoji",
  state: {
    emoji: "😀",
    some: {
      deep: {
        value: "🤯",
      },
    },
  },

  setEmoji: (state, payload) => {
    return { ...state, emoji: payload };
  },

  setDeepEmoji: (state) => state,
});

counterStore.tap("setDeepEmoji", "emoji.some.deep.value", async () => {
  const amount = await getRandomAmout();
  return amount + "👾";
});

counterStore.subscribe("setEmoji", (state) =>
  console.log("Emoji updated:", state)
);

counterStore.setEmoji("🎉");
counterStore.setDeepEmoji();
*/

// ---- Helpers ----------------

function getRandomAmout() {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(Math.floor(Math.random() * 10));
    }, 1000);
  });
}
