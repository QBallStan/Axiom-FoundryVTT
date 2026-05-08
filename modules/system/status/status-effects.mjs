/* -------------------------------------------- */
/*  Axiom//Core Status Effects                  */
/* -------------------------------------------- */

/**
 * Register Axiom's status effect definitions with Foundry.
 *
 * Foundry's token HUD expects CONFIG.statusEffects to be an array. Keep any
 * keyed lookups on CONFIG.AXIOM.statuses / CONFIG.AXIOM.statusEffectMap.
 */
export function configureAxiomStatusEffects(config) {
  if (!config?.statusEffects) return;
  CONFIG.statusEffects = foundry.utils.deepClone(config.statusEffects);
}

/** Register hooks that keep actor status values and token icons in sync. */
export function registerAxiomStatusHooks() {
  Hooks.on("createActiveEffect", syncAxiomStatusEffect);
  Hooks.on("updateActiveEffect", syncAxiomStatusEffect);
  Hooks.on("deleteActiveEffect", onDeleteAxiomStatusEffect);
}

/** Patch token effect drawing once so stackable statuses show a counter. */
export function patchAxiomTokenStatusStackNumbers() {
  const TokenClass = foundry.canvas?.placeables?.Token ?? globalThis.Token;
  if (!TokenClass?.prototype || TokenClass.prototype._axiomStatusStackNumbersPatched) return;

  const originalDrawEffects = TokenClass.prototype.drawEffects;
  if (typeof originalDrawEffects !== "function") return;

  TokenClass.prototype._axiomStatusStackNumbersPatched = true;
  TokenClass.prototype.drawEffects = async function (...args) {
    const result = await originalDrawEffects.apply(this, args);
    drawAxiomTokenStatusStackNumbers(this);
    return result;
  };
}

async function syncAxiomStatusEffect(effect) {
  const actor = effect.parent;
  const statusId = getAxiomStatusId(effect);
  const status = statusId ? CONFIG.AXIOM?.statuses?.[statusId] : null;

  if (!actor || actor.documentName !== "Actor" || !status) return;

  const value = status.numbered
    ? Number(foundry.utils.getProperty(effect, "flags.axiom.value") ?? 1)
    : 1;

  await actor.update({ [`system.statuses.${statusId}`]: value }, { render: false });
  actor._refreshActiveTokenStatusIcons?.();
}

async function onDeleteAxiomStatusEffect(effect) {
  const actor = effect.parent;
  const statusId = getAxiomStatusId(effect);

  if (!actor || actor.documentName !== "Actor" || !statusId) return;
  await actor.update({ [`system.statuses.${statusId}`]: 0 }, { render: false });
  actor._refreshActiveTokenStatusIcons?.();
}

export function getAxiomStatusId(effect) {
  const configured = foundry.utils.getProperty(effect, "flags.axiom.id");
  if (configured && CONFIG.AXIOM?.statuses?.[configured]) return configured;

  const statuses = effect.statuses instanceof Set
    ? Array.from(effect.statuses)
    : Array.from(effect.statuses ?? []);

  return statuses.find(statusId => CONFIG.AXIOM?.statuses?.[statusId]) ?? null;
}

function drawAxiomTokenStatusStackNumbers(token) {
  const container = token.effects;
  const actor = token.actor;
  if (!container || !actor) return;

  clearAxiomStatusStackNumbers(container);

  const stackEffects = getAxiomNumberedTokenEffects(actor);
  if (!stackEffects.length) return;

  const iconSprites = getTokenEffectIconSprites(container);
  if (!iconSprites.length) return;

  const unusedSprites = [...iconSprites];

  for (const stackEffect of stackEffects) {
    const sprite = findTokenEffectSprite(stackEffect, unusedSprites) ?? unusedSprites.shift();
    if (!sprite) continue;

    const label = createAxiomStackNumberText(stackEffect.value);
    if (!label) continue;

    // Attach the counter to the icon sprite itself, not the token's effect
    // container. This keeps the number inside the icon when Foundry lays out
    // multiple token effects.
    label.name = "axiom-status-stack-number";
    label.x = 2;
    label.y = 1;
    label.zIndex = 10000;
    sprite.sortableChildren = true;
    sprite.addChild(label);
  }
}

