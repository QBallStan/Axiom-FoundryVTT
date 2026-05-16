function getHtmlRoot(html) {
  if (html instanceof HTMLElement) return html;
  if (html?.[0] instanceof HTMLElement) return html[0];
  return null;
}

function getActionPointData(actor) {
  const data = actor?.system?.trackers?.actionPoints;
  if (!data) return null;

  const current = Number(data.current ?? 0);
  const min = Number(data.min ?? 0);
  const rawMax = Number(data.max ?? 0);
  const max = Number.isFinite(rawMax) ? Math.max(0, rawMax) : 0;
  const safeCurrent = Number.isFinite(current) ? current : 0;

  return {
    current: Math.min(safeCurrent, max),
    min: Number.isFinite(min) ? min : 0,
    max: Number.isFinite(max) ? max : 0
  };
}


function getMovementData(actor, combatant = null) {
  if (!actor) return null;

  const max = Number(actor.system?.subAttributes?.movement ?? 0);
  const used = Number(combatant?.getFlag?.("axiom", "movementUsed") ?? 0);
  const safeMax = Number.isFinite(max) ? Math.max(0, Math.trunc(max)) : 0;
  const safeUsed = Number.isFinite(used) ? used : 0;

  return {
    used: safeUsed,
    remaining: Math.round((safeMax - safeUsed) * 10) / 10,
    max: safeMax
  };
}

function canUpdateActionPoints(actor) {
  if (!actor) return false;
  if (game.user?.isGM) return true;
  return actor.testUserPermission?.(game.user, "OWNER") ?? false;
}

function canUpdateMovement(actor) {
  return canUpdateActionPoints(actor);
}

const AXIOM_INITIATIVE_ICON = "systems/axiom/assets/icons/d10.svg";

function getCombatTurns(combat) {
  return Array.from(combat?.turns ?? []);
}

function combatantHasActionPoints(combatant, combat = null, index = null) {
  const data = getActionPointData(combatant?.actor);
  if (!data) return false;

  let current = data.current;
  const isCurrent = combat && Number.isInteger(index) && index === combat.turn;
  if (isCurrent) {
    const startAp = Number(combatant.getFlag?.("axiom", "activationStartAp"));
    if (Number.isFinite(startAp) && startAp > 0 && current >= startAp && current > data.min) {
      current -= 1;
    }
  }

  return current > 0;
}

