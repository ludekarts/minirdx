// MiniRDX by Wojciech Ludwin, @ludekarts

// Basic action.
type Action<S> = (state: S, ...args: any[]) => S | Promise<S>;

// Colection of actions.
type ActionStore<S> = { [key: string]: Action<S> };

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

const protectedKeys = ["on", "state", "getState"];

export function createStore<S, A extends ActionStore<S>>(
  config: { state: S } & A
) {
  let { state, ...actions } = config;
  type Actions = typeof actions;

  const globalListeners: ActionListener<S, A>[] = [];
  const actionListeners: ActionListenerColection<S, A> = new Map();

  const apiActions = Object.entries(actions).reduce((acc, [key, action]) => {
    if (protectedKeys.includes(key)) {
      throw new Error(`MiniRdxError: "${key}" is a reserved keyword`);
    }
    acc[key as keyof Actions] = (...args: OmitFirstParam<typeof action>) => {
      return new Promise((resolve) => {
        const action = (state: S) => (action as Function)(state, ...args);
        resolver(key, action, resolve);
      });
    };

    return acc;
  }, {} as { [K in keyof Actions]: (...args: OmitFirstParam<Actions[K]>) => S | Promise<S> });

  function resolver(
    actionName: string,
    action: Action<S>,
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

// ---- Selectors ----------------

type SelectorAction<T> = (slice: T, ...payload: any[]) => T | Promise<T>;

export function selector<S>(
  selectorPath: string,
  action: Action<S>,
  accessGlobalState = false
): Action<S> {
  const { getter, setter } = createSelector<S>(selectorPath);

  // Handle Async Reducers.
  if (isAsync(action)) {
    return async function (state, ...payload) {
      if (accessGlobalState) {
        const result = await action(state, getter(state), ...payload);
        setter(state, result);
      } else {
        const result = action(getter(state), ...payload);
        setter(state, result);
      }
      return {
        ...state,
      };
    };
  }

  // Handle Sync Reducers.
  else {
    return (state, ...payload) => {
      if (accessGlobalState) {
        setter(state, action(state, getter(state), ...payload));
      } else {
        setter(state, action(getter(state), ...payload));
      }
      return {
        ...state,
      };
    };
  }
}

export function superSelector<S>(
  selectorPath: string,
  action: Action<S>
): Action<S> | Promise<Action<S>> {
  return selector(selectorPath, action, true);
}

type SelectorObject<S> = {
  getter: (state: S) => any;
  setter: (_state: S, value: any) => any;
};

function createSelector<S>(selector: string): SelectorObject<S> {
  if (typeof selector === "string") {
    if (selector === "") {
      return {
        getter: (state: S) => state,
        setter: (_state: S, value: unknown) => value,
      };
    } else if (/^state\.[\w\[\]\d\.]+$/.test(selector)) {
      return {
        getter: new Function("state", `return ${selector}`),
        setter: new Function("state", "value", `${selector} = value`),
      } as SelectorObject<S>;
    }
  }

  throw new Error(
    `MiniRDXError: Selector should be a string with dot notation starting with "state." e.g.: "state.user.cars[1].model" `
  );
}

// ---- Helpers ------------------

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

// ---- Example ------------------

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
  hello: (s: State, text: string) => State;
  increment: (s: State, amount: number) => State;
  // decrement: (s: State, amount: number) => State;
};

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

  // decrement: selector<State, number>("state.count", (count, amount) => count - 1),
});

store.getState().count;
store.getState((s) => s.text);
// store.decrement(3);
// store.decrement(2);
store.hello("Hello, World!");

store.getState().text;

store.hello("Hello, World!");

store.on("hello", (state, action) => {
  console.log(`Hello action: "${action}" was called with text: ${state.text}`);
});
