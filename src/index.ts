// MiniRDX by Wojciech Ludwin, @ludekarts

// Store API action.
export type Action<S> = (state: () => S, ...args: any[]) => S | Promise<S>;

type ActionEventName<A> = keyof A | "link";

// Action listener decelared with "store.on()"" method.
type ActionListener<S, A> = (state: S, actionName: ActionEventName<A>) => void;

// Internal collection of all action listeners.
type ActionListenerCollection<S, A> = Map<string, ActionListener<S, A>[]>;

// Generic Promise resolve callback.
type PromiseResolve<T> = (value: T) => void;

// Generic Promise reject callback.
type PromiseReject = (reason?: unknown) => void;

// Allow to skip the first argument of a function.
type OmitFirstParam<T extends (...args: any[]) => any> = T extends (
  state: any,
  ...args: infer P
) => any
  ? P
  : never;

const protectedKeys = ["on", "state", "actions"];

export interface Store<S, A extends Record<string, Action<S>>> {
  state: () => S;
  actions: { [K in keyof A]: (...args: OmitFirstParam<A[K]>) => Promise<S> };
  on: (
    action: keyof A | ((state: S, actionName: ActionEventName<A>) => void),
    listener?: (state: S, actionName: ActionEventName<A>) => void,
  ) => () => void;
}

export function createStore<S, A extends Record<string, Action<S>>>(config: {
  state: S;
  actions: A;
}): Store<S, A> {
  let { state, actions } = config;
  type Actions = typeof actions;

  const globalListeners: ActionListener<S, A>[] = [];
  const actionListeners: ActionListenerCollection<S, A> = new Map();

  // Scan State object and pull out all linked values.

  scanObject(state, (value: any, path: string) => {
    if (isLink(value)) {
      const { setter } = createSelector(`state.${path}`);
      const updateLinkValue = (value: any) => {
        setter(getState(), value);
        notifyOnLinkUpdate();
      };
      value._rdx_link_(updateLinkValue);
    }
  });

  // Create a set of API actions.

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
          new Promise((resolve, reject) => {
            resolver(
              key,
              (state: () => S) => (action as Function)(state, ...args),
              resolve,
              reject,
            );
          }),
      ];
    }),
  ) as {
    [K in keyof A]: (...args: OmitFirstParam<A[K]>) => Promise<S>;
  };

  function resolver(
    actionName: string,
    action: Action<S>,
    resolve: PromiseResolve<S>,
    reject: PromiseReject,
  ) {
    try {
      const newState = action(getState);
      isPromise<S>(newState)
        ? newState
            .then((resolvedState: S) =>
              updateState(resolvedState, actionName, resolve),
            )
            .catch(reject)
        : updateState(newState, actionName, resolve);
    } catch (error) {
      reject(error);
    }
  }

  function updateState(
    newState: S,
    actionName: string,
    resolve: PromiseResolve<S>,
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

  function getState(): S {
    return state;
  }

  // Link update notifications.
  function notifyOnLinkUpdate() {
    // Creates new state since link's update mutates initial state.
    const newState = (
      isObject(state) ? { ...state } : Array.isArray(state) ? [...state] : state
    ) as S;
    state = newState;
    globalListeners.length &&
      globalListeners.forEach((listener) => listener(newState, "link"));
  }

  // Subscribe to named and global actions.
  function createListener(
    action: keyof Actions | ActionListener<S, A>,
    listener?: ActionListener<S, A>,
  ) {
    // Subscribe to global actions.
    if (typeof action === "function" && listener === undefined) {
      globalListeners.push(action);

      // Return an unsubscribe function.
      return () => {
        const actionIndex = globalListeners.indexOf(action);
        if (actionIndex >= 0) {
          globalListeners.splice(actionIndex, 1);
        }
      };
    }

    // Subscribe to specific actions.
    else if (typeof action === "string" && listener) {
      if (!actionListeners.has(action)) {
        actionListeners.set(action, []);
      }

      actionListeners.get(action)?.push(listener);

      // Return an unsubscribe function.
      return () => {
        const listeners = actionListeners.get(action);
        if (!listeners) return;

        const listenerIndex = listeners.indexOf(listener);
        if (listenerIndex >= 0) {
          listeners.splice(listenerIndex, 1);
        }
      };
    } else {
      throw new Error(
        "MiniRdxError: Invalid arguments. Try: state.on(action: string, listener: ActionListener)",
      );
    }
  }

  return {
    state: getState,
    actions: apiActions,
    on: createListener,
  };
}

