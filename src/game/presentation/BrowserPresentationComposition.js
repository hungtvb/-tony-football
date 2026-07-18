function assertAdapterFactory(factory) {
  if (typeof factory !== "function") {
    throw new TypeError("presentation adapter factories must be functions");
  }
}

function disposeAdapter(adapter) {
  if (!adapter) return;
  if (typeof adapter.teardown === "function") adapter.teardown();
  else if (typeof adapter.unsubscribe === "function") adapter.unsubscribe();
  else if (typeof adapter.detach === "function") adapter.detach();
  else if (typeof adapter.dispose === "function") adapter.dispose();
}

export class BrowserPresentationComposition {
  #adapterFactories;
  #adapters = [];
  #started = false;

  constructor({ adapterFactories = [] } = {}) {
    if (!Array.isArray(adapterFactories)) {
      throw new TypeError("adapterFactories must be an array");
    }
    adapterFactories.forEach(assertAdapterFactory);
    this.#adapterFactories = [...adapterFactories];
  }

  get started() {
    return this.#started;
  }

  get adapterCount() {
    return this.#adapters.length;
  }

  start(context = {}) {
    if (this.#started) return false;
    const stableContext = Object.freeze({ ...context });
    const created = [];
    try {
      for (const factory of this.#adapterFactories) {
        const adapter = factory(stableContext) ?? null;
        created.push(adapter);
        if (adapter && typeof adapter.attach === "function") adapter.attach(stableContext);
      }
      this.#adapters = created;
      this.#started = true;
      return true;
    } catch (error) {
      for (const adapter of created.reverse()) disposeAdapter(adapter);
      this.#adapters = [];
      throw error;
    }
  }

  render(frame) {
    if (!this.#started) return false;
    for (const adapter of this.#adapters) adapter?.render?.(frame);
    return true;
  }

  reset(context = {}) {
    if (!this.#started) return false;
    const stableContext = Object.freeze({ ...context });
    for (const adapter of this.#adapters) adapter?.reset?.(stableContext);
    return true;
  }

  teardown() {
    if (!this.#started) return false;
    for (const adapter of [...this.#adapters].reverse()) disposeAdapter(adapter);
    this.#adapters = [];
    this.#started = false;
    return true;
  }
}
