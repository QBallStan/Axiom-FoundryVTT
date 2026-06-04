const WOUND_ORDER = ["grazing", "minor", "major", "critical"];
const AXIOM_OVERLAY_NAME = "axiom-token-overlays";
const AXIOM_TOKEN_BAR_PATCH = Symbol.for("axiom.tokenBars.patch");
const PENDING_NPC_DEATH_MARKS = new Set();

const COLORS = {
  black: 0x040506,
  border: 0xe0d4b8,
  text: 0xf1e8ce,
  marker: 0xf7f0dd,
  goldTop: 0xfff2c0,
  goldMid: 0xd8a537,
  goldBottom: 0x7a4e12,
  empty: 0xe0d4b8,
  woundOutline: 0x160807,
  grazing: 0x5fb7d7,
  minor: 0x7b75dd,
  major: 0xb85ca6,
  critical: 0xc73a32,
};

const MOMENTUM_GRADIENT = [
  [0.0, "#8d161c"],
  [0.2, "#b72a23"],
  [0.39, "#d7772b"],
  [0.5, "#d6c25a"],
  [0.62, "#87b95a"],
  [0.81, "#3ba96e"],
  [1.0, "#197d4f"],
];

export function registerAxiomTokenOverlays() {
  patchAxiomTokenBars();

  Hooks.on("refreshToken", (token) => drawAxiomTokenOverlays(token));
  Hooks.on("drawToken", (token) => drawAxiomTokenOverlays(token));
  Hooks.on("destroyToken", (token) => clearAxiomTokenBars(token));
  Hooks.on("updateToken", (tokenDocument) =>
    refreshTokenDocumentOverlay(tokenDocument),
  );
  Hooks.on("canvasReady", () => {
    patchAxiomTokenBars();
    refreshSceneTokenOverlays();
    refreshSceneTokenBars();
  });

  Hooks.on("updateActor", (actor, changed) => {
    if (!isAxiomActor(actor)) return;

    const woundsChanged = foundry.utils.hasProperty(changed, "system.wounds");
    const statusChanged = foundry.utils.hasProperty(
      changed,
      "system.statuses.dead",
    ) || foundry.utils.hasProperty(changed, "system.statuses.stunned");
    const trackerChanged = foundry.utils.hasProperty(changed, "system.trackers.actionPoints")
      || foundry.utils.hasProperty(changed, "system.trackers.momentum");
    if (!woundsChanged && !statusChanged && !trackerChanged) return;

    if (woundsChanged) void markNpcCriticalWoundsDead(actor);
    refreshActorTokenOverlays(actor);
    if (trackerChanged) refreshActorTokenBars(actor);
  });
}

export function drawAxiomTokenOverlays(token) {
  if (!token?.actor || !isAxiomActor(token.actor)) return;

  const overlay = getOrCreateAxiomOverlayContainer(token);
  if (!overlay) return;

  clearContainer(overlay);
  overlay.visible = shouldDrawPrivateTokenOverlay(token);
  overlay.sortableChildren = true;
  overlay.interactive = false;
  overlay.interactiveChildren = false;
  overlay.eventMode = "none";

  if (!overlay.visible) return;

  if (token.actor.type === "npc") void markNpcCriticalWoundsDead(token.actor);

  const width = finiteNumber(
    token.w ?? token.bounds?.width ?? token.document?.width,
    0,
  );
  const height = finiteNumber(
    token.h ?? token.bounds?.height ?? token.document?.height,
    0,
  );
  if (width <= 0 || height <= 0) return;

  const wounds = getTakenWoundCounts(token.actor);
  const woundTracker = drawWoundTracker(wounds, width, height);
  if (woundTracker) overlay.addChild(woundTracker);
}

function patchAxiomTokenBars() {
  const TokenClass = foundry?.canvas?.placeables?.Token ?? globalThis.Token;
  const prototype = TokenClass?.prototype;
  if (!prototype?.drawBars || prototype[AXIOM_TOKEN_BAR_PATCH]) return;

  const baseDrawBars = prototype.drawBars;
  prototype.drawBars = function axiomDrawBars(...args) {
    if (!isAxiomActor(this.actor)) return baseDrawBars.apply(this, args);

    drawAxiomTokenResourcePips(this);
    return this;
  };

  prototype[AXIOM_TOKEN_BAR_PATCH] = true;
}

