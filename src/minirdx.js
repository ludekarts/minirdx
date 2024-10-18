// Library for state management inspired by Redux & PubSub design pattern created by @ludekarts (02.2022)

export function createStore(config) {
  let state;
  let globalListeners = [];
  const middlewares = new Map();
  const actionListeners = new Map();
  const mainReducer = createReducer(config);
  const reducers = [mainReducer];

  if (!mainReducer) {
    throw new Error(
      "MiniRDXError: The Main Reducer is required to create a store"
    );
  }

  // Get current state value.
  function getState() {
    return state;
  }

  // Subscribe to state changes and return teardown/unsubscribe fn.
  function subscribe(actionName, callback) {
    // Global subscribe (all actions actionName === callback).
    if (typeof actionName === "function" && callback === undefined) {
      !globalListeners.includes(actionName) && globalListeners.push(actionName);
      return function unsubscribeGlobalListener() {
        globalListeners = globalListeners.filter((l) => l !== actionName);
      };
    }

    // Global subscribe (specific action).
    else if (typeof actionName === "string" && typeof callback === "function") {
      if (actionListeners.has(actionName)) {
        actionListeners.set(actionName, [
          ...actionListeners.get(actionName),
          callback,
        ]);
      } else {
        actionListeners.set(actionName, [callback]);
      }

      return function unsubscribeActionListener() {
        const callbacks = actionListeners
          .get(actionName)
          .filter((c) => c !== callback);

        callbacks.length
          ? actionListeners.set(actionName, callbacks)
          : actionListeners.delete(actionName);
      };
    } else {
      throw new Error(
        "MiniRDXError: Incorrect subscribe arguments. Expected: subscribe(actionName?: string, callback: function)"
      );
    }
  }

  // Base on given @action triggers all reducers to perform state update, then notifies all listeners with new state.
  function dispatch(actionType, ...payload) {
    const action = {
      type: actionType,
      payload: payload.length ? payload : undefined,
    };

    applyAction(action, state, (newState) => {
      // Do not send state notifications when internal actions are dispatched.
      if (isExternalAction(action)) {
        // Notify all global listeners.
        globalListeners.forEach((listener) => listener(newState, action));

        // Notify all action listeners.
        actionListeners
          .get(action.type)
          ?.forEach((listener) => listener(newState, action));
      }
    });
  }

  function applyAction(action, currentState, doneCallback) {
    const finalState = createNewState(action, currentState);

    // Update Global state.
    state = finalState;

    if (middlewares.has(action.type)) {
      const { selector, mw } = middlewares.get(action.type);
      const { getter, setter } = selector;

      const mwResult = mw({
        state: selector ? getter(finalState) : finalState,
        globalState: finalState,
        actionName: action.type,
        payload: action.payload,
      });

      if (mwResult?.then) {
        // Async middleware.
        mwResult
          .then((mwState) => setter(finalState, mwState))
          .finally(() => doneCallback(finalState));
      } else {
        // Sync middleware.
        setter(finalState, mwResult);
        doneCallback(finalState);
      }
    } else {
      doneCallback(finalState);
    }
  }

  // Dispatches multiple actions in given order.
  // ⚠️ NOTICE:
  //    - store update is triggered only once at the end of all updates
  //    - batch updates will agregate calls for duplicated actions
  //    - middlewares will be called normally for each asocciated action
  dispatch.batch = function batchDispatch(...args) {
    callbackReducer(
      args,
      (lstate, [actionType, ...payload], done) => {
        const action = {
          type: actionType,
          payload: payload.length ? payload : undefined,
        };
        applyAction(action, lstate, done);
      },
      state
    ).then((newState) => {
      // Notify once all subscribers.
      batchArgsToAction(args).forEach((action) => {
        globalListeners.forEach((listener) => listener(newState, action));
        actionListeners
          .get(action.type)
          ?.forEach((listener) => listener(newState, action));
      });
    });
  };

  // Apply action to update global state.
  function createNewState(action, oldState) {
    return reducers.reduce((newState, reducer) => {
      // Handles extendReducer logic.
      if (typeof reducer.setter === "function") {
        let intermediateState;

        // If new reducer was added try to set it's default state.
        // In case new state is undefinded use the old state as a default.
        if (reducer.isNew && action.type === "extendReducer:true") {
          delete reducer.isNew;
          intermediateState = reducer(undefined, action);
          if (intermediateState === undefined) {
            intermediateState = reducer(newState, action);
          }
        } else {
          intermediateState = reducer(newState, action);
        }

        // [💡 HINT]:
        // Use fn notation when you want to access GLOBAL state in LOCAL reducer.
        // In that case you also need to return a full GLOBAL STATE.
        if (typeof intermediateState === "function") {
          return intermediateState(newState);
        } else {
          reducer.setter(newState, intermediateState);
          return newState;
        }
      } else {
        return reducer(newState, action);
      }
    }, oldState);
  }

  function extend(storeSelector, reducerConfig) {
    const config =
      isObject(storeSelector) && reducerConfig === undefined
        ? storeSelector
        : reducerConfig;
    const extendReducer = createReducer(config);

    const selector =
      typeof storeSelector === "string" ? storeSelector : undefined;
    if (typeof selector === "string") {
      const { setter, getter } = createSelector(selector);
      const newReducer = (state, action) =>
        extendReducer(state === undefined ? undefined : getter(state), action);
      newReducer.setter = setter;
      newReducer.isNew = true;
      reducers.push(newReducer);
      dispatch("extendReducer:true");
    }

    // [⚠️ NOTE]:
    // When selector is undefined then reducer will connected to the global state,
    // however it @initialState will not override the global state.
    else if (selector === undefined) {
      reducers.push(extendReducer);
      dispatch("extendReducer:true");
    } else {
      throw new Error(
        "MiniRDXError: Reducer's statePath should be a string with dot notation e.g.: 'user.cars[1].name' "
      );
    }
  }

  function middleware(actionName, storeSelector, middlewareFn) {
    if (
      typeof actionName === "string" &&
      typeof storeSelector === "string" &&
      typeof middlewareFn === "function"
    ) {
      const selector = createSelector(storeSelector);
      middlewares.set(actionName, { selector, mw: middlewareFn });
    } else {
      throw new Error(
        "MiniRDXError: Incorrect middleware arguments. Expected: middleware(actionName: string, storeSelector: string, middlewareFn: function)"
      );
    }
  }

  // setupAction -> initialize reducers.
  dispatch("initialize:true");

  return { getState, subscribe, dispatch, extend, middleware };
}

