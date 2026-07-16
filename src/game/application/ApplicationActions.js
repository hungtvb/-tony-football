import { cloneAndFreezeContractValue } from "../engine/ContractValue.js";

export const ApplicationActionType = Object.freeze({
  START_MATCH: "match:start",
  PAUSE_MATCH: "match:pause",
  RESUME_MATCH: "match:resume",
  TOGGLE_PAUSE: "match:toggle-pause",
  RESTART_MATCH: "match:restart",
  OPEN_MATCH_SETUP: "navigation:match-setup",
  OPEN_MAIN_MENU: "navigation:main-menu"
});

const applicationActionTypes = new Set(Object.values(ApplicationActionType));

export function createApplicationAction(type, payload = {}) {
  if (!applicationActionTypes.has(type)) throw new TypeError(`Unknown application action: ${type}`);
  return Object.freeze({
    type,
    payload: cloneAndFreezeContractValue(payload, "application action payload")
  });
}
