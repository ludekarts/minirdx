// MiniRDX by Wojciech Ludwin, @ludekarts

// Store API action.
type Action<S> = (state: () => S, ...args: any[]) => S | Promise<S>;

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

  const linksList: any[] = [];
  const globalListeners: ActionListener<S, A>[] = [];
  const actionListeners: ActionListenerColection<S, A> = new Map();

  // Scan the state object and pull out all links values.

  scanObject(state, (key, value, parent, path) => {
    if (isLink(value)) {
      const { setter } = createSelector(`state.${path}`);
      const updateLinkValue = (value: any) => {
        setter(getState(), value);
        notify();
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
          new Promise((resolve) => {
            resolver(
              key,
              (state: () => S) => (action as Function)(state, ...args),
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
    const newState = action(getState);
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

  function getState(): S {
    return state;
  }

  // Enable manual state notification.
  function notify() {
    globalListeners.length &&
      globalListeners.forEach((listener) => listener(state, "link"));
  }

  return {
    state: getState,

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

export function selector<S, Args extends any[]>(
  path: string,
  action: (...args: Args) => any
) {
  const { getter, setter } = createSelector(path);

  return function response(
    state: () => S,
    ...args: OmitFirstParam<typeof action>
  ) {
    if (isAsync(action)) {
      return Promise.resolve(
        (action as Function)(getter(state()), ...args)
      ).then((result) => {
        const newState = setter(state(), result) as S;
        return { ...newState };
      });
    } else {
      const result = (action as Function)(getter(state()), ...args);
      const newState = setter(state(), result) as S;
      return { ...newState };
    }
  };
}

type SelectorObject<V> = {
  getter: (state: unknown) => V;
  setter: (_state: unknown, value: V) => V;
};

export function createSelector<V>(selector: string): SelectorObject<V> {
  if (/^state\.[\w\[\]\d\.]+$/.test(selector)) {
    return {
      getter: new Function("state", `return ${selector}`),
      setter: new Function(
        "state",
        "value",
        `{${selector} = value; return state;}`
      ),
    } as SelectorObject<V>;
  }

  throw new Error(
    `MiniRDXError: Selector should be a string with dot notation starting with "state." e.g.: "state.user.cars[1].model" `
  );
}

// ---- Link values --------------

export function link(...args) {
  return Object.freeze({
    _rdx_link_: (updateLinkValue) => {
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

function isAsync(fn: Function) {
  return fn.constructor.name === "AsyncFunction";
}

// function scanObjectForLinks(obj: any, linksList: any[], notify: Function) {
//   if (Array.isArray(obj)) {
//     obj.forEach((item) => scanObjectForLinks(item, linksList, notify));
//   } else if (typeof obj === "object") {
//     for (const key in obj) {
//       if (obj.hasOwnProperty(key)) {
//         if (isLink(obj[key])) {
//           const linkIndex = linksList.length;
//           linksList[linkIndex] = undefined;
//           obj[key]._rdx_link_(linksList, linkIndex, notify);
//           obj[key] = linksList[linkIndex];
//           console.log("index", linksList);
//         }
//         scanObjectForLinks(obj[key], linksList, notify);
//       }
//     }
//   }
//   return obj;
// }

function scanObject(obj: any, callback: Function, path = "") {
  if (typeof obj !== "object" || obj === null) {
    return;
  }

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];
      const keyString = /\d+/.test(key) ? `[${key}]` : `.${key}`;
      const currentPath = path ? `${path}${keyString}` : key;

      callback(key, value, obj, currentPath);

      if (typeof value === "object" && value !== null) {
        scanObject(value, callback, currentPath);
      }
    }
  }
}

function isLink(value: any): boolean {
  return (
    value !== null &&
    typeof value === "object" &&
    value.hasOwnProperty("_rdx_link_")
  );
}