function clearAxiomStatusStackNumbers(container) {
  for (const child of Array.from(container.children ?? [])) {
    const direct = child.name === "axiom-status-stack-number" ? child : null;
    if (direct) {
      direct.destroy({ children: true });
      continue;
    }

    const nested = child.getChildByName?.("axiom-status-stack-number");
    if (nested) nested.destroy({ children: true });
  }
}

function getAxiomNumberedTokenEffects(actor) {
  return Array.from(actor.effects ?? [])
    .map(effect => {
      const statusId = getAxiomStatusId(effect);
      const status = statusId ? CONFIG.AXIOM?.statuses?.[statusId] : null;
      if (!status?.numbered) return null;

      const value = Number(foundry.utils.getProperty(effect, "flags.axiom.value") ?? foundry.utils.getProperty(effect, "system.condition.value") ?? 1);
      if (value <= 1) return null;

      return { effect, status, statusId, value };
    })
    .filter(Boolean);
}

function getTokenEffectIconSprites(container) {
  return Array.from(container.children ?? [])
    .filter(child => child?.name !== "axiom-status-stack-number")
    .filter(child => child?.texture || child?.sprite || child?.isSprite)
    .filter(child => Number(child.width) > 0 && Number(child.height) > 0);
}

function findTokenEffectSprite(stackEffect, sprites) {
  const effectImg = normalizeAssetPath(stackEffect.effect.img ?? stackEffect.status.img);
  if (!effectImg) return null;

  const index = sprites.findIndex(sprite => {
    const paths = getSpriteAssetPaths(sprite);
    return paths.some(path => path === effectImg || path.endsWith(`/${effectImg.split("/").pop()}`));
  });

  if (index < 0) return null;
  return sprites.splice(index, 1)[0];
}

function getSpriteAssetPaths(sprite) {
  const candidates = [
    sprite.texture?.source?.resource?.src,
    sprite.texture?.source?.src,
    sprite.texture?.baseTexture?.resource?.url,
    sprite.texture?.baseTexture?.resource?.src,
    sprite.texture?.textureCacheIds?.[0],
    sprite.texture?.label,
    sprite.name
  ];

  return candidates.map(normalizeAssetPath).filter(Boolean);
}

function normalizeAssetPath(path) {
  if (!path || typeof path !== "string") return null;
  return path.replace(/^https?:\/\/[^/]+\//, "").replace(/^\//, "");
}

function createAxiomStackNumberText(value) {
  if (!globalThis.PIXI?.Text) return null;

  const label = String(value);

  // These values intentionally look oversized in code because the text is
  // added as a child of Foundry's token effect sprite and inherits its scale.
  // Tune x/y and fontSize here if the counter needs adjustment.
  const styleData = {
    fontFamily: "Arial",
    fontSize: 250,
    fontWeight: "900",
    fill: 0xffffff,
    stroke: 0x000000,
    strokeThickness: 30,
    dropShadow: true,
    dropShadowColor: 0x000000,
    dropShadowBlur: 2,
    dropShadowDistance: 1,
    dropShadowAlpha: 0.9
  };

  let style = styleData;
  if (globalThis.PIXI?.TextStyle) {
    try { style = new PIXI.TextStyle(styleData); }
    catch (_error) { style = styleData; }
  }

  // Foundry V14 currently runs on Pixi where the first constructor argument
  // is interpreted as the displayed string. Passing the Pixi v8 object form can
  // render literally as "[object Object]", so use the string-first form here.
  let text;
  try { text = new PIXI.Text(label, style); }
  catch (_error) { text = new PIXI.Text({ text: label, style }); }

  if (text.text !== label) text.text = label;
  text.anchor?.set?.(0, 0);
  return text;
}
