/* -------------------------------------------- */
/*  Axiom//Core Token HUD Status Controls       */
/* -------------------------------------------- */

const COVER_STATUS_ORDER = ["lightCover", "mediumCover", "heavyCover"];

/**
 * Token HUD variant that treats status controls as stack controls.
 *
 * WFRP4e replaces Foundry's default TokenHUD effect toggler and routes status
 * controls to stack-aware actor helpers. Axiom does the same, but also binds a
 * capture-phase fallback to the rendered HUD because V14 / modules may keep
 * already-rendered default listeners around.
 */
export default class AxiomTokenHUD extends foundry.applications.hud.TokenHUD {
  async _onToggleEffect(event, { overlay = false } = {}) {
    return handleAxiomTokenHudStatusClick(event, this.object, { overlay });
  }

  activateListeners(html) {
    super.activateListeners(html);

    orderAxiomTokenHudCoverControls(getHudRootElement(html));

    const effectsTray = html.find?.(".status-effects, .condition-effects");

    if (effectsTray?.length) {
      effectsTray.off("click", ".effect-control");
      effectsTray.off("contextmenu", ".effect-control");
      effectsTray.off("mousedown", ".effect-control");
      effectsTray.off("pointerdown", ".effect-control");

      effectsTray.on("click", ".effect-control", event => this._onToggleEffect(event));
      effectsTray.on("contextmenu", ".effect-control", event => this._onToggleEffect(event, { overlay: true }));
      return;
    }

    for (const control of html.find?.(".effect-control") ?? []) {
      wireEffectControl(control, this.object);
    }
  }
}

/** Replace Foundry's token HUD with the Axiom stack-aware variant. */
export function registerAxiomTokenHUD() {
  Hooks.on("canvasReady", canvas => {
    if (!canvas?.hud) return;
    canvas.hud.token = new AxiomTokenHUD();
  });

  Hooks.on("renderTokenHUD", (app, html) => wireRenderedTokenHud(app, html));
}

function wireRenderedTokenHud(app, html) {
  const root = getHudRootElement(html);
  if (!root) return;

  orderAxiomTokenHudCoverControls(root);

  if (root.dataset.axiomStatusHudWired === "true") return;
  root.dataset.axiomStatusHudWired = "true";

  // Right-click native deletion can fire from pointer/mouse handlers before the
  // browser contextmenu event. Block the full right-click chain in capture
  // phase, but only apply the Axiom stack decrement on contextmenu. Calling
  // removeStatus on every right-click event removes multiple stacks.
  for (const eventName of ["pointerdown", "mousedown", "mouseup", "auxclick", "contextmenu"]) {
    root.addEventListener(eventName, event => {
      const control = getAxiomStatusControl(event, root);
      if (!control || !isRightClickEvent(event)) return;

      blockNativeStatusEvent(event);
      if (event.type === "contextmenu") handleAxiomTokenHudStatusClick(event, app.object, { overlay: true });
    }, true);
  }

  // Left-click can remain on click, but still capture and stop it before the
  // native Foundry toggle handler gets a chance to remove an existing status.
  root.addEventListener("click", event => {
    const control = getAxiomStatusControl(event, root);
    if (!control || isRightClickEvent(event)) return;
    handleAxiomTokenHudStatusClick(event, app.object, { overlay: false });
  }, true);

  for (const control of root.querySelectorAll(".effect-control")) {
    wireEffectControl(control, app.object);
  }
}

function orderAxiomTokenHudCoverControls(root) {
  if (!root) return;

  const tray = root.querySelector(".status-effects, .condition-effects");
  if (!tray) return;

  const coverControls = COVER_STATUS_ORDER
    .map(statusId => tray.querySelector(`.effect-control[data-status-id="${statusId}"]`))
    .filter(Boolean);

  if (!coverControls.length) return;

  // Foundry V14 prepares the Token HUD effect list alphabetically by label.
  // Keep the localized names clean, but move cover levels to the end in rule order.
  for (const control of coverControls) tray.appendChild(control);
}

function getHudRootElement(html) {
  if (!html) return null;
  if (html instanceof HTMLElement) return html;
  if (html[0] instanceof HTMLElement) return html[0];
  if (html.jquery && html[0] instanceof HTMLElement) return html[0];
  return null;
}

function wireEffectControl(control, token) {
  if (!control || control.dataset.axiomStatusControlWired === "true") return;
  control.dataset.axiomStatusControlWired = "true";

  for (const eventName of ["pointerdown", "mousedown", "mouseup", "auxclick", "contextmenu"]) {
    control.addEventListener(eventName, event => {
      if (!isRightClickEvent(event)) return;

      blockNativeStatusEvent(event);
      if (event.type === "contextmenu") handleAxiomTokenHudStatusClick(event, token, { overlay: true });
    }, true);
  }

  control.addEventListener("click", event => {
    if (isRightClickEvent(event)) return;
    handleAxiomTokenHudStatusClick(event, token, { overlay: false });
  }, true);
}

function getAxiomStatusControl(event, root) {
  const control = event.target?.closest?.(".effect-control");
  if (!control || !root.contains(control)) return null;
  return control;
}

function isRightClickEvent(event) {
  return event.type === "contextmenu" || event.button === 2 || event.buttons === 2;
}

function blockNativeStatusEvent(event) {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
}

async function handleAxiomTokenHudStatusClick(event, token, { overlay = false } = {}) {
  blockNativeStatusEvent(event);

  const control = event.currentTarget?.dataset?.statusId
    ? event.currentTarget
    : event.target?.closest?.(".effect-control");

  const statusId = control?.dataset?.statusId;
  const actor = token?.actor;
  if (!actor || !statusId) return;

  const status = CONFIG.AXIOM?.statuses?.[statusId];
  const isRightClick = isRightClickEvent(event);

  if (status) {
    if (isRightClick) return actor.removeStatus?.(statusId, 1);
    return actor.addStatus?.(statusId, 1);
  }

  return actor.toggleStatusEffect?.(statusId, { active: !isRightClick, overlay });
}
