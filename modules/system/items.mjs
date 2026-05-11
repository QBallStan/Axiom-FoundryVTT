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
