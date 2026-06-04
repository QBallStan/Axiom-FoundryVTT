const { Item } = foundry.documents;

const DEFAULT_ITEM_IMAGE = "icons/svg/item-bag.svg";

function isUnsetOrCoreDefaultImage(value) {
  return !value || value === DEFAULT_ITEM_IMAGE;
}

export default class AxiomItem extends Item {
  static #weaponTypes = new Set(["weapon", "meleeWeapon", "rangedWeapon"]);

  static #isWeaponType(type) {
    return this.#weaponTypes.has(type);
  }

  async _preCreate(data, options, user) {
    await super._preCreate(data, options, user);

    if (AxiomItem.#isWeaponType(data.type ?? this.type) && foundry.utils.getProperty(data, "system.guard") === "limited") {
      this.updateSource({ "system.parryBonus": 0 });
    }

    const image = data.img ?? this.img;
    if (!isUnsetOrCoreDefaultImage(image)) return;

    const model = CONFIG.Item.dataModels?.[this.type];
    const defaultIcon = typeof model?.defaultIcon === "function"
      ? model.defaultIcon(data)
      : model?.DEFAULT_ICON;

    if (defaultIcon) this.updateSource({ img: defaultIcon });
  }

  async _preUpdate(changed, options, user) {
    const result = await super._preUpdate(changed, options, user);
    if (result === false) return false;

    if (!AxiomItem.#isWeaponType(this.type)) return result;

    const nextGuard = foundry.utils.getProperty(changed, "system.guard") ?? this.system?.guard;
    if (nextGuard === "limited") foundry.utils.setProperty(changed, "system.parryBonus", 0);

    return result;
  }
}
