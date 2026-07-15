import baseConfig from "./playwright.config.mjs";

const browserName = process.env.TONY_LOCAL_BROWSER === "firefox" ? "firefox" : "chromium";
const webglMode = browserName === "firefox";
const localPort = Number(process.env.TONY_LOCAL_PORT || 4173);

export default {
  ...baseConfig,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    ...baseConfig.use,
    baseURL: `http://127.0.0.1:${localPort}`,
    headless: !webglMode,
    video: "off",
    launchOptions: webglMode
      ? {
          firefoxUserPrefs: {
            "webgl.disabled": false,
            "webgl.force-enabled": true,
            "webgl.enable-webgl2": true,
            "gfx.webrender.software": true,
            "gfx.webrender.all": true,
            "layers.acceleration.force-enabled": true,
          },
        }
      : {
          args: ["--no-sandbox", "--disable-dev-shm-usage"],
        },
  },
  projects: baseConfig.projects.map((project) => ({
    ...project,
    use: {
      ...project.use,
      browserName,
      headless: !webglMode,
    },
  })),
  webServer: {
    ...baseConfig.webServer,
    command: `PORT=${localPort} node scripts/local-playwright-server.mjs`,
    url: `http://127.0.0.1:${localPort}`,
    reuseExistingServer: false,
  },
};
