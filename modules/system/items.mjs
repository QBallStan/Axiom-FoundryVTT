export const WEAPON_ITEM_TYPE = "weapon";
export const SHIELD_ITEM_TYPE = "shield";
export const WEAPON_ITEM_TYPES = [WEAPON_ITEM_TYPE];

export const HAND_STATE_MAIN = "mainHand";
export const HAND_STATE_OFF = "offHand";
export const HAND_STATE_BOTH = "bothHands";
export const HAND_GEAR_STATES = [HAND_STATE_MAIN, HAND_STATE_OFF, HAND_STATE_BOTH];
export const EQUIPPED_GEAR_STATES = ["equipped", ...HAND_GEAR_STATES];

export function isHandGearState(state) {
  return HAND_GEAR_STATES.includes(state);
}

export function isEquippedGearState(state) {
  return EQUIPPED_GEAR_STATES.includes(state);
}

export function isHandEquippableItem(item) {
  return isWeaponItem(item) || isShieldItem(item);
}

export function handStateUsesMainHand(state) {
  return state === "equipped" || state === HAND_STATE_MAIN || state === HAND_STATE_BOTH;
}

export function handStateUsesOffHand(state) {
  return state === "equipped" || state === HAND_STATE_OFF || state === HAND_STATE_BOTH;
}

export function isWeaponItem(item) {
  return WEAPON_ITEM_TYPES.includes(item?.type);
}

function getStoredWeaponCategory(item) {
  if (!isWeaponItem(item)) return "";
  const category = item.system?.category;
  return ["melee", "ranged", "mixed"].includes(category) ? category : "melee";
}

export function isMeleeWeaponItem(item) {
  const category = getStoredWeaponCategory(item);
  return category === "melee" || category === "mixed";
}

export function isRangedWeaponItem(item) {
  const category = getStoredWeaponCategory(item);
  return category === "ranged" || category === "mixed";
}

export function isMixedWeaponItem(item) {
  return getStoredWeaponCategory(item) === "mixed";
}

export function getWeaponCategory(item) {
  return getStoredWeaponCategory(item);
}

export function isShieldItem(item) {
  return item?.type === SHIELD_ITEM_TYPE;
}


export function getActorStrengthValue(actor) {
  const value = Number(actor?.system?.attributes?.strength?.value ?? actor?.system?.attributes?.strength ?? 0);
  return Number.isFinite(value) ? value : 0;
}

export function getWeaponRange(weapon, actor = null) {
  if (!isWeaponItem(weapon)) return 0;

  const system = weapon.system ?? {};
  const usesStrength = Boolean(system.strengthBasedRange);
  const baseRange = Number(system.range ?? 0);

  if (!usesStrength) return Number.isFinite(baseRange) ? Math.max(0, baseRange) : 0;

  const strength = getActorStrengthValue(actor ?? weapon.actor ?? weapon.parent ?? null);
  const modifier = Number(system.strengthRangeModifier ?? 0);
  const range = strength + (Number.isFinite(modifier) ? modifier : 0);
  return Number.isFinite(range) ? Math.max(0, range) : 0;
}

export function getWeaponRangeBands(rangeValue) {
  const range = Math.max(0, Math.floor(Number(rangeValue ?? 0)));
  const close = range > 0 ? Math.ceil(range / 4) : 0;
  const short = range > 0 ? Math.ceil(range / 2) : 0;
  const medium = range;
  const long = range * 2;
  const extreme = range * 3;

  return {
    close,
    short,
    medium,
    long,
    extreme,
    closeStart: range > 0 ? 0 : 0,
    shortStart: range > 0 ? close + 1 : 0,
    mediumStart: range > 0 ? short + 1 : 0,
    longStart: range > 0 ? medium + 1 : 0,
    extremeStart: range > 0 ? long + 1 : 0
  };
}
