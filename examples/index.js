import "../dist/minirdx.umd.js";

const { createStore, selector, link } = MiniRdx;

const emojiStore = createStore({
  state: {
    emoji: "🤯",
  },

  actions: {
    randomEmoji: (state) => {
      const emojis = ["🤯", "🤩", "🎉", "⚡", "🏝️", "👍"];
      const emoji = emojis[Math.floor(Math.random() * emojis.length)];
      return { ...state(), emoji };
    },
  },
});

const userStore = createStore({
  state: {
    name: "John Doe",
    age: 30,
  },

  actions: {
    updateName: (state, name) => {
      return { ...state(), name };
    },

    updateAge: (state, age) => {
      return { ...state(), age };
    },
  },
});

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
    emoji: link(emojiStore, (es) => es.emoji),
    user: link(userStore, emojiStore, (us, es) => `[${es.emoji}]: ${us.name}!`),
  },

  actions: {
    increment: (state, count) => {
      console.log("Incrementing by", count);
      return { ...state(), counter: state().counter + count };
    },

    decrement: (state, count) => {
      return { ...state(), counter: state().counter - count };
    },

    reset: (state) => {
      return { ...state(), counter: 0 };
    },

    toggleLoader: (state) => {
      return { ...state(), showLoader: !state().showLoader };
    },

    asyncIncrement: async (state) => {
      const amount = await getRandomAmout(2000);
      console.log("async inc by", amount);
      return { ...state(), counter: counterStore.state().counter + amount };
    },

    asyncDecrement: (state) => {
      return Promise.resolve({ ...state(), counter: state().counter - 5 });
    },

    deepUpdate: selector("state.deep.nested.value", (value, emoji) => {
      return value === "🤯" ? emoji : "🤯";
    }),

    deepUpdateAsync: selector(
      "state.deep.nested.value",
      async (value, emoji) => {
        console.log("Waiting");
        await wait(2000);
        return "🎁";
        // return value === "🤯" ? emoji : "🤯";
      }
    ),
  },
});

// ---- Usage ------------------

const counter = document.getElementById("counter");
const buttons = document.getElementById("buttons");

buttons.addEventListener("click", async (event) => {
  switch (event.target.dataset.action) {
    case "inc":
      const x = counterStore.increment(1);
      return console.log(x);
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
    case "updateEmoji":
      console.log(await emojiStore.randomEmoji());
      return;
    case "updateUsername":
      await userStore.updateName("Joe Black");
      return;

    case "show":
      return console.log(counterStore.state());
  }
});

const cancelGlobalSub = counterStore.on((state, actionName) => {
  console.log(`State ${actionName}:`, state);
  counter.innerHTML = `${state.counter} | ${state.user}`;
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

function getRandomAmout(delay = 1000) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(Math.floor(Math.random() * 10));
    }, delay);
  });
}

function wait(time) {
  return new Promise((resolve) => {
    setTimeout(resolve, time);
  });
}
