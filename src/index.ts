// MiniRDX by Wojciech Ludwin, @ludekarts

// Store API action.
type Action<S> = (...args: any[]) => S | Promise<S>;

// Colection of actions.
type ActionStore<S> = Record<string, Action<S>>;

// Actions handling state updates.
type ActionWithState<S, A extends Record<string, (...args: any[]) => any>> = {
  [K in keyof A]: (state: S, ...args: Parameters<A[K]>) => ReturnType<A[K]>;
};

// Action listener decelared with "store.on()"" method.
type ActionListener<S, A> = (state: S, actionName: keyof A) => void;

// Internal collextion of all action listeners.
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
  config: { state: S } & ActionWithState<S, A>
) {
  let { state, ...actions } = config;
  type Actions = typeof actions;

  const globalListeners: ActionListener<S, A>[] = [];
  const actionListeners: ActionListenerColection<S, A> = new Map();

  const apiActions = Object.entries(actions).reduce((acc, [key, action]) => {
    if (protectedKeys.includes(key)) {
      throw new Error(`MiniRdxError: "${key}" is a reserved keyword`);
    }

    if (typeof action !== "function") {
      throw new Error(`MiniRdxError: "${key}" should be a function`);
    }

    acc[key as keyof Actions] = (...args: Parameters<typeof action>) =>
      new Promise((resolve) => {
        resolver(
          key,
          (state: S) => (action as Function)(state, ...args),
          resolve
        );
      });

    return acc;
  }, {} as { [K in keyof Actions]: (...args: OmitFirstParam<Actions[K]>) => Promise<S> });

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

type SelectorAction<T> = (slice: T, ...args: any[]) => T | Promise<T>;

export function selector<S, T>(
  selectorPath: string,
  action: SelectorAction<T>,
  accessGlobalState = false
): (state: S, ...args: any[]) => S | Promise<S> {
  const { getter, setter } = createSelector<S, T>(selectorPath);

  // Handle Async Reducers.
  if (isAsync(action)) {
    return async function (
      state: S,
      ...args: Parameters<typeof action>
    ): Promise<S> {
      if (accessGlobalState) {
        const result = await (action as Function)(
          state,
          getter(state),
          ...args
        );
        setter(state, result);
      } else {
        const result = await action(getter(state), ...args);
        setter(state, result);
      }
      return {
        ...state,
      };
    };
  }

  // Handle Sync Reducers.
  else {
    return function (state: S, ...args: Parameters<typeof action>): S {
      if (accessGlobalState) {
        setter(state, (action as Function)(state, getter(state), ...args));
      } else {
        setter(state, (action as Function)(getter(state), ...args));
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

type SelectorObject<S, T> = {
  getter: (state: S) => T;
  setter: (_state: S, value: T) => T;
};

function createSelector<S, T>(selector: string): SelectorObject<S, T> {
  if (/^state\.[\w\[\]\d\.]+$/.test(selector)) {
    return {
      getter: new Function("state", `return ${selector}`),
      setter: new Function("state", "value", `${selector} = value`),
    } as SelectorObject<S, T>;
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
  hello: (text: string) => State;
  increment: (amount: number) => State;
  decrement: (amount: number) => State;
  asyncInc: (amount: number) => Promise<State>;
};

// type DecrementType = Actions["decrement"];

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

  async asyncInc(state, amount) {
    const square = await Promise.resolve(amount * 2);
    return {
      ...state,
      count: state.count + square,
    };
  },

  decrement(state, amount) {
    return {
      ...state,
      count: state.count - amount,
    };
  },
  // decrement: selector2("state.count", (count: number, amount: number) => {
  //   return count - amount;
  // }),

  // decrement: sel<State, number>("x", (x) => x),
});

store.getState().count;
store.getState((s) => s.text);
store.decrement(3);
store.decrement(2);
store.hello("Hello, World!");

store.asyncInc(10);

store.getState().text;

store.hello("Hello, World!");

store.on("hello", (state, action) => {
  console.log(`Hello action: "${action}" was called with text: ${state.text}`);
});
