import { createStore } from "../../src/minirdx.js";

const display = document.getElementById("display");
const incBtn = document.getElementById("incBtn");
const decBtn = document.getElementById("decBtn");
const setBtn = document.getElementById("setBtn");
const resetBtn = document.getElementById("resetBtn");
const toggleBtn = document.getElementById("toggleBtn");

const store = startApp();

incBtn.onclick = () => store.dispatch("INCREMENT");
decBtn.onclick = () => store.dispatch("DECREMENT");
resetBtn.onclick = () => store.dispatch("RESET");
toggleBtn.onclick = () => store.dispatch("TOGGLE_EMOJI", "🚀");
setBtn.onclick = () => store.dispatch("SET_EMOJI", "😀");
batchBtn.onclick = () =>
  store.dispatch.batch(["INCREMENT"], ["INCREMENT"], ["INCREMENT"]);

store.subscribe((state) => {
  display.innerHTML = state.emoji.show
    ? `${state.emoji.value} | ${state.counter}`
    : state.counter;
});

store.subscribe("TOGGLE_EMOJI", (state) =>
  console.log("Emoji toggled", state.emoji.show)
);

store.subscribe("INCREMENT", (state) => console.log("⬆️"));
store.subscribe("DECREMENT", (state) => console.log("⬇️"));

const overrideEmoji = ({ state, actionName, globalState, payload }) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log(`Middleware: ${actionName}`, state, globalState, payload);
      resolve("👾");
    }, 300);
  });
};

store.middleware("TOGGLE_EMOJI", "emoji.value", overrideEmoji);

// ---- APP CORE ----------------

function startApp() {
  const store = createStore({
    state: {
      counter: 0,
    },

    actions: {
      INCREMENT: (state) => {
        return { ...state, counter: state.counter + 1 };
      },

      DECREMENT: (state) => {
        return { ...state, counter: state.counter - 1 };
      },

      RESET: (state) => {
        return { ...state, counter: 0 };
      },
    },
  });

  // Extend 🔌

  store.extend("emoji", {
    state: {
      value: "😀",
      show: false,
    },

    actions: {
      TOGGLE_EMOJI: (state) => {
        return {
          ...state,
          show: !state.show,
        };
      },
      SET_EMOJI: (state, value) => {
        return {
          ...state,
          value,
        };
      },
    },
  });

  return store;
}
