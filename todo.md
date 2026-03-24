# MiniRDX Implementation TODO

1. Fix type mismatch for link-triggered updates.
   - Widen listener actionName type to include `"link"` event.
   - Ensure `store.on(...)` callback typing reflects link updates.

2. Make link updates consistently update store state reference.
   - In link update notifications, assign cloned state back to store state before notifying.

3. Add cleanup for cross-store subscriptions created by link.
   - Collect unsubscribe callbacks from linked stores.
   - Expose store lifecycle cleanup API for teardown.

4. Replace dynamic selector compilation.
   - Remove `new Function`-based selector getter/setter.
   - Use a parsed-path safe getter/setter implementation.

5. Harden object scanning against circular references.
   - Track visited nodes using `WeakSet` in recursive scan.

6. Improve naming and maintenance clarity.
   - Fix type/function name typos such as `ActionListenerColection` and `crereateListenr`.

7. Optional React optimization.
   - Support custom equality fn in `useStore(selector, equalityFn)` to limit re-renders.
