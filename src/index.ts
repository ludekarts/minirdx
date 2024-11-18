type ScreateStoreConfig = {
  state: any;
  [key: string]: (...payload: any[]) => void;
};

const disallowKeys = ["on", "state", "getState"];

type ActionListener = (state: any, actionName: string) => void;

export function createStore(config: ScreateStoreConfig) {
  let state = config.state;
  const globalListeners: ActionListener[] = [];
  const actionListeners = new Map<string, ActionListener[]>();

  const actions = configToActions(config, dispatch);

  function dispatch(actionName: string, action: Function, resolve: Function) {
    const newState = action(state);

    isPromise(newState)
      ? newState.then((resolvedState: any) =>
          updateState(resolvedState, actionName, resolve)
        )
      : updateState(newState, actionName, resolve);
  }

  function updateState(newState: any, actionName: string, resolve: Function) {
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

  function on(action: string | ActionListener, listener: ActionListener) {
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

function configToActions(config: ScreateStoreConfig, dispatch: Function) {
  return Object.keys(config).reduce((acc, key) => {
    if (typeof config[key] === "function") {
      if (disallowKeys.includes(key)) {
        throw new Error(`MiniRdxError:"${key}" is a reserved keyword`);
      }
      acc[key] = (...payload: any[]) =>
        new Promise((resolve) => {
          dispatch(
            key,
            (state: any) => config[key](state, ...payload),
            resolve
          );
        });
    }
    return acc;
  }, {} as Record<string, () => void>);
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

function isPromise(o: any) {
  return (
    !!o &&
    (typeof o === "object" || typeof o === "function") &&
    typeof o.then === "function"
  );
}

function isAsync(fn: Function) {
  return fn.constructor.name === "AsyncFunction";
}