function getAxiomPass(combat) {
  const value = Number(combat?.getFlag?.("axiom", "pass") ?? 1);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function getNextAxiomActivation(combat) {
  const turns = getCombatTurns(combat);
  if (!combat?.started || !turns.length) return null;

  const currentTurn = Number.isInteger(combat.turn) ? combat.turn : -1;
  const currentPass = getAxiomPass(combat);

  for (let index = currentTurn + 1; index < turns.length; index += 1) {
    if (combatantHasActionPoints(turns[index], combat, index)) return { turn: index, pass: currentPass, wraps: false };
  }

  for (let index = 0; index <= currentTurn; index += 1) {
    if (combatantHasActionPoints(turns[index], combat, index)) return { turn: index, pass: currentPass + 1, wraps: true };
  }

  return null;
}

function getSmartAdvanceLabel(combat) {
  const next = getNextAxiomActivation(combat);
  if (!next) return game.i18n.localize("AXIOM.CombatTracker.NextRound");
  if (next.wraps) return game.i18n.localize("AXIOM.CombatTracker.NextPass");
  return game.i18n.localize("AXIOM.CombatTracker.NextTurn");
}

function getSmartAdvanceIcon(combat) {
  const next = getNextAxiomActivation(combat);
  if (!next) return "fa-solid fa-rotate-right";
  if (next.wraps) return "fa-solid fa-forward-step";
  return "fa-solid fa-arrow-right";
}

async function advanceAxiomCombat(event) {
  event.preventDefault();
  event.stopPropagation();
  if (!game.user?.isGM || !game.combat) return;
  await game.combat.nextTurn();
}

async function forceAxiomNextCombatant(event) {
  event.preventDefault();
  event.stopPropagation();
  if (!game.user?.isGM || !game.combat) return;
  if (typeof game.combat.forceNextTurn === "function") await game.combat.forceNextTurn();
  else await game.combat.nextTurn();
}

function buildAxiomCombatControls(combat) {
  const controls = document.createElement("div");
  controls.className = "axiom-combat-tracker-controls";

  const pass = document.createElement("div");
  pass.className = "axiom-combat-pass-label";
  pass.textContent = game.i18n.format("AXIOM.CombatTracker.PassLabel", { pass: getAxiomPass(combat) });
  controls.append(pass);

  const smartButton = document.createElement("button");
  smartButton.type = "button";
  smartButton.className = "axiom-combat-control axiom-combat-control-primary";
  smartButton.dataset.action = "axiomAdvanceCombat";
  smartButton.dataset.tooltip = game.i18n.localize("AXIOM.CombatTracker.SmartAdvanceHint");
  smartButton.innerHTML = `<i class="${getSmartAdvanceIcon(combat)}"></i><span>${getSmartAdvanceLabel(combat)}</span>`;
  smartButton.addEventListener("click", advanceAxiomCombat);
  controls.append(smartButton);

  const forceButton = document.createElement("button");
  forceButton.type = "button";
  forceButton.className = "axiom-combat-control axiom-combat-control-secondary";
  forceButton.dataset.action = "axiomForceNextCombatant";
  forceButton.dataset.tooltip = game.i18n.localize("AXIOM.CombatTracker.ForceNextHint");
  forceButton.innerHTML = `<i class="fa-solid fa-forward"></i><span>${game.i18n.localize("AXIOM.CombatTracker.ForceNext")}</span>`;
  forceButton.addEventListener("click", forceAxiomNextCombatant);
  controls.append(forceButton);

  return controls;
}

function addAxiomCombatControls(root, combat) {
  if (!game.user?.isGM || !combat?.started) return;
  root.querySelector(".axiom-combat-tracker-controls")?.remove();

  const controls = buildAxiomCombatControls(combat);
  const tracker = root.querySelector("ol.combat-tracker") ?? root.querySelector(".combat-tracker") ?? root;
  tracker.insertAdjacentElement("beforebegin", controls);
}

function updateNativeNextTurnControls(root, combat) {
  if (!combat?.started) return;

  const label = getSmartAdvanceLabel(combat);
  const tooltip = game.i18n.localize("AXIOM.CombatTracker.SmartAdvanceHint");
  const selectors = [
    '[data-action="nextTurn"]',
    '[data-action="nextRound"]',
    'button.combat-control[data-control="nextTurn"]',
    'button.combat-control[data-control="nextRound"]'
  ].join(",");

  root.querySelectorAll(selectors).forEach(button => {
    if (button.closest(".axiom-combat-tracker-controls")) return;
    button.dataset.tooltip = tooltip;
    button.setAttribute("aria-label", label);
    button.title = label;
    const text = button.querySelector("span") ?? button.querySelector("label");
    if (text) text.textContent = label;
  });
}


function replaceInitiativeIcons(root) {
  root.querySelectorAll("i.fa-dice-d20").forEach(icon => {
    icon.classList.remove("fa-dice-d20");
    icon.classList.add("fa-dice-d10");
  });

  root.querySelectorAll('button.combatant-control.roll[data-action="rollInitiative"]').forEach(button => {
    const iconUrl = `url('${AXIOM_INITIATIVE_ICON}')`;
    button.style.setProperty("--initiative-icon", iconUrl);
    button.style.setProperty("--initiative-icon-hover", iconUrl);
    button.style.setProperty("background-image", iconUrl);
    button.classList.add("axiom-roll-initiative");
  });
}

function findCombatantRow(root, combatant) {
  return root.querySelector(`[data-combatant-id="${combatant.id}"]`)
    ?? root.querySelector(`[data-combatant-id="${combatant._id}"]`)
    ?? root.querySelector(`[data-id="${combatant.id}"]`)
    ?? root.querySelector(`[data-document-id="${combatant.id}"]`);
}

function findInsertionPoint(row) {
  return row.querySelector(".token-name")
    ?? row.querySelector(".combatant-name")
    ?? row.querySelector(".name")
    ?? row.querySelector("h4")
    ?? row;
}

function buildActionPointTracker(combatant, actor, data) {
  const tracker = document.createElement("div");
  tracker.className = "axiom-combatant-ap";
  tracker.dataset.combatantId = combatant.id;
  tracker.dataset.tooltip = game.i18n.localize("AXIOM.CombatTracker.ActionPointsHint");
  tracker.setAttribute("role", "button");
  tracker.setAttribute("tabindex", canUpdateActionPoints(actor) ? "0" : "-1");
  tracker.setAttribute("aria-label", game.i18n.localize("AXIOM.CombatTracker.ActionPoints"));

  const label = document.createElement("span");
  label.className = "axiom-combatant-ap-label";
  label.textContent = game.i18n.localize("AXIOM.CombatTracker.ActionPointsShort");
  tracker.append(label);

  const pips = document.createElement("span");
  pips.className = "axiom-combatant-ap-pips";

  for (let index = 0; index < Math.max(0, data.max); index += 1) {
    const pip = document.createElement("span");
    pip.className = `axiom-combatant-ap-pip${index < data.current ? " active" : ""}`;

    const icon = document.createElement("i");
    icon.className = "fa-solid fa-chevron-right";
    pip.append(icon);
    pips.append(pip);
  }

  tracker.append(pips);
  return tracker;
}

function formatMovementValue(value) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number)) return "0";
  return Number.isInteger(number) ? String(number) : number.toFixed(1).replace(/\.0$/, "");
}

