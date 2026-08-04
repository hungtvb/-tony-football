import { expect, test } from "./fixtures.mjs";

test.describe.configure({ timeout: 120_000 });

test("captures the exact geometry and stack behind the WebGL bounding-sphere warning", async ({ page }) => {
  await page.addInitScript(() => {
    const originalError = console.error.bind(console);
    const simplify = (value) => {
      if (!value || typeof value !== "object") return { value: String(value) };
      const attributes = {};
      for (const [name, attribute] of Object.entries(value.attributes ?? {})) {
        const nonFinite = [];
        const array = attribute?.array;
        if (array && typeof array.length === "number") {
          for (let index = 0; index < array.length && nonFinite.length < 12; index += 1) {
            if (!Number.isFinite(Number(array[index]))) nonFinite.push({ index, value: String(array[index]) });
          }
        }
        attributes[name] = {
          constructor: attribute?.constructor?.name ?? null,
          arrayConstructor: array?.constructor?.name ?? null,
          count: attribute?.count ?? null,
          itemSize: attribute?.itemSize ?? null,
          normalized: attribute?.normalized ?? null,
          nonFinite,
        };
      }
      const morphAttributes = {};
      for (const [name, list] of Object.entries(value.morphAttributes ?? {})) {
        morphAttributes[name] = (list ?? []).map((attribute) => {
          const nonFinite = [];
          const array = attribute?.array;
          if (array && typeof array.length === "number") {
            for (let index = 0; index < array.length && nonFinite.length < 12; index += 1) {
              if (!Number.isFinite(Number(array[index]))) nonFinite.push({ index, value: String(array[index]) });
            }
          }
          return {
            constructor: attribute?.constructor?.name ?? null,
            arrayConstructor: array?.constructor?.name ?? null,
            count: attribute?.count ?? null,
            itemSize: attribute?.itemSize ?? null,
            nonFinite,
          };
        });
      }
      const simpleUserData = {};
      for (const [key, entry] of Object.entries(value.userData ?? {})) {
        if (["string", "number", "boolean"].includes(typeof entry) || entry === null) simpleUserData[key] = entry;
      }
      return {
        constructor: value.constructor?.name ?? null,
        type: value.type ?? null,
        name: value.name ?? null,
        uuid: value.uuid ?? null,
        userData: simpleUserData,
        attributes,
        morphAttributes,
        index: value.index ? {
          constructor: value.index.constructor?.name ?? null,
          count: value.index.count ?? null,
          itemSize: value.index.itemSize ?? null,
        } : null,
        boundingBox: value.boundingBox ? {
          min: value.boundingBox.min?.toArray?.() ?? null,
          max: value.boundingBox.max?.toArray?.() ?? null,
        } : null,
        boundingSphere: value.boundingSphere ? {
          center: value.boundingSphere.center?.toArray?.() ?? null,
          radius: value.boundingSphere.radius ?? null,
        } : null,
      };
    };
    globalThis.__TONY_BOUNDING_DIAGNOSTICS__ = [];
    console.error = (...args) => {
      const message = args.map((arg) => typeof arg === "string" ? arg : String(arg)).join(" ");
      if (message.includes("computeBoundingSphere")) {
        globalThis.__TONY_BOUNDING_DIAGNOSTICS__.push({
          message,
          stack: new Error("TONY computeBoundingSphere diagnostic").stack,
          args: args.slice(1).map(simplify),
        });
      }
      originalError(...args);
    };
  });

  await page.goto("/?visualTest=1&skipIntro=1&goalTest=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__TONY_DEBUG__?.ready === true);

  const quickMatch = page.locator("#quickMatchButton");
  if (await quickMatch.isVisible().catch(() => false)) await quickMatch.click();
  const play = page.locator("#playButton");
  if (await play.isVisible().catch(() => false)) await play.click();

  await page.waitForFunction(
    () => window.__TONY_BOUNDING_DIAGNOSTICS__?.length > 0,
    undefined,
    { timeout: 75_000 },
  );

  const diagnostics = await page.evaluate(() => window.__TONY_BOUNDING_DIAGNOSTICS__);
  console.log(`TONY_BOUNDING_DIAGNOSTICS=${JSON.stringify(diagnostics, null, 2)}`);
  expect(diagnostics.length).toBeGreaterThan(0);
});