function drawAxiomTokenResourcePips(token) {
  const bars = getOrCreateBarsContainer(token);
  if (!bars) return;

  clearContainer(bars);
  bars.visible = shouldDrawPrivateTokenOverlay(token) && shouldDrawResourcePips(token);
  bars.eventMode = "none";
  bars.interactive = false;
  bars.interactiveChildren = false;

  if (!bars.visible) return;

  const width = finiteNumber(
    token.w ?? token.bounds?.width ?? token.document?.width,
    0,
  );
  const height = finiteNumber(
    token.h ?? token.bounds?.height ?? token.document?.height,
    0,
  );
  if (width <= 0 || height <= 0) return;

  const rows = [
    {
      attribute: token.document?.bar1?.attribute,
      key: "actionPoints",
      position: "bottom",
    },
    {
      attribute: token.document?.bar2?.attribute,
      key: "momentum",
      position: "top",
    },
  ];

  for (const row of rows) {
    const key = getTrackerKeyFromBarAttribute(row.attribute);
    if (!key || key !== row.key) continue;

    const tracker = getTrackerData(token.actor, key, { current: 0, min: 0, max: key === "momentum" ? 3 : 3 });
    const pips = drawResourcePipRow(key, tracker, width, height, row.position);
    if (pips) bars.addChild(pips);
  }
}

function getOrCreateBarsContainer(token) {
  if (token?.bars && !token.bars.destroyed) return token.bars;
  if (!globalThis.PIXI?.Container || typeof token?.addChild !== "function") return null;

  const bars = new PIXI.Container();
  bars.name = "bars";
  bars.zIndex = 900;
  token.sortableChildren = true;
  token.bars = token.addChild(bars);
  return token.bars;
}

function shouldDrawPrivateTokenOverlay(token) {
  return Boolean(token?.isOwner || token?.actor?.isOwner || game.user?.isGM);
}

function shouldDrawResourcePips(token) {
  const modes = globalThis.CONST?.TOKEN_DISPLAY_MODES ?? {};
  const mode = token?.document?.displayBars;

  if (mode === modes.NONE || mode === 0) return false;
  if (mode === modes.HOVER) return Boolean(token?.hover);
  if (mode === modes.OWNER_HOVER) return Boolean(token?.hover);

  return true;
}

function getTrackerKeyFromBarAttribute(attribute) {
  if (attribute === "trackers.actionPoints") return "actionPoints";
  if (attribute === "trackers.momentum") return "momentum";
  return null;
}

function drawResourcePipRow(key, data, tokenWidth, tokenHeight, position) {
  const current = Math.max(0, Math.floor(finiteNumber(data.current ?? data.value, 0)));
  if (current <= 0) return null;

  return key === "momentum"
    ? drawMomentumPipRow(current, tokenWidth, tokenHeight, position)
    : drawActionPointPipRow(current, tokenWidth, tokenHeight, position);
}

function drawMomentumPipRow(current, tokenWidth, tokenHeight, position) {
  const tickWidth = Math.round(clamp(tokenWidth * 0.096, 13, 18));
  const tickHeight = Math.round(clamp(tokenHeight * 0.024, 3, 5));
  const gap = Math.round(clamp(tokenWidth * 0.028, 4, 6));
  const width = current * tickWidth + Math.max(0, current - 1) * gap;

  const container = new PIXI.Container();
  container.name = "axiom-momentum-pips";
  container.zIndex = 10;
  container.x = Math.round((tokenWidth - width) / 2);
  const baseOffset = clamp(tokenHeight * 0.018, 3, 5);
  const inwardOffset = 14;
  container.y = position === "bottom"
    ? Math.round(tokenHeight + baseOffset - inwardOffset)
    : Math.round(-tickHeight - baseOffset + inwardOffset);

  for (let index = 0; index < current; index += 1) {
    const pip = drawResourceTick(tickWidth, tickHeight, COLORS.goldMid);
    pip.x = Math.round(index * (tickWidth + gap));
    pip.y = 0;
    container.addChild(pip);
  }

  return container;
}

