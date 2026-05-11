import AxiomWeaponBaseData from "./weapon-base.mjs";

const fields = foundry.data.fields;

/** Legacy ranged weapon model kept so existing worlds load safely. */
export default class AxiomRangedWeaponData extends AxiomWeaponBaseData {
  static DEFAULT_ICON = "systems/axiom/assets/icons/items/weapon.svg";

  static defineSchema() {
    return {
      ...this.commonWeaponFields({ category: "ranged" }),
      reach: new fields.NumberField({ required: true, integer: true, min: 0, initial: 1 }),
      range: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      ammo: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      ammoContainer: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      ammunition: new fields.StringField({ required: false, blank: true, initial: "" }),
      shotRate: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      reloadMethod: new fields.StringField({ required: false, blank: true, initial: "none" }),
      reloadCost: new fields.NumberField({ required: true, integer: true, min: 0, max: 3, initial: 1 })
    };
  }
}
