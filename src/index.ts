// MiniRDX by Wojciech Ludwin, @ludekarts

// Store API action.
type Action<S> = (state: S, ...args: any[]) => S | Promise<S>;

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

export function createStore<S, A extends Record<string, Action<S>>>(config: {
  state: S;
  actions: A;
}) {
  let { state, actions } = config;
  type Actions = typeof actions;

  const globalListeners: ActionListener<S, A>[] = [];
  const actionListeners: ActionListenerColection<S, A> = new Map();

  const apiActions = Object.fromEntries(
    Object.entries(actions).map(([key, action]) => {
      if (protectedKeys.includes(key)) {
        throw new Error(`MiniRdxError: "${key}" is a reserved keyword`);
      }

      if (typeof action !== "function") {
        throw new Error(`MiniRdxError: "${key}" should be a function`);
      }

      return [
        key,
        (...args: OmitFirstParam<typeof action>) =>
          new Promise((resolve) => {
            resolver(
              key,
              (state: S) => (action as Function)(state, ...args),
              resolve
            );
          }),
      ];
    })
  ) as {
    [K in keyof A]: (...args: OmitFirstParam<A[K]>) => Promise<S>;
  };

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

type SelectorReturnType<A extends (...args: any[]) => any> = (
  state: ReturnType<A>,
  ...args: Parameters<A>
) => ReturnType<A> extends Promise<infer R> ? Promise<R> : ReturnType<A>;

export function selector<A extends (...args: any[]) => any, S>(
  selectorPath: string,
  action: (state: S, ...args: Parameters<A>) => S | Promise<S>,
  accessGlobalState = false
): SelectorReturnType<A> {
  const { getter, setter } = createSelector<S>(selectorPath);

  // Handle Async Reducers.
  if (isAsync(action)) {
    return async function (state, ...args) {
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
        ...(state as S),
      };
    } as SelectorReturnType<A>;
  }

  // Handle Sync Reducers.
  else {
    return function (state, ...args) {
      if (accessGlobalState) {
        setter(state, (action as Function)(state, getter(state), ...args));
      } else {
        setter(state, (action as Function)(getter(state), ...args));
      }
      return {
        ...(state as S),
      };
    } as SelectorReturnType<A>;
  }
}

export function superSelector<S>(
  selectorPath: string,
  action: Action<S>
): Action<S> | Promise<Action<S>> {
  return selector(selectorPath, action, true);
}

type SelectorObject<V> = {
  getter: (state: unknown) => V;
  setter: (_state: unknown, value: V) => V;
};

function createSelector<V>(selector: string): SelectorObject<V> {
  if (/^state\.[\w\[\]\d\.]+$/.test(selector)) {
    return {
      getter: new Function("state", `return ${selector}`),
      setter: new Function("state", "value", `${selector} = value`),
    } as SelectorObject<V>;
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
