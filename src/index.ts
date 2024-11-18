type ScreateStoreConfig = {
  state: any;
  [key: string]: (...payload: any[]) => void;
};

const disallowKeys = ["on", "tap", "state", "getState"];

type ActionListener = (state: any, actionName: string) => void;

interface TapListener {
  (props: { state: any; slice: any }): void;
  getter(state: any): any;
  setter(state: any, value: any): any;
}

export function createStore(config: ScreateStoreConfig) {
  let state = config.state;
  const globalListeners: ActionListener[] = [];
  const tapListeners = new Map<string, TapListener[]>();
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

    // Run tap listeners.
    state = applyTaps(state, actionName);

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

  function tap(
    action: string,
    selector: string | TapListener,
    listener?: TapListener
  ) {
    if (typeof action !== "string") {
      throw new Error("MiniRdxError: Action name is required");
    }

    if (!tapListeners.has(action)) {
      tapListeners.set(action, []);
    }

    const NO_SELECTOR =
      typeof selector === "function" && listener === undefined;

    const { getter, setter } = createSelector(
      NO_SELECTOR ? "" : (selector as string)
    );

    const tapListener = NO_SELECTOR
      ? (selector as TapListener)
      : (listener as TapListener);

    tapListener.getter = getter;
    tapListener.setter = setter;

    tapListeners.get(action)?.push(tapListener);

    return () => {
      tapListeners
        .get(action)
        ?.splice(tapListeners.get(action)?.indexOf(tapListener) as number, 1);
    };
  }

  function applyTaps(state: any, actionName: string) {
    const taps = tapListeners.get(actionName);

    if (!taps) {
      return state;
    } else {
      return taps.reduce((acc, tap) => {
        const slice = tap.getter(acc);
        tap.setter(acc, tap({ state: acc, slice }));
        return acc;
      }, state);
    }
  }

  return Object.freeze({
    ...actions,
    getState,
    tap,
    on,
  });
}

type ReductorFn = (state: any, ...payload: any[]) => any;

export function selector(selector: string, reductor: ReductorFn): ReductorFn {
  const { getter, setter } = createSelector(selector);

  // Handle Async Reducers.
  if (isAsync(reductor)) {
    return async (state, ...payload) => {
      const result = await reductor(getter(state), ...payload);
      setter(state, result);
      return {
        ...state,
      };
    };
  }

  // Handle Sync Reducers.
  else {
    return (state, ...payload) => {
      setter(state, reductor(getter(state), ...payload));
      return {
        ...state,
      };
    };
  }
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