function drawActionPointPipRow(current, tokenWidth, tokenHeight, position) {
  const tickWidth = Math.round(clamp(tokenWidth * 0.124, 16, 22));
  const tickHeight = Math.round(clamp(tokenHeight * 0.027, 4, 5));
  const gap = Math.round(clamp(tokenWidth * 0.03, 4, 6));
  const width = current * tickWidth + Math.max(0, current - 1) * gap;

  const container = new PIXI.Container();
  container.name = "axiom-action-point-pips";
  container.zIndex = 20;
  container.x = Math.round((tokenWidth - width) / 2);
  const baseOffset = clamp(tokenHeight * 0.02, 3, 5);
  const inwardOffset = 14;
  container.y = position === "bottom"
    ? Math.round(tokenHeight + baseOffset - inwardOffset)
    : Math.round(-tickHeight - baseOffset + inwardOffset);

  for (let index = 0; index < current; index += 1) {
    const pip = drawResourceTick(tickWidth, tickHeight, 0xff2a2a);
    pip.x = Math.round(index * (tickWidth + gap));
    pip.y = 0;
    container.addChild(pip);
  }

  return container;
}

function drawResourceTick(width, height, color) {
  return drawRoundedRectGraphic(
    0,
    0,
    width,
    height,
    Math.ceil(height / 2),
    color,
    0.96,
    0x050506,
    0.9,
    1,
  );
}

function drawDiamondPip(size) {
  const container = new PIXI.Container();
  const half = size / 2;
  container.addChild(
    drawPolygon(
      [[half, 0], [size, half], [half, size], [0, half]],
      COLORS.goldMid,
      0.96,
      0x231f16,
      0.98,
      Math.max(1, Math.round(size * 0.11)),
    ),
  );

  const shine = drawPolygon(
    [[half, 1], [size - 1, half], [half, half], [1, half]],
    COLORS.goldTop,
    0.28,
    0x000000,
    0,
    0,
  );
  container.addChild(shine);
  return container;
}

function drawActionPointChevron(fontSize) {
  const glyph = createText(">", {
    fontFamily: "Arial",
    fontSize,
    fontWeight: "900",
    fill: "#f3d67a",
    stroke: "#231f16",
    strokeThickness: Math.max(2, Math.round(fontSize * 0.08)),
    lineJoin: "round",
  });

  const container = new PIXI.Container();
  container.name = "axiom-action-point-chevron";
  if (!glyph) return container;

  glyph.anchor?.set?.(0.5, 0.5);
  glyph.x = Math.round(fontSize * 0.24);
  glyph.y = Math.round(fontSize * 0.48);
  glyph.eventMode = "none";
  container.addChild(glyph);
  return container;
}

function getOrCreateAxiomOverlayContainer(token) {
  if (!token) return null;

  let overlay = token.getChildByName?.(AXIOM_OVERLAY_NAME);
  if (overlay) return overlay;

  if (!globalThis.PIXI?.Container || typeof token.addChild !== "function") return null;

  overlay = new PIXI.Container();
  overlay.name = AXIOM_OVERLAY_NAME;
  overlay.zIndex = 1000;
  token.sortableChildren = true;
  token.addChild(overlay);
  return overlay;
}

function clearAxiomTokenBars(token) {
  const overlay = token?.getChildByName?.(AXIOM_OVERLAY_NAME);
  if (overlay) {
    clearContainer(overlay);
    overlay.destroy?.({ children: true });
  }
}

function clearContainer(container) {
  for (const child of Array.from(container.children ?? [])) {
    child.destroy?.({ children: true });
  }
  container.removeChildren?.();
}

function refreshActorTokenOverlays(actor) {
  for (const token of actor?.getActiveTokens?.(false, false) ?? [])
    drawAxiomTokenOverlays(token);
}

function refreshActorTokenBars(actor) {
  for (const token of actor?.getActiveTokens?.(false, false) ?? []) {
    if (typeof token.drawBars === "function") token.drawBars();
    else drawAxiomTokenResourcePips(token);
  }
}

function refreshTokenDocumentOverlay(tokenDocument) {
  const token = canvas?.tokens?.get?.(tokenDocument?.id);
  if (!token) return;
  drawAxiomTokenOverlays(token);
  if (typeof token.drawBars === "function") token.drawBars();
  else drawAxiomTokenResourcePips(token);
}

function refreshSceneTokenOverlays() {
  for (const token of canvas?.tokens?.placeables ?? [])
    drawAxiomTokenOverlays(token);
}

function refreshSceneTokenBars() {
  for (const token of canvas?.tokens?.placeables ?? []) {
    if (!isAxiomActor(token.actor)) continue;
    if (typeof token.drawBars === "function") token.drawBars();
    else drawAxiomTokenResourcePips(token);
  }
}

