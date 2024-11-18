type StoreActions<State> = {
  [key in Exclude<string, "state">]: (...payload: any[]) => State;
};
type StoreAction<State> = (...payload: any[]) => Promise<State>;
type CreateStoreConfig<State> = { state: State } & StoreActions<State>;
type ActionListener<State> = (state: State, actionName: string) => void;
type ActionListenerColection<State> = Map<string, ActionListener<State>[]>;
type PromiseResolve<T> = (value: T) => void;
type Dispatcher<State> = (
  actionName: string,
  action: (state: State) => State,
  resolve: PromiseResolve<State>
) => void;

const disallowKeys = ["on", "state", "getState"];

export function createStore<State>(config: CreateStoreConfig<State>) {
  let state: State = config.state;
  const globalListeners: ActionListener<State>[] = [];
  const actionListeners: ActionListenerColection<State> = new Map();

  const dispatch: Dispatcher<State> = (actionName, action, resolve) => {
    const newState = action(state);

    isPromise<State>(newState)
      ? newState.then((resolvedState) =>
          updateState(resolvedState, actionName, resolve)
        )
      : updateState(newState, actionName, resolve);
  };

  const actions = configToActions<State>(config, dispatch);

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

  function getState() {
    return state;
  }

  function on(
    action: string | ActionListener<State>,
    listener: ActionListener<State>
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

  return Object.freeze({
    ...actions,
    getState,
    on,
  });
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
  config: CreateStoreConfig<State>,
  dispatch: Dispatcher<State>
) {
  return Object.keys(config).reduce((acc, key) => {
    if (typeof config[key] === "function") {
      if (disallowKeys.includes(key)) {
        throw new Error(`MiniRdxError:"${key}" is a reserved keyword`);
      }
      acc[key] = (...payload: any[]) =>
        new Promise((resolve) => {
          dispatch(
            key,
            (state: State) => config[key](state, ...payload),
            resolve
          );
        });
    }
    return acc;
  }, {} as Record<string, StoreAction<State>>);
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
