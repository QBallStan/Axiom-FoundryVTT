import AxiomWeaponBaseData from "./weapon-base.mjs";

const fields = foundry.data.fields;

/** Legacy combined weapon model kept so existing worlds load safely. */
export default class AxiomWeaponData extends AxiomWeaponBaseData {
  static DEFAULT_ICON = "systems/axiom/assets/icons/items/weapon-melee.svg";

  static defaultIcon(data = {}) {
    const category = foundry.utils.getProperty(data, "system.category");
    return category === "ranged"
      ? "systems/axiom/assets/icons/items/weapon-range.svg"
      : this.DEFAULT_ICON;
  }

  static defineSchema() {
    return {
      ...this.commonWeaponFields({ category: "melee" }),
      range: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      ammo: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      ammoContainer: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      ammunition: new fields.StringField({ required: false, blank: true, initial: "" })
    };
  }
}
