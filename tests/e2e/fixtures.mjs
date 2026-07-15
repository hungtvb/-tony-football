import { expect, test as base } from "@playwright/test";
import { resolve, sep } from "node:path";

const THREE_CDN_PREFIX = "/npm/three@0.185.1/";
const THREE_PACKAGE_ROOT = resolve(process.cwd(), "node_modules/three");

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route("https://fonts.googleapis.com/**", (route) => route.fulfill({
      body: "",
      contentType: "text/css; charset=utf-8",
    }));
    await page.route("https://cdn.jsdelivr.net/npm/three@0.185.1/**", async (route) => {
      const pathname = decodeURIComponent(new URL(route.request().url()).pathname);
      const relativePath = pathname.startsWith(THREE_CDN_PREFIX)
        ? pathname.slice(THREE_CDN_PREFIX.length)
        : "";
      const localPath = resolve(THREE_PACKAGE_ROOT, relativePath);
      const insidePackage = localPath === THREE_PACKAGE_ROOT
        || localPath.startsWith(`${THREE_PACKAGE_ROOT}${sep}`);

      if (!relativePath || !insidePackage) {
        await route.abort("blockedbyclient");
        return;
      }

      await route.fulfill({
        path: localPath,
        contentType: "text/javascript; charset=utf-8",
      });
    });

    await use(page);
  },
});

export { expect };
