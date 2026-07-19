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

function collectErrors(items, callback) {
  const errors = [];
  for (const item of items) {
    try {
      callback(item);
    } catch (error) {
      errors.push(error);
    }
  }
  return errors;
}

function throwCollected(errors, message, primaryError = null) {
  if (errors.length === 0) {
    if (primaryError) throw primaryError;
    return;
  }
  if (!primaryError && errors.length === 1) throw errors[0];
  throw new AggregateError(
    primaryError ? [primaryError, ...errors] : errors,
    message,
    primaryError ? { cause: primaryError } : undefined,
  );
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
      const cleanupErrors = collectErrors([...created].reverse(), disposeAdapter);
      this.#adapters = [];
      this.#started = false;
      throwCollected(cleanupErrors, "presentation startup failed and rollback reported errors", error);
    }
  }

  render(frame) {
    if (!this.#started) return false;
    const errors = collectErrors(this.#adapters, (adapter) => adapter?.render?.(frame));
    throwCollected(errors, "presentation render failed");
    return true;
  }

  reset(context = {}) {
    if (!this.#started) return false;
    const stableContext = Object.freeze({ ...context });
    const errors = collectErrors(this.#adapters, (adapter) => adapter?.reset?.(stableContext));
    throwCollected(errors, "presentation reset failed");
    return true;
  }

  teardown() {
    if (!this.#started) return false;
    const adapters = [...this.#adapters].reverse();
    this.#adapters = [];
    this.#started = false;
    const errors = collectErrors(adapters, disposeAdapter);
    throwCollected(errors, "presentation teardown failed");
    return true;
  }
}
