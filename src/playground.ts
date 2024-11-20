// Basic store action.
type ActionStore<S> = { [key: string]: (state: S, ...args: any[]) => S };

// Action listener callback decelared with "store.on()"" method.
type ActionListener<S, A> = (state: S, actionName: keyof A) => void;

// Internal list of all action listeners.
type ActionListenerColection<S, A> = Map<string, ActionListener<S, A>[]>;

// Generic Promise resolve callback.
type PromiseResolve<T> = (value: T) => void;

// Allow to skip the first parameter of a function.
type OmitFirstParam<T extends (...args: any[]) => any> = T extends (
  state: any,
  ...args: infer P
) => any
  ? P
  : never;

const disallowKeys = ["on", "state", "getState"];

function createStore<S, A extends ActionStore<S>>(config: { state: S } & A) {
  let { state, ...actions } = config;

  type Action = (state: S, ...args: any[]) => S;
  type Actions = typeof actions;

  const globalListeners: ActionListener<S, A>[] = [];
  const actionListeners: ActionListenerColection<S, A> = new Map();

  const apiActions = Object.entries(actions).reduce((acc, [key, action]) => {
    if (disallowKeys.includes(key)) {
      throw new Error(`MiniRdxError: "${key}" is a reserved keyword`);
    }
    acc[key as keyof Actions] = (...args: OmitFirstParam<typeof action>) => {
      return new Promise((resolve) => {
        const action = (state: S) => (action as Function)(state, ...args);
        resolver(key, action, resolve);
      });
    };

    return acc;
  }, {} as { [K in keyof Actions]: (...args: OmitFirstParam<Actions[K]>) => Promise<S> });

  function resolver(
    actionName: string,
    action: Action,
    resolve: PromiseResolve<S>
  ) {
    const newState = action(state);
    isPromise<S>(newState)
      ? newState.then((resolvedState: S) =>
          updateState(resolvedState, actionName, resolve)
        )
      : updateState(newState, actionName, resolve);
  }

  function updateState(
    newState: S,
    actionName: string,
    resolve: PromiseResolve<S>
  ) {
    state = newState;

    // Notify global listeners.
    globalListeners.length &&
      globalListeners.forEach((listener) => listener(state, actionName));

    // Notify action specific listeners.
    actionListeners
      .get(actionName)
      ?.forEach((listener) => listener(state, actionName));

    // Notify on Callback.
    resolve(state);
  }

  return {
    getState<T = S>(selector?: (state: S) => T): T {
      return typeof selector === "function"
        ? selector(state)
        : (state as unknown as T);
    },

    on(
      action: keyof Actions | ActionListener<S, A>,
      listener?: ActionListener<S, A>
    ) {
      // Subscribe to global actions.
      if (typeof action === "function" && listener === undefined) {
        globalListeners.push(action);
        return () => globalListeners.splice(globalListeners.indexOf(action), 1);
      }

      // Subscribe to specific actions.
      else if (typeof action === "string" && listener) {
        if (!actionListeners.has(action)) {
          actionListeners.set(action, []);
        }

        actionListeners.get(action)?.push(listener);
        return () => {
          actionListeners
            .get(action)
            ?.splice(
              actionListeners.get(action)?.indexOf(listener) as number,
              1
            );
        };
      } else {
        throw new Error(
          "MiniRdxError: Invalid arguments. Try: state.on(action: string, listener: ActionListener)"
        );
      }
    },

    ...apiActions,
  };
}

// ---- Helpers ----------------

function isPromise<T>(value: any): value is Promise<T> {
  return (
    !!value &&
    (typeof value === "object" || typeof value === "function") &&
    typeof value.then === "function"
  );
}

function isAsync(fn: Function) {
  return fn.constructor.name === "AsyncFunction";
}

// ---- APP ----------------

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
store.getState((s) => s.text);
store.decrement(3);
store.hello("Hello, World!");
store.decrement(2);

store.getState().text;

store.hello("Hello, World!");

store.on("hello", (state, action) => {
  console.log(`Hello action: "${action}" was called with text: ${state.text}`);
});
