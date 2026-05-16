const TOKEN_MOVEMENT_CACHE = new Map();

function getTokenMovementKey(document) {
  return document?.uuid ?? `${document?.parent?.id ?? canvas?.scene?.id ?? "scene"}.${document?.id ?? "token"}`;
}

function getTokenCenter(document, source = null) {
  const data = source ?? document;
  const gridSize = Number(canvas?.scene?.grid?.size ?? canvas?.grid?.size ?? 100) || 100;
  const width = Number(document?.width ?? data?.width ?? 1) || 1;
  const height = Number(document?.height ?? data?.height ?? 1) || 1;
  return {
    x: Number(data?.x ?? 0) + (width * gridSize / 2),
    y: Number(data?.y ?? 0) + (height * gridSize / 2)
  };
}

function formatDistance(value) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number)) return "0";
  const rounded = Math.round(number * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function measureTokenMovement(document, changes, cached = null) {
  if (!foundry.utils.hasProperty(changes, "x") && !foundry.utils.hasProperty(changes, "y")) return 0;

  const before = cached
    ? getTokenCenter(document, cached.before)
    : getTokenCenter(document);
  const after = cached
    ? getTokenCenter(document, cached.after)
    : getTokenCenter(document, {
      x: changes.x ?? document.x,
      y: changes.y ?? document.y,
      width: changes.width ?? document.width,
      height: changes.height ?? document.height
    });

  const gridSize = Number(canvas?.scene?.grid?.size ?? canvas?.grid?.size ?? 100) || 100;
  const gridDistance = Number(canvas?.scene?.grid?.distance ?? 1) || 1;
  const distance = Math.hypot(after.x - before.x, after.y - before.y) / gridSize * gridDistance;
  return Number.isFinite(distance) ? Math.round(distance * 10) / 10 : 0;
}

function getTokenCombatant(document) {
  const combat = game.combat;
  if (!combat?.started || !document) return null;

  const sceneId = document.parent?.id ?? document.scene?.id ?? canvas?.scene?.id;
  return combat.combatants?.find?.(combatant => {
    if (combatant.tokenId !== document.id) return false;
    if (combatant.sceneId && sceneId && combatant.sceneId !== sceneId) return false;
    return true;
  }) ?? null;
}

function getMovementMax(actor) {
  const value = Number(actor?.system?.subAttributes?.movement ?? 0);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

async function addMovementUsed(combatant, distance) {
  if (!combatant || !Number.isFinite(distance) || distance <= 0) return;

  const actor = combatant.actor;
  const max = getMovementMax(actor);
  const previousValue = Number(combatant.getFlag?.("axiom", "movementUsed") ?? 0);
  const previous = Number.isFinite(previousValue) ? previousValue : 0;
  const used = Math.round((previous + distance) * 10) / 10;
  const remainingBefore = Math.max(0, max - previous);

  const updates = { "flags.axiom.movementUsed": used };
  const round = Number(game.combat?.round ?? 0) || 0;
  const warningRound = Number(combatant.getFlag?.("axiom", "movementWarningRound"));

  if (used > max && warningRound !== round) {
    updates["flags.axiom.movementWarningRound"] = round;
    const name = actor?.name ?? combatant.name ?? game.i18n.localize("DOCUMENT.Token");
    ui.notifications?.warn(game.i18n.format("AXIOM.CombatTracker.MovementExceeded", {
      name,
      moved: formatDistance(distance),
      remaining: formatDistance(remainingBefore)
    }));
  }

  await combatant.update(updates);
  ui.combat?.render?.();
}

export function registerAxiomMovementTracking() {
  Hooks.on("preUpdateToken", (document, changes) => {
    if (!foundry.utils.hasProperty(changes, "x") && !foundry.utils.hasProperty(changes, "y")) return;

    TOKEN_MOVEMENT_CACHE.set(getTokenMovementKey(document), {
      before: {
        x: document.x,
        y: document.y,
        width: document.width,
        height: document.height
      },
      after: {
        x: changes.x ?? document.x,
        y: changes.y ?? document.y,
        width: changes.width ?? document.width,
        height: changes.height ?? document.height
      }
    });
  });

  Hooks.on("updateToken", async (document, changes) => {
    if (!game.user?.isGM) return;

    const key = getTokenMovementKey(document);
    const cached = TOKEN_MOVEMENT_CACHE.get(key);
    TOKEN_MOVEMENT_CACHE.delete(key);

    const distance = measureTokenMovement(document, changes, cached);
    if (distance <= 0) return;

    const combatant = getTokenCombatant(document);
    if (!combatant?.actor) return;

    await addMovementUsed(combatant, distance);
  });
}