async function markNpcCriticalWoundsDead(actor) {
  if (!game.user?.isGM || actor?.type !== "npc") return;
  if (!isWoundTrackDepleted(actor.system?.wounds?.critical)) return;
  if (actor.system?.statuses?.dead || actor.getAxiomStatusEffect?.("dead")) return;

  const key = actor.uuid ?? actor.id;
  if (PENDING_NPC_DEATH_MARKS.has(key)) return;

  PENDING_NPC_DEATH_MARKS.add(key);
  try {
    if (!actor.system?.statuses?.dead && !actor.getAxiomStatusEffect?.("dead")) {
      await actor.addStatus?.("dead", 1);
    }
  } finally {
    PENDING_NPC_DEATH_MARKS.delete(key);
  }
}

function drawMomentumBar(data, tokenWidth, tokenHeight, token) {
  const container = new PIXI.Container();
  container.name = "axiom-momentum-bar";
  container.zIndex = 10;
  container.eventMode = "none";
  container.interactiveChildren = false;

  const trackWidth = Math.round(
    clamp(tokenWidth * 0.94, 60, tokenWidth * 1.05),
  );
  const trackHeight = Math.round(clamp(tokenHeight * 0.047, 5, 11));
  const labelFontSize = Math.round(clamp(tokenHeight * 0.074, 12, 17));
  const gap = Math.round(clamp(tokenHeight * 0.012, 2, 4));
  const controlHeight = Math.round(clamp(labelFontSize + 4, 16, 22));

  const buttonSize = Math.round(clamp(labelFontSize + 4, 17, 23));
  const valueWidth = Math.round(labelFontSize * 2.1);
  const controlGap = Math.round(clamp(tokenWidth * 0.018, 3, 5));
  const controlWidth = buttonSize * 2 + valueWidth + controlGap * 2;
  const controlX = Math.round((trackWidth - controlWidth) / 2);
  const controlY = 0;
  const trackY = controlHeight + gap;

  const minusButton = drawMomentumButton("−", buttonSize, -1, token);
  minusButton.x = controlX;
  minusButton.y = controlY;
  container.addChild(minusButton);

  const label = createText(formatSigned(data.current), {
    fontFamily: "Marcellus",
    fontSize: 20,
    fontWeight: "500",
    fill: "#ffffff",
    stroke: "#000000",
    strokeThickness: 4,
  });

  if (label) {
    label.anchor?.set?.(0.5, 0.5);
    label.x = Math.round(controlX + buttonSize + controlGap + valueWidth / 2);
    label.y = Math.round(controlY + controlHeight / 2 - 2);
    label.eventMode = "none";
    container.addChild(label);
  }

  const plusButton = drawMomentumButton("+", buttonSize, 1, token);
  plusButton.x = Math.round(
    controlX + buttonSize + controlGap + valueWidth + controlGap,
  );
  plusButton.y = controlY;
  container.addChild(plusButton);

  const track = drawGradientTrack(trackWidth, trackHeight);
  track.x = 0;
  track.y = trackY;
  container.addChild(track);

  const zero = drawRoundedRectGraphic(
    0,
    0,
    2,
    trackHeight + 6,
    2,
    0xffffff,
    0.8,
    0x000000,
    0.65,
    1,
  );
  zero.x = Math.round(trackWidth / 2 - 1);
  zero.y = trackY - 3;
  container.addChild(zero);

  const markerSize = Math.round(clamp(tokenHeight * 0.068, 9, 14));
  const percent = normalize(data.min, data.max, data.current);
  const marker = new PIXI.Container();
  marker.name = "axiom-momentum-marker";
  marker.x = Math.round(trackWidth * percent);
  marker.y = Math.round(trackY + trackHeight / 2);
  marker.addChild(
    drawCircle(0, 0, markerSize / 2, COLORS.marker, 1, 0x0b0b0c, 1, 2),
  );
  container.addChild(marker);

  container.x = Math.round((tokenWidth - trackWidth) / 2);
  container.y = Math.round(-(controlHeight + gap + trackHeight + 2));
  return container;
}

