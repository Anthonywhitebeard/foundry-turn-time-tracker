const MODULE_ID = "turn-time-tracker";
const FLAG_SCOPE = MODULE_ID;
const STATE_FLAG = "state";
const TICK_MS = 250;

const state = {
  interval: null,
  trackerElement: null,
  lastCombatId: null
};

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "showNPCs", {
    name: game.i18n.localize("CTT.Settings.ShowNPCs.Name"),
    hint: game.i18n.localize("CTT.Settings.ShowNPCs.Hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    restricted: true,
    onChange: () => renderTimers()
  });

  game.settings.register(MODULE_ID, "showOnlyOwnedToPlayers", {
    name: game.i18n.localize("CTT.Settings.ShowOnlyOwnedToPlayers.Name"),
    hint: game.i18n.localize("CTT.Settings.ShowOnlyOwnedToPlayers.Hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    restricted: true,
    onChange: () => renderTimers()
  });
});

Hooks.once("ready", () => {
  startTicker();
  initializeActiveCombat();
});

Hooks.on("renderCombatTracker", (_app, html) => {
  state.trackerElement = normalizeElement(html);
  renderTimers();
});

Hooks.on("renderApplicationV2", (app, element) => {
  if (app?.constructor?.name !== "CombatTracker") return;
  state.trackerElement = normalizeElement(element);
  renderTimers();
});

Hooks.on("createCombatant", () => renderTimers());
Hooks.on("deleteCombatant", () => renderTimers());

Hooks.on("combatStart", async (combat) => {
  if (!game.user.isGM) return;
  await writeFreshState(combat);
});

Hooks.on("updateCombat", async (combat, changed) => {
  if (changed.active === false) {
    clearTrackerTimers();
    return;
  }

  const turnChanged = "turn" in changed || "round" in changed;
  if (game.user.isGM && turnChanged) await finalizeAndAdvance(combat);
  renderTimers();
});

Hooks.on("deleteCombat", (combat) => {
  if (combat.id === state.lastCombatId) clearTrackerTimers();
});

function initializeActiveCombat() {
  const combat = getActiveCombat();
  if (!combat?.started) {
    clearTrackerTimers();
    return;
  }

  state.lastCombatId = combat.id;
  if (game.user.isGM && !combat.getFlag(FLAG_SCOPE, STATE_FLAG)) {
    writeFreshState(combat);
  }
  renderTimers();
}

function startTicker() {
  if (state.interval) window.clearInterval(state.interval);
  state.interval = window.setInterval(renderTimers, TICK_MS);
}

async function writeFreshState(combat) {
  const now = Date.now();
  const activeCombatant = combat.combatant ?? combat.turns?.[combat.turn];

  state.lastCombatId = combat.id;
  await combat.setFlag(FLAG_SCOPE, STATE_FLAG, {
    totals: {},
    activeCombatantId: activeCombatant?.id ?? null,
    turnStartedAt: now,
    updatedAt: now
  });
}

async function finalizeAndAdvance(combat) {
  const now = Date.now();
  const currentState = combat.getFlag(FLAG_SCOPE, STATE_FLAG);
  if (!currentState) {
    await writeFreshState(combat);
    return;
  }

  const totals = foundry.utils.deepClone(currentState.totals ?? {});
  const previousId = currentState.activeCombatantId;
  const previousStart = Number(currentState.turnStartedAt) || now;

  if (previousId) {
    const elapsed = Math.max(0, now - previousStart);
    totals[previousId] = Math.max(0, Number(totals[previousId]) || 0) + elapsed;
  }

  const activeCombatant = combat.combatant ?? combat.turns?.[combat.turn];
  await combat.setFlag(FLAG_SCOPE, STATE_FLAG, {
    totals,
    activeCombatantId: activeCombatant?.id ?? null,
    turnStartedAt: now,
    updatedAt: now
  });
}

function renderTimers() {
  const tracker = getCombatTrackerElement();
  const combat = getActiveCombat();

  if (!tracker || !combat?.started) {
    clearTrackerTimers();
    return;
  }

  state.lastCombatId = combat.id;

  const timerState = combat.getFlag(FLAG_SCOPE, STATE_FLAG) ?? makeTransientState(combat);
  const now = Date.now();
  const visibleCombatantIds = new Set();

  for (const [index, combatant] of (combat.turns ?? []).entries()) {
    if (!shouldRenderCombatant(combatant)) continue;

    const row = getCombatantRow(tracker, combatant, index);
    if (!row) continue;

    const combatantId = combatant.id;
    const isActive = timerState.activeCombatantId === combatantId;
    const elapsedThisTurn = isActive ? Math.max(0, now - (Number(timerState.turnStartedAt) || now)) : 0;
    const storedTotal = Math.max(0, Number(timerState.totals?.[combatantId]) || 0);
    const total = storedTotal + elapsedThisTurn;

    visibleCombatantIds.add(combatantId);
    upsertTimer(row, combatantId, {
      name: combatant.name,
      isActive,
      current: elapsedThisTurn,
      total
    });
  }

  removeStaleTimers(tracker, visibleCombatantIds);
}

