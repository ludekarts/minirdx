import { createStore } from "../src/minirdx.js";

const { expect } = window.chai;

describe("MiniRDX createStore()", () => {
  it("Should be a function", () => {
    expect(createStore).to.be.a("function");
  });

  it("Should require proper 'config' object", () => {
    expect(() => createStore()).to.throw();
    expect(() => createStore({})).to.throw();
    expect(() => createStore({ actions: {} })).to.not.throw();
  });

  it("Should require proper 'action' format", () => {
    expect(() =>
      createStore({
        actions: {
          INCREMENT: "INC",
        },
      })
    ).to.throw();

    expect(() =>
      createStore({
        actions: [],
      })
    ).to.throw();

    expect(() =>
      createStore({
        actions: {
          INCREMENT: () => {},
        },
      })
    ).to.not.throw();
  });

  it("Should create valid Store object", () => {
    const store = createStore({
      actions: {},
    });

    expect(store).to.have.property("middleware");
    expect(store).to.have.property("subscribe");
    expect(store).to.have.property("getState");
    expect(store).to.have.property("extend");
    expect(store).to.have.property("dispatch");

    expect(store.middleware).to.be.a("function");
    expect(store.subscribe).to.be.a("function");
    expect(store.getState).to.be.a("function");
    expect(store.extend).to.be.a("function");
    expect(store.dispatch).to.be.a("function");
    expect(store.dispatch.batch).to.be.a("function");
  });

  it("Should create initial state", () => {
    const store = createStore({
      actions: {},
      state: {
        counter: 0,
        message: "hello",
      },
    });

    const state = store.getState();
    expect(state).to.have.property("counter");
    expect(state).to.have.property("message");
    expect(state.counter).to.equal(0);
    expect(state.message).to.equal("hello");
  });
});

describe("MiniRDX dispatch()", () => {
  it("Should dispatch INCREMENT action w/ given payload", () => {
    const store = createStore({
      actions: {
        INCREMENT(state, payload) {
          return {
            ...state,
            counter: state.counter + payload,
          };
        },
      },
      state: {
        counter: 0,
      },
    });

    store.dispatch("INCREMENT", 1);
    expect(store.getState().counter).to.equal(1);

    store.dispatch("INCREMENT", 2);
    expect(store.getState().counter).to.equal(3);
  });

  it("Should dispatch INCREMENT action w/ any number of payload args", () => {
    const actionSpy = chai.spy();
    const store = createStore({
      actions: {
        INCREMENT: (state, ...payload) => {
          actionSpy(...payload);
          return state;
        },
      },
      state: {
        counter: 0,
      },
    });

    store.dispatch("INCREMENT", 1);
    expect(actionSpy).to.have.been.called.with(1);

    store.dispatch("INCREMENT", 2, 3);
    expect(actionSpy).to.have.been.called.with(2, 3);

    store.dispatch("INCREMENT", 4, 5, "VI");
    expect(actionSpy).to.have.been.called.with(4, 5, "VI");
  });

  it("Should dispatch BATCH INCREMENT action w/ given payload", () => {
    const store = createStore({
      actions: {
        INCREMENT(state, payload) {
          return {
            ...state,
            counter: state.counter + payload,
          };
        },
      },
      state: {
        counter: 0,
      },
    });

    store.dispatch.batch(["INCREMENT", 1], ["INCREMENT", 2], ["INCREMENT", 3]);
    expect(store.getState().counter).to.equal(6);
  });
});

