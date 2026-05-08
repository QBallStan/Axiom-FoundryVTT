const WOUND_ORDER = ["grazing", "minor", "major", "critical"];
const AXIOM_BAR_NAME = "axiom-token-bars";

const COLORS = {
  black: 0x040506,
  border: 0xe0d4b8,
  text: 0xf1e8ce,
  marker: 0xf7f0dd,
  goldTop: 0xf3e9cc,
  goldMid: 0xc5af78,
  goldBottom: 0x7b6740,
  empty: 0xe0d4b8,
  grazing: 0x2fbf71,
  minor: 0xf0d34d,
  major: 0xf08a2a,
  critical: 0xb51e24,
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
  patchAxiomTokenBarDrawing();

  Hooks.on("refreshToken", (token) => drawAxiomTokenOverlays(token));
  Hooks.on("drawToken", (token) => drawAxiomTokenOverlays(token));
  Hooks.on("destroyToken", (token) => clearAxiomTokenBars(token));
  Hooks.on("updateToken", (tokenDocument) =>
    refreshTokenDocumentOverlay(tokenDocument),
  );
  Hooks.on("canvasReady", () => {
    registerMomentumCanvasPointerHandler();
    refreshSceneTokenOverlays();
  });

  Hooks.on("updateActor", (actor, changed) => {
    if (!isAxiomActor(actor)) return;

    const trackerChanged = foundry.utils.hasProperty(
      changed,
      "system.trackers",
    );
    const woundsChanged = foundry.utils.hasProperty(changed, "system.wounds");
    const statusChanged = foundry.utils.hasProperty(
      changed,
      "system.statuses.dead",
    );
    if (!trackerChanged && !woundsChanged && !statusChanged) return;

    if (woundsChanged) void markNpcCriticalWoundsDead(actor);
    refreshActorTokenOverlays(actor);
  });
}

function patchAxiomTokenBarDrawing() {
  const TokenClass = foundry.canvas?.placeables?.Token ?? globalThis.Token;
  if (!TokenClass?.prototype || TokenClass.prototype._axiomTokenBarsPatched)
    return;

  const originalDrawBars = TokenClass.prototype.drawBars;
  if (typeof originalDrawBars !== "function") return;

  TokenClass.prototype._axiomTokenBarsPatched = true;
  TokenClass.prototype.drawBars = function (...args) {
    const result = originalDrawBars.apply(this, args);
    if (isAxiomActor(this.actor)) drawAxiomTokenOverlays(this);
    return result;
  };
}

export function drawAxiomTokenOverlays(token) {
  if (!token?.actor || !isAxiomActor(token.actor)) return;
  const bars = token.bars;
  if (!bars) return;

  clearContainer(bars);
  bars.name = AXIOM_BAR_NAME;
  bars.visible = true;
  bars.sortableChildren = true;
  bars.interactive = true;
  bars.interactiveChildren = true;
  bars.eventMode = "static";

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

  bars.hitArea = new PIXI.Rectangle(
    Math.round(-width * 0.15),
    Math.round(-height * 0.35),
    Math.round(width * 1.3),
    Math.round(height * 1.7),
  );

  const momentum = getTrackerData(token.actor, "momentum", {
    current: 0,
    min: -5,
    max: 5,
  });
  const actionPoints = getTrackerData(token.actor, "actionPoints", {
    current: 0,
    min: 0,
    max: 3,
  });
  const badges = getDepletedWoundBadges(token.actor);

  const momentumBar = drawMomentumBar(momentum, width, height, token);
  if (momentumBar) bars.addChild(momentumBar);

  const actionPointBar = drawActionPointBar(actionPoints, width, height);
  if (actionPointBar) bars.addChild(actionPointBar);

  const woundBadges = drawWoundBadges(badges, width, height);
  if (woundBadges) bars.addChild(woundBadges);
}

function clearAxiomTokenBars(token) {
  if (token?.bars) clearContainer(token.bars);
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

function refreshTokenDocumentOverlay(tokenDocument) {
  const token = canvas?.tokens?.get?.(tokenDocument?.id);
  if (token) drawAxiomTokenOverlays(token);
}

function refreshSceneTokenOverlays() {
  for (const token of canvas?.tokens?.placeables ?? [])
    drawAxiomTokenOverlays(token);
}

async function markNpcCriticalWoundsDead(actor) {
  if (!game.user?.isGM || actor?.type !== "npc") return;
  if (!isWoundTrackDepleted(actor.system?.wounds?.critical)) return;
  if (actor.system?.statuses?.dead) return;

  await actor.update({ "system.statuses.dead": 1 }, { render: false });
  await actor.addStatus?.("dead", 1);
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

    const bars = token.bars;
    if (!bars) continue;

    for (const name of ["axiom-momentum-plus", "axiom-momentum-minus"]) {
      const button = bars
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

function drawWoundBadges(badges, tokenWidth, tokenHeight) {
  if (!badges.length) return null;

  const size = Math.round(clamp(tokenHeight * 0.09, 11, 18));
  const gap = Math.round(clamp(tokenHeight * 0.026, 3, 5));
  const container = new PIXI.Container();
  container.name = "axiom-wound-badges";
  container.zIndex = 20;
  container.x = Math.round(tokenWidth - 15);
  container.y = Math.round(
    (tokenHeight - (badges.length * size + (badges.length - 1) * gap)) / 2,
  );

  badges.forEach((severity, index) => {
    const badge = drawWoundBadge(severity, size);
    badge.y = index * (size + gap);
    container.addChild(badge);
  });

  return container;
}

function drawWoundBadge(severity, size) {
  const color = COLORS[severity] ?? COLORS.grazing;
  const container = new PIXI.Container();
  container.name = `axiom-wound-${severity}`;

  if (severity === "grazing") {
    container.addChild(
      drawCircle(size / 2, size / 2, size / 2, color, 0.96, 0x090909, 1, 1),
    );
  } else if (severity === "critical") {
    container.addChild(
      drawRoundedRectGraphic(0, 0, size, size, 1, color, 0.96, 0x090909, 1, 1),
    );
  } else {
    const sides = severity === "minor" ? 6 : 5;
    container.addChild(
      drawPolygon(
        regularPolygon(size / 2, size / 2, size / 2 , sides, -Math.PI / 2),
        color,
        0.96,
        0x090909,
        1,
        1,
      ),
    );
  }

  return container;
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