// ---- Selectors ----------------

export function selector<S, Args extends any[]>(
  path: string,
  action: (...args: Args) => any,
) {
  const { getter, setter } = createSelector(path);

  const cloneState = (value: S): S => {
    if (Array.isArray(value)) {
      return [...value] as S;
    }

    if (isObject(value)) {
      return { ...value };
    }

    return value;
  };

  return function response(
    state: () => S,
    ...args: OmitFirstParam<typeof action>
  ) {
    const result = (action as Function)(getter(state()), ...args);

    if (isPromise(result)) {
      return Promise.resolve(result).then((resolvedResult) => {
        const newState = setter(state(), resolvedResult) as S;
        return cloneState(newState);
      });
    }

    const newState = setter(state(), result) as S;
    return cloneState(newState);
  };
}

type SelectorObject<V> = {
  getter: (state: unknown) => V;
  setter: (_state: unknown, value: V) => V;
};

export function createSelector<V>(selector: string): SelectorObject<V> {
  const path = parseSelectorPath(selector);

  return {
    getter: (state: unknown) => {
      let current: any = state;

      for (const key of path) {
        current = current[key as keyof typeof current];
      }

      return current as V;
    },
    setter: (state: unknown, value: V) => {
      let current: any = state;

      for (let i = 0; i < path.length - 1; i++) {
        current = current[path[i] as keyof typeof current];
      }

      current[path[path.length - 1] as keyof typeof current] = value;
      return state as V;
    },
  } as SelectorObject<V>;
}

function parseSelectorPath(selector: string): Array<string | number> {
  if (!/^state(?:\.[A-Za-z_$][\w$]*|\[\d+\])+$/.test(selector)) {
    throw new Error(
      `MiniRDXError: Selector should be a string with dot notation starting with "state." e.g.: "state.user.cars[1].model" `,
    );
  }

  const path = selector.slice("state.".length);
  const tokens: Array<string | number> = [];
  let index = 0;

  while (index < path.length) {
    const char = path[index];

    if (char === ".") {
      index++;
      continue;
    }

    if (char === "[") {
      const endBracket = path.indexOf("]", index + 1);
      const token = path.slice(index + 1, endBracket);
      tokens.push(Number(token));
      index = endBracket + 1;
      continue;
    }

    let end = index;
    while (end < path.length && /[\w$]/.test(path[end])) {
      end++;
    }

    tokens.push(path.slice(index, end));
    index = end;
  }

  return tokens;
}

// ---- Link values --------------

export function link<T>(...args: any[]) {
  return Object.freeze({
    _rdx_link_: (updateLinkValue: (value: T) => void) => {
      const processor = args.pop();
      const stores = args;
      const update = () => {
        updateLinkValue(processor(...stores.map((store) => store.state())));
      };
      stores.forEach((store) => store.on(() => update()));
      update();
    },
  });
}

// ---- Helpers ------------------

function isPromise<T>(value: any): value is Promise<T> {
  return (
    !!value &&
    (typeof value === "object" || typeof value === "function") &&
    typeof value.then === "function"
  );
}

// function isAsync(fn: Function) {
//   return fn.constructor.name === "AsyncFunction";
// }

function scanObject(
  obj: any,
  callback: Function,
  path = "",
  visited: WeakSet<object> = new WeakSet(),
) {
  if (typeof obj !== "object" || obj === null) {
    return;
  }

  if (visited.has(obj)) {
    return;
  }

  visited.add(obj);

  for (const key in obj) {
    if (hasOwnProp(obj, key)) {
      const value = obj[key];
      const keyString = /\d+/.test(key) ? `[${key}]` : `.${key}`;
      const currentPath = path ? `${path}${keyString}` : key;

      callback(value, currentPath);

      if (typeof value === "object" && value !== null) {
        scanObject(value, callback, currentPath, visited);
      }
    }
  }
}

function isLink(value: any): boolean {
  return (
    value !== null &&
    typeof value === "object" &&
    hasOwnProp(value, "_rdx_link_")
  );
}

function hasOwnProp(object: unknown, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function isObject(object: any): boolean {
  return (
    !!object &&
    typeof object !== "symbol" &&
    typeof object !== "string" &&
    typeof object !== "number" &&
    typeof object !== "boolean" &&
    typeof object !== "function" &&
    !Array.isArray(object)
  );
}
