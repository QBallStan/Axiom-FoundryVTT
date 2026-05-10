export const MELEE_WEAPON_TYPE = "meleeWeapon";
export const RANGED_WEAPON_TYPE = "rangedWeapon";
export const LEGACY_WEAPON_TYPE = "weapon";
export const SHIELD_ITEM_TYPE = "shield";
export const WEAPON_ITEM_TYPES = [MELEE_WEAPON_TYPE, RANGED_WEAPON_TYPE, LEGACY_WEAPON_TYPE];

export function isWeaponItem(item) {
  return WEAPON_ITEM_TYPES.includes(item?.type);
}

export function isMeleeWeaponItem(item) {
  if (!item) return false;
  if (item.type === MELEE_WEAPON_TYPE) return true;
  if (item.type === LEGACY_WEAPON_TYPE) return (item.system?.category ?? "melee") === "melee";
  return false;
}

export function isRangedWeaponItem(item) {
  if (!item) return false;
  if (item.type === RANGED_WEAPON_TYPE) return true;
  if (item.type === LEGACY_WEAPON_TYPE) return item.system?.category === "ranged";
  return false;
}

export function getWeaponCategory(item) {
  if (isMeleeWeaponItem(item)) return "melee";
  if (isRangedWeaponItem(item)) return "ranged";
  return item?.system?.category ?? "";
}

export function isShieldItem(item) {
  return item?.type === SHIELD_ITEM_TYPE;
}