function drawGradientTrack(width, height) {
  const radius = Math.ceil(height / 2);
  const canvas = document.createElement("canvas");
  const ratio = Math.max(2, globalThis.devicePixelRatio ?? 1);
  canvas.width = Math.max(1, Math.round(width * ratio));
  canvas.height = Math.max(1, Math.round(height * ratio));

  const context = canvas.getContext("2d");
  context.scale(ratio, ratio);
  roundedCanvasPath(context, 0, 0, width, height, radius);
  context.clip();

  const gradient = context.createLinearGradient(0, 0, width, 0);
  for (const [stop, color] of MOMENTUM_GRADIENT)
    gradient.addColorStop(stop, color);
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  const gloss = context.createLinearGradient(0, 0, 0, height);
  gloss.addColorStop(0, "rgba(255,255,255,0.28)");
  gloss.addColorStop(0.45, "rgba(255,255,255,0.00)");
  gloss.addColorStop(1, "rgba(0,0,0,0.28)");
  context.fillStyle = gloss;
  context.fillRect(0, 0, width, height);

  const texture = PIXI.Texture.from(canvas);
  const sprite = new PIXI.Sprite(texture);
  sprite.width = width;
  sprite.height = height;

  const container = new PIXI.Container();
  container.addChild(
    drawRoundedRectGraphic(
      0,
      0,
      width,
      height,
      radius,
      COLORS.black,
      0.18,
      COLORS.border,
      0.25,
      1,
    ),
  );
  container.addChild(sprite);
  container.addChild(
    drawRoundedRectGraphic(
      0,
      0,
      width,
      height,
      radius,
      COLORS.black,
      0,
      0x070808,
      0.95,
      1,
    ),
  );
  return container;
}

function drawMomentumButton(label, size, step, token) {
  const container = new PIXI.Container();
  container.name = step < 0 ? "axiom-momentum-minus" : "axiom-momentum-plus";
  container.eventMode = "none";
  container.interactive = false;
  container.cursor = "pointer";
  container.hitArea = new PIXI.Rectangle(0, 0, size, size);
  container.axiomMomentumStep = step;
  container.axiomTokenId = token?.id;
  container.zIndex = 100;

  const glyph = createText(label, {
    fontFamily: "Marcellus",
    fontSize: 18,
    fontWeight: "500",
    fill: "#ffffff",
    stroke: "#000000",
    strokeThickness: 3,
    lineJoin: "round",
  });

  if (glyph) {
    glyph.anchor?.set?.(0.5, 0.5);
    glyph.x = Math.round(size / 2);
    glyph.y = Math.round(size / 2);
    glyph.eventMode = "none";
    container.addChild(glyph);
  }

  return container;
}

function registerMomentumCanvasPointerHandler() {
  const view = canvas?.app?.view;
  if (!view) return;

  if (view._axiomMomentumPointerHandler) {
    view.removeEventListener(
      "pointerdown",
      view._axiomMomentumPointerHandler,
      true,
    );
  }

  view._axiomMomentumPointerHandler = handleMomentumCanvasPointerDown;
  view.addEventListener("pointerdown", handleMomentumCanvasPointerDown, true);
}

function handleMomentumCanvasPointerDown(event) {
  const hit = getMomentumButtonHit(event);
  if (!hit) return;

  event.preventDefault?.();
  event.stopPropagation?.();
  event.stopImmediatePropagation?.();
  void adjustTokenMomentum(hit.token, hit.step);
}

function getMomentumButtonHit(event) {
  const view = canvas?.app?.view;
  const renderer = canvas?.app?.renderer;
  if (!view || !renderer || !globalThis.PIXI?.Point) return null;

  const rect = view.getBoundingClientRect();
  const scaleX = renderer.width / Math.max(1, rect.width);
  const scaleY = renderer.height / Math.max(1, rect.height);
  const point = new PIXI.Point(
    (event.clientX - rect.left) * scaleX,
    (event.clientY - rect.top) * scaleY,
  );

  const tokens = Array.from(canvas?.tokens?.placeables ?? []).reverse();
  for (const token of tokens) {
    if (!isAxiomActor(token.actor)) continue;

    const overlay = token.getChildByName?.(AXIOM_OVERLAY_NAME);
    if (!overlay) continue;

    for (const name of ["axiom-momentum-plus", "axiom-momentum-minus"]) {
      const button = overlay
        .getChildByName?.("axiom-momentum-bar")
        ?.getChildByName?.(name);
      const step = finiteNumber(button?.axiomMomentumStep, 0);
      if (!button || !step) continue;

      const bounds = button.getBounds?.();
      if (bounds?.contains?.(point.x, point.y)) return { token, step };
    }
  }

  return null;
}

