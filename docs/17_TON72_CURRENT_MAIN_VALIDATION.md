# TON-72 current-main validation manifest

## Scope

This checkpoint validates audited main `a941ef09550e17e904ffacaab683a1135352c623` without changing gameplay, presentation behavior, compatibility bridges or deployment configuration.

TON-85 / PR #99 remains frozen. This document and its exact-head CI evidence do not authorize bridge removal or merge activity by DEV.

## Acceptance boundary

Evidence must be produced through the public runtime, immutable commands, snapshots and presentation consumers. Direct mutation of possession, score, goal, replay, clock, player, ball or other gameplay state is forbidden as acceptance evidence.

## Executable commands

The required pull-request CI runs these repository-owned commands on the exact evidence head:

```sh
npm ci
npm run test:ci:fast
npm run test:e2e:smoke
npm run test:e2e:asset-smoke
npm run test:e2e:golden
npm run test:e2e:p1-parity
```

The aggregate `CI gate` must require all five jobs below to succeed:

1. `Unit and contracts`
2. `Browser composition smoke`
3. `Real asset appearance smoke`
4. `Golden match lifecycle`
5. `TON-94 P1 browser parity`

## Coverage map

| TON-72 requirement | Executable evidence |
| --- | --- |
| deterministic engine, integration, commands, contracts, lifecycle and build | `npm run test:ci:fast` |
| production composition, keyboard/application boundary, snapshots/events, WebGL, forced Canvas, pause/resume and context restore | `npm run test:e2e:smoke` |
| real models, kits, boots, animation and ball appearance | `npm run test:e2e:asset-smoke` |
| natural goal, goal/score cards, replay, kickoff recovery, restart, second match and Canvas lifecycle | `npm run test:e2e:golden` |
| controls/statistics chronology, public-command two-goal isolation, rendered card timing, Full Time/play-again, forced Canvas and narrow viewport parity | `npm run test:e2e:p1-parity` |

The P1 parity harness is advance-only for deterministic time progression. Goals, possession and player actions are reached through browser input/public immutable commands; acceptance must not use write-enabled gameplay mutation seams.

## Terminal evidence contract

Before DEV hands this exact head to Reviewer and SA, durable evidence must include:

- exact evidence/change SHA and baseline SHA;
- successful required GitHub CI jobs plus aggregate gate;
- zero unresolved blocking review threads;
- no open P0/P1 regression found by the executed scope;
- Vercel `Ready`, or explicit `WAIVED — Vercel capacity limit` only when the failure is proven to be platform capacity;
- fresh exact-head Reviewer and required SA routes.

Any application build, test, configuration, runtime or deployment defect remains blocking. Any head movement invalidates the evidence and requires a fresh run and fresh routes.