describe("MiniRDX subscribe()", () => {
  it("Should subscribe to store ", () => {
    const store = createStore({
      actions: {
        INCREMENT(state) {
          return state;
        },
      },
      state: {
        counter: 0,
      },
    });

    const initState = store.getState();
    const storeSpy = chai.spy((state, action) => {
      expect(state).to.equal(initState);
      expect(action.type).to.equal("INCREMENT");
      expect(action.payload).to.be.undefined;
    });

    store.subscribe(storeSpy);

    store.dispatch("INCREMENT");

    expect(storeSpy).to.have.been.called.once;
  });

  it("Should subscribe to given action in store ", () => {
    const store = createStore({
      actions: {
        INCREMENT(state) {
          return state;
        },
        DECREMENT(state) {
          return state;
        },
      },
      state: {
        counter: 0,
      },
    });

    const initState = store.getState();
    const storeSpy = chai.spy();
    const storeIncSpy = chai.spy((state, action) => {
      expect(state).to.equal(initState);
      expect(action.type).to.equal("INCREMENT");
      expect(action.payload).to.be.undefined;
    });

    store.subscribe("INCREMENT", storeIncSpy);
    store.subscribe(storeSpy);
    store.dispatch("INCREMENT");
    store.dispatch("DECREMENT");

    expect(storeIncSpy).to.have.been.called.once;
    expect(storeSpy).to.have.been.called.twice;
  });
});

describe("MiniRDX extend()", () => {
  it("Shoudld extend store w/ new state and actions", () => {
    const store = createStore({
      actions: {},
      state: {
        counter: 0,
      },
    });

    store.extend("extended", {
      state: {
        isExtended: true,
      },
      actions: {
        TOGGLE(state) {
          return {
            ...state,
            isExtended: !state.isExtended,
          };
        },
      },
    });

    store.dispatch("TOGGLE");

    const state = store.getState();
    expect(state).to.have.property("counter");
    expect(state).to.have.property("extended");
    expect(state.extended).to.have.property("isExtended");
    expect(state.extended.isExtended).to.equal(false);
  });

  it("Shoudld extend nested store props", () => {
    const store = createStore({
      actions: {},
      state: {
        counter: 0,
        extended: {
          deep: {
            isExtended: true,
          },
        },
      },
    });

    store.extend("extended.deep.value", {
      state: "🔌",
      actions: {
        TOGGLE_PLUG(state) {
          return state === "🔌" ? "🔋" : "🔌";
        },
      },
    });

    const state = store.getState();
    expect(state).to.have.property("counter");
    expect(state).to.have.property("extended");
    expect(state.extended).to.have.property("deep");
    expect(state.extended.deep).to.have.property("value");
    expect(state.extended.deep).to.have.property("isExtended");
    expect(state.extended.deep.value).to.equal("🔌");

    store.dispatch("TOGGLE_PLUG");
    expect(store.getState().extended.deep.value).to.equal("🔋");
  });

  it("Shoudld extend global state w/ more actions", () => {
    const store = createStore({
      actions: {},
      state: {
        counter: 0,
      },
    });

    expect(store.getState()).to.have.property("counter");

    store.extend({
      state: {
        extended: true,
      },
      actions: {
        UPDATE_AND_EXTEND() {
          return {
            counter: 10,
            extended: true,
          };
        },
      },
    });

    // Extend extended state should not override/add new values to global state.
    expect(store.getState()).to.not.have.property("extended");

    store.dispatch("UPDATE_AND_EXTEND");

    expect(store.getState().counter).to.equal(10);
    expect(store.getState().extended).to.equal(true);
  });
});

