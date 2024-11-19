// Actions defined during store initalization.
type StoreAction<State> = (state: State, ...payload: any[]) => State;

// Store initalization object.
type StoreConfig<State> = {
  state: State;
  [key: string]: StoreAction<State> | State;
};

// Action listener callback decelared with "store.on()"" method.
type ActionListener<State> = (state: State, actionName: string) => void;

// Internal list of all action listeners.
type ActionListenerColection<State> = Map<string, ActionListener<State>[]>;

// Generic Promise resolve callback.
type PromiseResolve<T> = (value: T) => void;

// Resolves sync & async store actions.
type Resolver<State> = (
  actionName: string,
  action: StoreAction<State>,
  resolve: PromiseResolve<State>
) => void;

const disallowKeys = ["on", "state", "getState"];

export function createStore<State>(config: StoreConfig<State>) {
  let state = config.state;

  const globalListeners: ActionListener<State>[] = [];
  const actionListeners: ActionListenerColection<State> = new Map();

  const actions = configToActions<State>(
    config,
    (actionName, action, resolve) => {
      const newState = action(state);
      isPromise<State>(newState)
        ? newState.then((resolvedState) =>
            updateState(resolvedState, actionName, resolve)
          )
        : updateState(newState, actionName, resolve);
    }
  );

  type ActionsKeys = keyof typeof actions;

  function updateState(
    newState: State,
    actionName: string,
    resolve: PromiseResolve<State>
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

  function getState<T = State>(selector?: (state: State) => T): T {
    return typeof selector === "function"
      ? selector(state)
      : (state as unknown as T);
  }

  function on(
    action: string | ActionListener<State>,
    listener?: ActionListener<State>
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
          ?.splice(actionListeners.get(action)?.indexOf(listener) as number, 1);
      };
    } else {
      throw new Error(
        "MiniRdxError: Invalid arguments. Try: state.on(action: string, listener: ActionListener)"
      );
    }
  }

  const api = Object.freeze({
    ...actions,
    getState,
    on,
  });

  return api;
}

type ReductorFn = (state: any, ...payload: any[]) => any;

export function selector(
  selectorPath: string,
  reductor: ReductorFn,
  accessGlobalState = false
): ReductorFn {
  const { getter, setter } = createSelector(selectorPath);

  // Handle Async Reducers.
  if (isAsync(reductor)) {
    return async (state, ...payload) => {
      const result = await (accessGlobalState
        ? reductor(state, getter(state), ...payload)
        : reductor(getter(state), ...payload));
      setter(state, result);
      return {
        ...state,
      };
    };
  }

  // Handle Sync Reducers.
  else {
    return (state, ...payload) => {
      setter(
        state,
        accessGlobalState
          ? reductor(state, getter(state), ...payload)
          : reductor(getter(state), ...payload)
      );
      return {
        ...state,
      };
    };
  }
}

export function superSelector(
  selectorPath: string,
  reductor: ReductorFn
): ReductorFn {
  return selector(selectorPath, reductor, true);
}

// ---- Helpers----------------

function configToActions<State>(
  config: StoreConfig<State>,
  dispatch: Resolver<State>
) {
  type Actions = keyof typeof config;

  return Object.keys(config).reduce((acc, key) => {
    if (typeof config[key] === "function") {
      if (disallowKeys.includes(key)) {
        throw new Error(`MiniRdxError:"${key}" is a reserved keyword`);
      }

      acc[key as Actions] = (...payload: any[]) =>
        new Promise((resolve) => {
          dispatch(
            key,
            (state: State) =>
              (config[key] as StoreAction<State>)(state, ...payload),
            resolve
          );
        });
    }
    return acc;
  }, {} as Record<Actions, (...payload: any[]) => Promise<State>>);
}

type SelectorObject = {
  getter: (state: any) => any;
  setter: (_state: any, value: any) => any;
};

function createSelector(selector: string): SelectorObject {
  if (typeof selector === "string") {
    if (selector === "") {
      return {
        getter: (state: any) => state,
        setter: (_state: any, value: any) => value,
      };
    } else if (/^state\.[\w\[\]\d\.]+$/.test(selector)) {
      return {
        getter: new Function("state", `return ${selector}`),
        setter: new Function("state", "value", `${selector} = value`),
      } as SelectorObject;
    }
  }

  throw new Error(
    `MiniRDXError: Selector should be a string with dot notation starting with "state." e.g.: "state.user.cars[1].name" `
  );
}

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
