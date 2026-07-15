# Playwright Browser and Visual Validation

## Purpose
Use a real Chromium browser to validate camera framing, radar visibility, responsive HUD layout, pause/replay smoke paths, and deterministic presentation states.

## Commands

```bash
npm install
npx playwright install chromium
npm run test:e2e
npm run test:e2e:report
```

## Deterministic scenarios
The game accepts `debugScenario` query parameters and also exposes `window.__TONY_DEBUG__` during browser validation.

- `?debugScenario=normal-play`
- `?debugScenario=lower-left-camera`
- `?debugScenario=lower-right-camera`
- `?debugScenario=radar-crowded`
- `?debugScenario=low-stamina`
- `?debugScenario=replay`

These scenarios are test fixtures only. They do not change normal gameplay unless explicitly selected by the query parameter or debug API.

## Current coverage
- Chromium desktop viewport: 1440 × 900
- Chromium narrow landscape viewport: 844 × 390
- console and page-error detection
- lower-left and lower-right camera scenarios
- commentary/radar overlap geometry
- radar screenshot evidence
- low-stamina HUD state
- pause/resume and replay smoke paths
- screenshot, trace, and video retention on failure

## CI evidence
GitHub Actions uploads `u3-1-playwright-evidence` after every run. The artifact contains:

- Playwright HTML report
- deterministic scenario screenshots
- traces, screenshots, and video for failures

## Visual regression roadmap
The first stable CI screenshots become the reviewed baseline. After approval, switch critical scenarios to `expect(page).toHaveScreenshot()` so pixel differences fail CI. Keep geometry assertions as the primary non-flaky safety layer.

## Maintenance rules
- Keep scenarios deterministic and independent of random gameplay.
- Do not expose debug controls in the normal UI.
- Keep browser checks presentation-only; they must not change gameplay balance.
- Update screenshots only after reviewing the rendered difference.
- Preserve both desktop and narrow-landscape projects.