async function adjustTokenMomentum(token, step) {
  const actor = token?.actor;
  if (!actor || !isAxiomActor(actor)) return;
  if (!actor.isOwner && !game.user?.isGM) return;

  const tracker = getTrackerData(actor, "momentum", {
    current: 0,
    min: -5,
    max: 5,
  });
  const next = clamp(tracker.current + step, tracker.min, tracker.max);
  if (next === tracker.current) return;

  await actor.update({ "system.trackers.momentum.current": next });
}

function drawActionPointBar(data, tokenWidth, tokenHeight) {
  const max = Math.max(0, Math.floor(data.max));
  if (!max) return null;

  const current = Math.max(0, Math.floor(data.current));
  const chevronWidth = Math.round(clamp(tokenWidth * 0.084, 10, 17));
  const chevronHeight = Math.round(clamp(tokenHeight * 0.095, 11, 19));
  const gap = Math.round(clamp(tokenWidth * 0.026, 3, 5));
  const padX = Math.round(clamp(tokenWidth * 0.037, 4, 7));
  const padY = Math.round(clamp(tokenHeight * 0.021, 2, 4));
  const width = max * chevronWidth + (max - 1) * gap + padX * 2;
  const height = chevronHeight + padY * 2;

  const container = new PIXI.Container();
  container.name = "axiom-action-points";
  container.zIndex = 10;
  container.x = Math.round((tokenWidth - width) / 2);
  container.y = Math.round(tokenHeight + 2);

  container.addChild(
    drawRoundedRectGraphic(
      0,
      0,
      width,
      height,
      Math.ceil(height / 2),
      COLORS.black,
      0.58,
      COLORS.border,
      0.24,
      1,
    ),
  );

  for (let index = 0; index < max; index += 1) {
    const filled = index < current;
    const chevron = drawChevron(chevronWidth, chevronHeight, filled);
    chevron.x = padX + index * (chevronWidth + gap);
    chevron.y = padY;
    container.addChild(chevron);
  }

  return container;
}

function drawWoundTracker(wounds, tokenWidth, tokenHeight) {
  const entries = WOUND_ORDER
    .map((severity) => ({ severity, count: Math.max(0, Math.floor(finiteNumber(wounds[severity], 0))) }))
    .filter((entry) => entry.count > 0);
  if (!entries.length) return null;

  const gap = Math.round(clamp(tokenHeight * 0.031, 4, 6));
  const scale = clamp(tokenHeight / 164, 0.78, 1.24);
  const rows = entries.map(({ severity, count }) => drawWoundTrackerRow(severity, count, scale));
  const totalHeight = rows.reduce((sum, row) => sum + row.axiomHeight, 0)
    + Math.max(0, rows.length - 1) * gap;

  const totalWidth = rows.reduce((max, row) => Math.max(max, row.axiomWidth ?? 0), 0);

  const container = new PIXI.Container();
  container.name = "axiom-wound-tracker";
  container.zIndex = 30;
  container.x = Math.round(tokenWidth + clamp(tokenWidth * 0.025, 4, 7) - 14 - totalWidth);
  container.y = Math.round((tokenHeight - totalHeight) / 2);

  let y = 0;
  for (const row of rows) {
    row.x = Math.round(totalWidth - (row.axiomWidth ?? 0));
    row.y = y;
    container.addChild(row);
    y += row.axiomHeight + gap;
  }

  return container;
}

function drawWoundTrackerRow(severity, count, scale) {
  const sizes = {
    grazing: { width: 4, height: 11 },
    minor: { width: 5, height: 13 },
    major: { width: 6, height: 15 },
    critical: { width: 7, height: 18 },
  };
  const size = sizes[severity] ?? sizes.grazing;
  const width = Math.max(3, Math.round(size.width * scale));
  const height = Math.max(8, Math.round(size.height * scale));
  const gap = Math.round(clamp(3 * scale, 2, 4));

  const container = new PIXI.Container();
  container.name = `axiom-wound-${severity}-row`;
  container.axiomHeight = height;
  container.axiomWidth = count * width + Math.max(0, count - 1) * gap;

  for (let index = 0; index < count; index += 1) {
    const pip = drawWoundSlash(severity, width, height);
    pip.x = Math.round(index * (width + gap));
    pip.y = 0;
    container.addChild(pip);
  }

  return container;
}

