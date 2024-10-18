type ScreateStoreConfig = {
  state: any;
  [key: string]: () => void;
};

export function createStore(config: ScreateStoreConfig) {
  console.log(config);
}