function clearTrackerTimers() {
  for (const timer of document.querySelectorAll(".ctt-tracker-timer")) timer.remove();
}

function getActiveCombat() {
  const viewedCombat = game.combats?.viewed;
  if (viewedCombat?.active) return viewedCombat;

  const activeSceneCombat = game.combats?.contents?.find((combat) => combat.active && combat.scene?.id === canvas?.scene?.id);
  return activeSceneCombat ?? game.combat;
}

function makeTransientState(combat) {
  const activeCombatant = combat.combatant ?? combat.turns?.[combat.turn];
  return {
    totals: {},
    activeCombatantId: activeCombatant?.id ?? null,
    turnStartedAt: Date.now()
  };
}

function shouldRenderCombatant(combatant) {
  const actor = combatant.actor;
  if (!actor) return false;

  if (!game.user.isGM && game.settings.get(MODULE_ID, "showOnlyOwnedToPlayers") && !actor.isOwner) {
    return false;
  }

  if (game.settings.get(MODULE_ID, "showNPCs")) return true;
  return Boolean(actor.hasPlayerOwner || actor.type === "character");
}

function getCombatTrackerElement() {
  if (state.trackerElement?.isConnected) return state.trackerElement;

  const candidates = [
    ui.combat?.element,
    document.querySelector("#combat"),
    document.querySelector("#combat-tracker"),
    document.querySelector(".combat-tracker"),
    document.querySelector("[data-tab='combat']")
  ];

  for (const candidate of candidates) {
    const element = normalizeElement(candidate);
    if (element?.isConnected) {
      state.trackerElement = element;
      return element;
    }
  }

  return null;
}

function normalizeElement(value) {
  if (value instanceof HTMLElement) return value;
  if (value?.[0] instanceof HTMLElement) return value[0];
  if (value?.element instanceof HTMLElement) return value.element;
  if (value?.element?.[0] instanceof HTMLElement) return value.element[0];
  return null;
}

function getCombatantRow(tracker, combatant, index) {
  const id = cssEscape(combatant.id);
  const selectors = [
    `[data-combatant-id="${id}"]`,
    `[data-document-id="${id}"]`,
    `[data-entry-id="${id}"]`,
    `[data-id="${id}"]`
  ];

  for (const selector of selectors) {
    const row = tracker.querySelector(selector);
    if (row) return row.closest(".combatant, li, [data-combatant-id], [data-document-id], [data-entry-id]") ?? row;
  }

  const rows = tracker.querySelectorAll(".combatant, li[data-combatant-id], li[data-document-id], li[data-entry-id]");
  return rows[index] ?? null;
}

function upsertTimer(row, combatantId, data) {
  let timer = row.querySelector(".ctt-tracker-timer");
  if (!timer) {
    timer = document.createElement("div");
    timer.className = "ctt-tracker-timer";
    timer.dataset.combatantId = combatantId;
    insertTimer(row, timer);
  }

  timer.classList.toggle("ctt-active", data.isActive);
  timer.title = data.name ?? "";
  timer.innerHTML = `
    <span class="ctt-part">
      <span class="ctt-label">${game.i18n.localize("CTT.Timer.Current")}</span>
      <span class="ctt-value">${formatDuration(data.current)}</span>
    </span>
    <span class="ctt-part">
      <span class="ctt-label">${game.i18n.localize("CTT.Timer.Total")}</span>
      <span class="ctt-value">${formatDuration(data.total)}</span>
    </span>
  `;
}

function insertTimer(row, timer) {
  const target = row.querySelector(".token-name, .combatant-name, .name, h4") ?? row;
  target.appendChild(timer);
}

function removeStaleTimers(tracker, visibleCombatantIds) {
  for (const timer of tracker.querySelectorAll(".ctt-tracker-timer")) {
    if (!visibleCombatantIds.has(timer.dataset.combatantId)) timer.remove();
  }
}

function cssEscape(value) {
  return globalThis.CSS?.escape ? CSS.escape(value) : String(value).replaceAll('"', '\\"');
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }

  return `${minutes}:${pad(seconds)}`;
}

function pad(value) {
  return String(value).padStart(2, "0");
}
