const { Item } = foundry.documents;

const DEFAULT_ITEM_IMAGE = "icons/svg/item-bag.svg";

function isUnsetOrCoreDefaultImage(value) {
  return !value || value === DEFAULT_ITEM_IMAGE;
}

export default class AxiomItem extends Item {
  async _preCreate(data, options, user) {
    await super._preCreate(data, options, user);

    const image = data.img ?? this.img;
    if (!isUnsetOrCoreDefaultImage(image)) return;

    const model = CONFIG.Item.dataModels?.[this.type];
    const defaultIcon = typeof model?.defaultIcon === "function"
      ? model.defaultIcon(data)
      : model?.DEFAULT_ICON;

    if (defaultIcon) this.updateSource({ img: defaultIcon });
  }
}