function buildMovementTracker(combatant, actor, data) {
  const tracker = document.createElement("div");
  tracker.className = `axiom-combatant-movement${data.remaining < 0 ? " over" : ""}`;
  tracker.dataset.combatantId = combatant.id;
  tracker.dataset.tooltip = game.i18n.localize("AXIOM.CombatTracker.MovementHint");
  tracker.setAttribute("role", "button");
  tracker.setAttribute("tabindex", canUpdateMovement(actor) ? "0" : "-1");
  tracker.setAttribute("aria-label", game.i18n.localize("AXIOM.CombatTracker.Movement"));

  const label = document.createElement("span");
  label.className = "axiom-combatant-movement-label";
  label.textContent = game.i18n.localize("AXIOM.CombatTracker.MovementShort");
  tracker.append(label);

  const value = document.createElement("span");
  value.className = "axiom-combatant-movement-value";
  value.textContent = `${formatMovementValue(data.remaining)}m`;
  tracker.append(value);

  return tracker;
}

function buildCombatantResourcesTracker(combatant, actor, actionPointData, movementData) {
  const tracker = document.createElement("div");
  tracker.className = "axiom-combatant-resources";
  tracker.dataset.combatantId = combatant.id;

  const apTracker = buildActionPointTracker(combatant, actor, actionPointData);
  if (canUpdateActionPoints(actor)) {
    apTracker.addEventListener("click", adjustCombatantActionPoints);
    apTracker.addEventListener("contextmenu", adjustCombatantActionPoints);
    apTracker.addEventListener("dblclick", stopCombatantActionPointEvent);
    apTracker.addEventListener("keydown", onActionPointKeydown);
  }
  tracker.append(apTracker);

  if (movementData) {
    const movementTracker = buildMovementTracker(combatant, actor, movementData);
    if (canUpdateMovement(actor)) {
      movementTracker.addEventListener("click", adjustCombatantMovement);
      movementTracker.addEventListener("contextmenu", adjustCombatantMovement);
      movementTracker.addEventListener("dblclick", stopCombatantActionPointEvent);
      movementTracker.addEventListener("keydown", onMovementKeydown);
    }
    tracker.append(movementTracker);
  }

  return tracker;
}

function stopCombatantActionPointEvent(event) {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
}

