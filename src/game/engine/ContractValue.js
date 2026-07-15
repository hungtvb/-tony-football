function describePath(path, key) {
  return Array.isArray(path) ? `${path.join(".")}.${key}` : `${path}.${key}`;
}

export function cloneAndFreezeContractValue(value, path = "value", seen = new WeakSet()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;

  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError(`${path} must contain finite numbers`);
    return value;
  }

  if (typeof value !== "object") {
    throw new TypeError(`${path} must contain only JSON-compatible values`);
  }

  if (seen.has(value)) throw new TypeError(`${path} must not contain circular references`);
  seen.add(value);

  if (Array.isArray(value)) {
    const clone = value.map((item, index) => cloneAndFreezeContractValue(item, `${path}[${index}]`, seen));
    seen.delete(value);
    return Object.freeze(clone);
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${path} must contain only plain objects`);
  }

  const clone = {};
  for (const [key, item] of Object.entries(value)) {
    clone[key] = cloneAndFreezeContractValue(item, describePath(path, key), seen);
  }
  seen.delete(value);
  return Object.freeze(clone);
}

export function assertPlainRecord(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${name} must be a plain object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${name} must be a plain object`);
  }
}

export function assertNonNegativeInteger(value, name) {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer`);
  }
}

export function assertUnitNumber(value, name) {
  if (!Number.isFinite(value) || value < -1 || value > 1) {
    throw new RangeError(`${name} must be a finite number between -1 and 1`);
  }
}

export function assertUnitInterval(value, name) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${name} must be a finite number between 0 and 1`);
  }
}
