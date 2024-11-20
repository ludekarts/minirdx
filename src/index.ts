// Actions defined during store initalization.
type StoreAction<State, Payload extends any[] = []> = (
  state: State,
  ...payload: Payload
) => State;

type ActionCollection<State> = Record<string, StoreAction<State>>;

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

export function createStore<State, Actions extends ActionCollection<State>>(
  config: { state: State } & Actions
) {
  let { state, ...storeActions } = config;

  const globalListeners: ActionListener<State>[] = [];
  const actionListeners: ActionListenerColection<State> = new Map();

  const actions = configToActions<State>(
    storeActions,
    (actionName, action, resolve) => {
      const newState = action(state);
      isPromise<State>(newState)
        ? newState.then((resolvedState) =>
            updateState(resolvedState, actionName, resolve)
          )
        : updateState(newState, actionName, resolve);
    }
  );

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
    action: keyof Actions | ActionListener<State>,
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

  type StateAPI = {
    getState<T = State>(selector?: (state: State) => T): T;
    on: (
      action: keyof Actions | ActionListener<State>,
      listener?: ActionListener<State>
    ) => void;
  };

  type ActionsAPI = {
    [K in keyof Actions]: ExternalAction<State>;
  };

  return Object.freeze(
    mergeObjects<StateAPI, ActionsAPI>({ getState, on }, actions as ActionsAPI)
  );
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

type ExternalAction<State, Payload extends any[] = []> = (
  ...payload: Payload
) => Promise<State>;

function configToActions<State>(
  serverActions: ActionCollection<State>,
  dispatch: Resolver<State>
) {
  return Object.keys(serverActions).reduce((acc, key) => {
    if (
      typeof serverActions[key as keyof ActionCollection<State>] === "function"
    ) {
      if (disallowKeys.includes(key)) {
        throw new Error(`MiniRdxError:"${key}" is a reserved keyword`);
      }

      acc[key] = (...payload) =>
        new Promise((resolve) => {
          dispatch(
            key,
            (state: State) =>
              (
                serverActions[
                  key as keyof ActionCollection<State>
                ] as StoreAction<State>
              )(state, ...payload),
            resolve
          );
        });
    }
    return acc;
  }, {} as Record<keyof ActionCollection<State>, ExternalAction<State>>);
}

function mergeObjects<T, U>(obj1: T, obj2: U): T & U {
  return { ...obj1, ...obj2 };
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
