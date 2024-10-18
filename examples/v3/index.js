import "../../dist/minirdx.umd.js";

const { createStore } = MiniRdx;

// New API Design:

const counterStore = createStore({
  state: {
    counter: 0,
    showLoader: false,
  },

  increment: (state, count) => {
    return { ...state, counter: state.counter + count };
  },

  decrement: (state, count) => {
    return { ...state, counter: state.counter - count };
  },

  reset: (state) => {
    return { ...state, counter: 0 };
  },

  toggleLoader: (state) => {
    return { ...state, showLoader: !state.showLoader };
  },

  asyncIncrement: async (state) => {
    const amount = await getRandomAmout();
    return { ...state, counter: state.counter + amount };
  },

  asyncDecrement: (state) =>
    Promise.resolve({ ...state, counter: state.counter - 5 }),
});

// ---- Usage ------------------

const counter = document.getElementById("counter");
const buttons = document.getElementById("buttons");

buttons.addEventListener("click", async (event) => {
  switch (event.target.dataset.action) {
    case "inc":
      return counterStore.increment(1);
    case "dec":
      return counterStore.decrement(1);
    case "asyncInc":
      console.log("Async inc start");
      await counterStore.asyncIncrement();
      console.log("Async inc end");
      return;
    case "asyncDec":
      console.log("Async dec start");
      await counterStore.asyncDecrement();
      console.log("Async dec end");
      return;
    case "show":
      return console.log(counterStore.getState());
  }
});

const cancelGlobalSub = counterStore.on((state, actionName) => {
  console.log(`State ${actionName}:`, state);
  counter.innerHTML = state.counter;
});

const cancelIncSub = counterStore.on("increment", (state) =>
  console.log("⬆️", state.counter)
);

const cancelDecSub = counterStore.on("decrement", (state) =>
  console.log("⬇️", state.counter)
);

const cancelIncTap = counterStore.tap(
  "increment",
  "tapped",
  ({ state, slice }) => {
    console.log("Tapped:", slice);
    return state.counter > 3;
  }
);

function getRandomAmout() {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(Math.floor(Math.random() * 10));
    }, 1000);
  });
}

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