function drawWoundSlash(severity, width, height) {
  const color = COLORS[severity] ?? COLORS.grazing;
  const radius = Math.max(2, Math.round(width / 2));

  return drawRoundedRectGraphic(
    0,
    0,
    width,
    height,
    radius,
    color,
    0.96,
    COLORS.woundOutline,
    0.98,
    1,
  );
}

function drawChevron(width, height, filled) {
  const points = [
    [0, 0],
    [width * 0.68, 0],
    [width, height / 2],
    [width * 0.68, height],
    [0, height],
    [width * 0.32, height / 2],
  ];

  if (!filled)
    return drawPolygon(points, COLORS.empty, 0.16, COLORS.border, 0.25, 1);

  return drawPolygon(points, COLORS.goldTop, 0.92, 0x000000, 0.8, 1);
}

function drawRoundedRectGraphic(
  x,
  y,
  width,
  height,
  radius,
  fill,
  fillAlpha = 1,
  line = 0x000000,
  lineAlpha = 1,
  lineWidth = 1,
) {
  const graphics = new PIXI.Graphics();
  if (typeof graphics.lineStyle === "function") {
    graphics.lineStyle(lineWidth, line, lineAlpha);
    if (fillAlpha > 0) graphics.beginFill(fill, fillAlpha);
    graphics.drawRoundedRect(x, y, width, height, radius);
    if (fillAlpha > 0) graphics.endFill();
    return graphics;
  }

  graphics.roundRect?.(x, y, width, height, radius);
  if (fillAlpha > 0) graphics.fill?.({ color: fill, alpha: fillAlpha });
  if (lineWidth > 0)
    graphics.stroke?.({ color: line, alpha: lineAlpha, width: lineWidth });
  return graphics;
}

function drawCircle(
  x,
  y,
  radius,
  fill,
  fillAlpha = 1,
  line = 0x000000,
  lineAlpha = 1,
  lineWidth = 1,
) {
  const graphics = new PIXI.Graphics();
  if (typeof graphics.lineStyle === "function") {
    graphics.lineStyle(lineWidth, line, lineAlpha);
    if (fillAlpha > 0) graphics.beginFill(fill, fillAlpha);
    graphics.drawCircle(x, y, radius);
    if (fillAlpha > 0) graphics.endFill();
    return graphics;
  }

  graphics.circle?.(x, y, radius);
  if (fillAlpha > 0) graphics.fill?.({ color: fill, alpha: fillAlpha });
  if (lineWidth > 0)
    graphics.stroke?.({ color: line, alpha: lineAlpha, width: lineWidth });
  return graphics;
}

function drawPolygon(
  points,
  fill,
  fillAlpha = 1,
  line = 0x000000,
  lineAlpha = 1,
  lineWidth = 1,
) {
  const graphics = new PIXI.Graphics();
  const flat = points.flat();
  if (typeof graphics.lineStyle === "function") {
    graphics.lineStyle(lineWidth, line, lineAlpha);
    if (fillAlpha > 0) graphics.beginFill(fill, fillAlpha);
    graphics.drawPolygon(flat);
    if (fillAlpha > 0) graphics.endFill();
    return graphics;
  }

  graphics.poly?.(flat);
  if (fillAlpha > 0) graphics.fill?.({ color: fill, alpha: fillAlpha });
  if (lineWidth > 0)
    graphics.stroke?.({ color: line, alpha: lineAlpha, width: lineWidth });
  return graphics;
}

function regularPolygon(cx, cy, radius, sides, rotation = 0) {
  return Array.from({ length: sides }, (_value, index) => {
    const angle = rotation + (Math.PI * 2 * index) / sides;
    return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius];
  });
}