async function adjustCombatantActionPoints(event) {
  stopCombatantActionPointEvent(event);

  const combatantId = event.currentTarget?.dataset?.combatantId;
  const combatant = game.combat?.combatants?.get?.(combatantId) ?? game.combat?.combatants?.find?.(entry => entry.id === combatantId);
  const actor = combatant?.actor;
  if (!actor || !canUpdateActionPoints(actor)) return;

  const data = getActionPointData(actor);
  if (!data) return;

  const direction = event.type === "contextmenu" ? 1 : -1;
  const next = Math.min(data.max, Math.max(data.min, data.current + direction));
  if (next === data.current) return;

  await actor.update({ "system.trackers.actionPoints.current": next });
  ui.combat?.render?.();
}

function onActionPointKeydown(event) {
  if (!["Enter", " "].includes(event.key)) return;
  adjustCombatantActionPoints(event);
}

async function adjustCombatantMovement(event) {
  stopCombatantActionPointEvent(event);

  const combatantId = event.currentTarget?.dataset?.combatantId;
  const combatant = game.combat?.combatants?.get?.(combatantId) ?? game.combat?.combatants?.find?.(entry => entry.id === combatantId);
  const actor = combatant?.actor;
  if (!combatant || !actor || !canUpdateMovement(actor)) return;

  const data = getMovementData(actor, combatant);
  if (!data) return;

  // The tracker displays remaining movement, but the stored flag tracks movement spent.
  // Left click spends 1 m. Right click adds 1 m back, which also supports sprinting
  // or other effects that increase available movement for the round.
  const deltaUsed = event.type === "contextmenu" ? -1 : 1;
  const next = Math.round((data.used + deltaUsed) * 10) / 10;
  if (next === data.used) return;

  await combatant.setFlag?.("axiom", "movementUsed", next);
  ui.combat?.render?.();
}

function onMovementKeydown(event) {
  if (!["Enter", " "].includes(event.key)) return;
  adjustCombatantMovement(event);
}

function addCombatantResourceTrackers(root, combat) {
  if (!combat) return;

  for (const combatant of combat.combatants ?? []) {
    const actor = combatant.actor;
    const actionPointData = getActionPointData(actor);
    if (!actor || !actionPointData) continue;

    const row = findCombatantRow(root, combatant);
    if (!row || row.querySelector(".axiom-combatant-resources")) continue;

    const movementData = getMovementData(actor, combatant);
    const tracker = buildCombatantResourcesTracker(combatant, actor, actionPointData, movementData);
    const insertionPoint = findInsertionPoint(row);
    insertionPoint.insertAdjacentElement("afterend", tracker);
  }
}

export function registerAxiomCombatTracker() {
  Hooks.on("renderCombatTracker", (app, html) => {
    const root = getHtmlRoot(html);
    if (!root) return;

    replaceInitiativeIcons(root);
    updateNativeNextTurnControls(root, game.combat);
    addAxiomCombatControls(root, game.combat);
    addCombatantResourceTrackers(root, game.combat);
  });

  Hooks.on("updateActor", (actor, changed) => {
    const changedAp = foundry.utils.hasProperty(changed, "system.trackers.actionPoints.current")
      || foundry.utils.hasProperty(changed, "system.trackers.actionPoints.max")
      || foundry.utils.hasProperty(changed, "system.statuses.stunned");
    const changedMovement = foundry.utils.hasProperty(changed, "system.subAttributes.movement")
      || foundry.utils.hasProperty(changed, "system.attributes.agility")
      || foundry.utils.hasProperty(changed, "system.statuses.chilled")
      || foundry.utils.hasProperty(changed, "system.statuses.entangled")
      || foundry.utils.hasProperty(changed, "system.statuses.stunned");
    if (!changedAp && !changedMovement) return;
    if (![...(game.combat?.combatants ?? [])].some(combatant => combatant.actor?.id === actor.id)) return;
    ui.combat?.render?.();
  });

  Hooks.on("updateCombatant", (combatant, changed) => {
    if (!foundry.utils.hasProperty(changed, "flags.axiom.movementUsed")) return;
    if (combatant.parent?.id !== game.combat?.id) return;
    ui.combat?.render?.();
  });
}
