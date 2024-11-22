import "../dist/minirdx.umd.js";

const { createStore, selector } = MiniRdx;

// New API Design:

const counterStore = createStore({
  state: {
    counter: 0,
    showLoader: false,
    deep: {
      nested: {
        value: "🤯",
      },
    },
  },

  increment: (state, count) => {
    console.log("Incrementing by", count);

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

  asyncDecrement: (state) => {
    return Promise.resolve({ ...state, counter: state.counter - 5 });
  },

  deepUpdate: selector("state.deep.nested.value", (value, emoji) => {
    return value === "🤯" ? emoji : "🤯";
  }),

  deepUpdateAsync: selector("state.deep.nested.value", async (value, emoji) => {
    console.log("Waiting");
    await wait(1000);
    return value === "🤯" ? emoji : "🤯";
  }),
});

// ---- Usage ------------------

const counter = document.getElementById("counter");
const buttons = document.getElementById("buttons");

buttons.addEventListener("click", async (event) => {
  switch (event.target.dataset.action) {
    case "inc":
      const x = counterStore.increment(1);
      console.log(x);

      return;
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
    case "deepUpdate":
      return counterStore.deepUpdate("🤩");
    case "deepUpdateAsync":
      console.log("Async Deep start");
      await counterStore.deepUpdateAsync("💥");
      console.log("Async Deep end");
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

const cancelDeepSub = counterStore.on("deepUpdate", (state) =>
  console.log("DEEP", state.deep.nested.value)
);

function getRandomAmout() {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(Math.floor(Math.random() * 10));
    }, 1000);
  });
}

function wait(time) {
  return new Promise((resolve) => {
    setTimeout(resolve, time);
  });
}