function roundedCanvasPath(context, x, y, width, height, radius) {
  if (typeof context.roundRect === "function") {
    context.beginPath();
    context.roundRect(x, y, width, height, radius);
    return;
  }

  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function createText(label, styleData = {}) {
  if (!globalThis.PIXI?.Text) return null;

  const resolution = Math.max(4, (globalThis.devicePixelRatio ?? 1) * 2);
  const pixiMajor = Number(
    String(globalThis.PIXI.VERSION ?? "7").split(".")[0],
  );

  const textValue = String(label);

  const fontFamily = styleData.fontFamily ?? "Arial";
  const fontSize = styleData.fontSize ?? 14;
  const fontWeight = styleData.fontWeight ?? "400";
  const fill = styleData.fill ?? "#ffffff";
  const strokeColor = styleData.stroke ?? "#000000";
  const strokeThickness = Number(styleData.strokeThickness ?? 0);
  const lineJoin = styleData.lineJoin ?? "round";
  const align = styleData.align ?? "center";

  let text;

  if (pixiMajor >= 8) {
    const style = {
      fontFamily,
      fontSize,
      fontWeight,
      fill,
      align,
    };

    if (strokeThickness > 0) {
      style.stroke = {
        color: strokeColor,
        width: strokeThickness,
        join: lineJoin,
      };
    }

    text = new PIXI.Text({
      text: textValue,
      style,
      resolution,
    });
  } else {
    const legacyStyleData = {
      fontFamily,
      fontSize,
      fontWeight,
      fill,
      align,
      lineJoin,
    };

    if (strokeThickness > 0) {
      legacyStyleData.stroke = strokeColor;
      legacyStyleData.strokeThickness = strokeThickness;
    }

    const style = globalThis.PIXI.TextStyle
      ? new PIXI.TextStyle(legacyStyleData)
      : legacyStyleData;

    text = new PIXI.Text(textValue, style);
  }

  text.resolution = resolution;
  text.roundPixels = true;

  if (text.texture?.source) {
    text.texture.source.scaleMode = "nearest";
  } else if (
    text.texture?.baseTexture &&
    globalThis.PIXI?.SCALE_MODES?.NEAREST
  ) {
    text.texture.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
  }

  return text;
}

function getActionPointTrackerData(actor) {
  const fallback = { current: 0, min: 0, max: 3 };
  const tracker = actor?.system?.trackers?.actionPoints ?? fallback;
  const max = finiteNumber(tracker.max, fallback.max);
  const min = finiteNumber(tracker.min, fallback.min);

  return {
    current: Math.min(max, Math.max(min, finiteNumber(tracker.current, fallback.current))),
    min,
    max,
  };
}

function getTrackerData(actor, key, fallback) {
  const tracker = actor?.system?.trackers?.[key] ?? fallback;
  const min = finiteNumber(tracker.min, fallback.min);
  const max = finiteNumber(tracker.max, fallback.max);
  return {
    current: Math.min(
      max,
      Math.max(min, finiteNumber(tracker.current, fallback.current)),
    ),
    min,
    max,
  };
}

function getTakenWoundCounts(actor) {
  const wounds = {};
  for (const severity of WOUND_ORDER) {
    wounds[severity] = getTakenWoundCount(actor?.system?.wounds?.[severity]);
  }
  return wounds;
}

function getTakenWoundCount(track) {
  const current = finiteNumber(track?.current, NaN);
  if (Number.isFinite(current)) return Math.max(0, Math.floor(current));

  const max = finiteNumber(track?.max, 0);
  if (max <= 0) return 0;

  const slotKeys = ["one", "two", "three", "four", "five"].slice(0, max);
  return slotKeys.filter((key) => Boolean(track?.slots?.[key]?.taken)).length;
}

function getDepletedWoundBadges(actor) {
  const badges = [];
  for (const severity of WOUND_ORDER) {
    if (severity === "critical" && actor.type === "npc") continue;
    if (!isWoundTrackDepleted(actor.system?.wounds?.[severity])) continue;
    badges.push(severity);
  }
  return badges;
}

function isWoundTrackDepleted(track) {
  const max = finiteNumber(track?.max, 0);
  if (max <= 0) return false;

  const current = finiteNumber(track?.current, NaN);
  if (Number.isFinite(current) && current >= max) return true;

  const slotKeys = ["one", "two", "three", "four", "five"].slice(0, max);
  return (
    slotKeys.length > 0 &&
    slotKeys.every((key) => Boolean(track?.slots?.[key]?.taken))
  );
}

function isAxiomActor(actor) {
  return ["protagonist", "npc"].includes(actor?.type);
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalize(min, max, value) {
  if (max <= min) return 0.5;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

function formatSigned(value) {
  const number = finiteNumber(value, 0);
  return number > 0 ? `+${number}` : String(number);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
