type ScreateStoreConfig = {
  state: any;
  [key: string]: (...payload: any[]) => void;
};

const disalowKeys = ["on", "tap", "state", "getState"];

type ActionListener = (state: any, actionName: string) => void;

export function createStore(config: ScreateStoreConfig) {
  let state = config.state;
  const globalListeners: ActionListener[] = [];
  const actionListeners = new Map<string, ActionListener[]>();

  const actions = configToActions(config, dispatch);

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
        "MiniRdxError: Invalid arguments. Try state.on(action:string, listener: ActionListener)"
      );
    }
  }

  function dispatch(actionName: string, action: Function, resolve: Function) {
    const newState = action(state);

    if (isPromise(newState)) {
      newState.then((resolvedState: any) =>
        updateState(resolvedState, actionName, resolve)
      );
    } else {
      updateState(newState, actionName, resolve);
    }
  }

  function updateState(newState: any, actionName: string, resolve: Function) {
    // Notify global listeners.
    globalListeners.length &&
      globalListeners.forEach((listener) => listener(newState, actionName));

    // Notify action specific listeners.
    actionListeners
      .get(actionName)
      ?.forEach((listener) => listener(newState, actionName));

    state = newState;

    resolve(newState);
  }

  return Object.freeze({
    ...actions,
    getState,
    on,
  });
}

// ---- Helpers----------------

function configToActions(config: ScreateStoreConfig, dispatch: Function) {
  return Object.keys(config).reduce((acc, key) => {
    if (typeof config[key] === "function") {
      if (disalowKeys.includes(key)) {
        throw new Error(`MiniRdxError:"${key}" is a reserved keyword`);
      }

      acc[key] = (...payload: any[]) =>
        new Promise((resolve) => {
          dispatch(key, (state) => config[key](state, ...payload), resolve);
        });
    }
    return acc;
  }, {} as Record<string, () => void>);
}

function isPromise(o: any) {
  return (
    !!o &&
    (typeof o === "object" || typeof o === "function") &&
    typeof o.then === "function"
  );
}
