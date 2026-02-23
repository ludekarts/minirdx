# Fix TODO

Atomic fixes to apply one by one:

1. **Handle action failures in `createStore`**  
   - In API actions, pass both `resolve` and `reject` to the promise executor.
   - In `resolver`, catch sync throws and async promise rejections.
   - Prevent hanging promises when action fails.

2. **Safe listener unsubscribe**  
   - Guard `splice(index, 1)` with `index >= 0` for both global and action listeners.
   - Avoid accidental removal of the last listener when index is `-1`.

3. **Fix React subscription behavior in `useStore`**  
   - Avoid re-subscribing on every render.
   - Avoid stale closure comparison against `data`.
   - Use functional state update and stable effect dependencies.

4. **Detect async selector result by value, not declaration**  
   - Replace `isAsync(action)` branching with checking whether action result is a promise.
   - Correctly support non-`async` functions that still return promises.

5. **Return proper selector result shape**  
   - Avoid always returning `{ ...newState }`.
   - Preserve arrays/primitives or clone conditionally.

6. **Do not mutate `link(...args)` captured args**  
   - Remove `args.pop()` mutation.
   - Read `processor`/`stores` without mutating source array.

7. **Safer `hasOwnProperty` checks**  
   - Replace direct `.hasOwnProperty(...)` calls with `Object.prototype.hasOwnProperty.call(...)`.
   - Apply in `scanObject` and `isLink`.