describe("MiniRDX middleware()", () => {
  it("Should apply middleware ", () => {
    const store = createStore({
      actions: {
        INCREMENT(state) {
          return {
            ...state,
            counter: state.counter + 1,
          };
        },
        DECREMENT(state) {
          return {
            ...state,
            counter: state.counter - 1,
          };
        },
      },
      state: {
        counter: 0,
      },
    });

    const middlewareSpy = chai.spy(
      ({ state, actionName, globalState, payload }) => {
        expect(payload).to.be.undefined;
        expect(actionName).to.equal("DECREMENT");
        // Assert globalState is Global not Local.
        expect(globalState).to.have.property("counter");
        // Global State contains values from after action's update.
        expect(globalState.counter).to.equal(2);
        // Local State contains value from after action's update.
        expect(state).to.equal(2);
      }
    );

    store.middleware("DECREMENT", "counter", middlewareSpy);

    store.dispatch("INCREMENT");
    store.dispatch("INCREMENT");
    store.dispatch("INCREMENT");
    store.dispatch("DECREMENT");
    expect(middlewareSpy).to.have.been.called.once;
  });

  it("Should modify state w/ ASYNC middleware", () => {
    const store = createStore({
      actions: {
        INCREMENT(state) {
          return {
            ...state,
            counter: state.counter + 1,
          };
        },
        DECREMENT(state) {
          return {
            ...state,
            counter: state.counter - 1,
          };
        },
      },
      state: {
        counter: 0,
      },
    });

    const storeSpy = chai.spy();

    store.middleware("DECREMENT", "counter", () => Promise.resolve(0));

    store.subscribe(storeSpy);

    store.subscribe("DECREMENT", (state) => {
      // Run expect after async middleware resolves last action.
      expect(state.counter).to.equal(0);
      expect(storeSpy).to.have.been.called.exactly(4);
    });

    store.dispatch("INCREMENT");
    store.dispatch("INCREMENT");
    store.dispatch("INCREMENT");
    store.dispatch("DECREMENT");
  });

  it("Should modify state w/ SYNC middleware", () => {
    const store = createStore({
      actions: {
        INCREMENT(state) {
          return {
            ...state,
            counter: state.counter + 1,
          };
        },
        DECREMENT(state) {
          return {
            ...state,
            counter: state.counter - 1,
          };
        },
      },
      state: {
        counter: 0,
      },
    });

    const storeSpy = chai.spy();
    store.middleware("DECREMENT", "counter", () => 0);

    store.subscribe(storeSpy);

    store.subscribe("DECREMENT", (state) => {
      // Run expect after async middleware resolves last action.
      expect(state.counter).to.equal(0);
      expect(storeSpy).to.have.been.called.exactly(4);
    });

    store.dispatch("INCREMENT");
    store.dispatch("INCREMENT");
    store.dispatch("INCREMENT");
    store.dispatch("DECREMENT");
  });

  it("Should modify EXTENDED state w/ middleware", () => {
    const store = createStore({
      actions: {},
      state: {
        counter: 0,
        extended: {
          deep: {
            isExtended: true,
          },
        },
      },
    });

    store.extend("extended.deep.value", {
      state: "🔌",
      actions: {
        LOLLIPOP(state) {
          return state === "🔌" ? "🔋" : "🔌";
        },
      },
    });

    store.middleware("LOLLIPOP", "extended.deep.value", () => "🍭");

    store.subscribe("LOLLIPOP", (state) => {
      expect(state.extended.deep).to.have.property("value");
      expect(state.extended.deep.value).to.equal("🍭");
    });

    store.dispatch("LOLLIPOP");
  });

  it("Should modify EXTENDED state w/ ASYNC middleware on BATCH update", () => {
    const store = createStore({
      actions: {},
      state: {
        counter: 0,
        extended: {
          deep: {
            isExtended: true,
          },
        },
      },
    });

    store.extend("extended.deep.counter", {
      state: 0,
      actions: {
        INCREMENT(state) {
          return state + 1;
        },
      },
    });

    store.middleware("CHARGE", "extended.deep.counter", ({ state }) =>
      Promise.resolve(state + 100)
    );

    const incMiddlewareSpy = chai.spy();

    store.middleware("INCREMENT", "extended.deep.counter", ({ state }) => {
      incMiddlewareSpy();
      return Promise.resolve(state);
    });

    const state = store.getState();
    expect(state.extended.deep).to.have.property("counter");
    expect(state.extended.deep.counter).to.equal(0);

    const storeActionSpy = chai.spy();

    store.subscribe("INCREMENT", storeActionSpy);
    store.subscribe("CHARGE", storeActionSpy);
    store.subscribe("DONE", () => {
      storeActionSpy();
      // ⚠️ Batch updates will not agregate calls for middlewares asociated w/ duplicated actions.
      expect(incMiddlewareSpy).to.have.been.called.exactly(3);
      // ⚠️ Batch updates will agregate calls for duplicated actions.
      expect(storeActionSpy).to.have.been.called.exactly(3);
    });

    store.dispatch.batch(
      ["INCREMENT"],
      ["INCREMENT"],
      ["CHARGE"],
      ["INCREMENT"],
      ["DONE"]
    );
  });
});