function createReducer(config) {
  if (!isObject(config)) {
    throw new Error(
      "MiniRDXError: Config object is required to create a reducer"
    );
  }

  if (!isObject(config.actions)) {
    throw new Error(
      "MiniRDXError: Actions object is required to create a reducer"
    );
  }

  const reducer = Object.keys(config.actions).reduce((acc, action) => {
    return acc.on(action, config.actions[action]);
  }, createReducerCore(config.state));

  return reducer.done();
}

function createReducerCore(initState) {
  const api = {};
  const actions = new Map();

  api.on = (actionName, actionReducer) => {
    if (actions.has(actionName)) {
      throw new Error(
        `MiniRDXError: Action name "${actionName}" already exist`
      );
    }

    if (typeof actionName !== "string") {
      throw new Error(`MiniRDXError: Action name should be a string`);
    }

    if (typeof actionReducer !== "function") {
      throw new Error(`MiniRDXError: Action reducer should be a function`);
    }

    actions.set(actionName, actionReducer);
    return api;
  };

  api.done = function () {
    return function reducer(state = initState, action) {
      if (!action) {
        throw new Error("MiniRDXError: Action is required to run a reducer");
      }

      return actions.has(action.type)
        ? actions.get(action.type)(
            state,
            ...(Array.isArray(action.payload)
              ? action.payload
              : [action.payload])
          )
        : state;
    };
  };

  return api;
}

// ---- Helpers ----------------

function createSelector(selector) {
  if (typeof selector === "string" && /^[\w\[\]\d\.]+$/.test(selector)) {
    return {
      getter: new Function("state", `return state.${selector}`),
      setter: new Function("state", "value", `state.${selector} = value`),
    };
  }

  throw new Error(
    "MiniRDXError: Selector should be a string with dot notation e.g.: 'user.cars[1].name' "
  );
}

function isExternalAction(action) {
  return (
    action.type !== "initialize:true" && action.type !== "extendReducer:true"
  );
}

function batchArgsToAction(args) {
  const usedTypes = [];
  return args.reduce((acc, [type, payload]) => {
    if (!usedTypes.includes(type)) {
      usedTypes.push(type);
      acc = [...acc, { type, payload }];
    }
    return acc;
  }, []);
}

function isObject(o) {
  return Object.prototype.toString.call(o) === "[object Object]";
}

function callbackReducer(array, reducer, result) {
  return new Promise((resolve) => {
    let index = 0;
    const stopIndex = array.length - 1;
    const done = (newResult) => {
      result = newResult;
      if (stopIndex === index) {
        resolve(result);
      } else {
        index++;
        reducer(result, array[index], done);
      }
    };
    reducer(result, array[index], done);
  });
}
