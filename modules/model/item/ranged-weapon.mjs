import AxiomWeaponBaseData from "./weapon-base.mjs";

const fields = foundry.data.fields;

export default class AxiomRangedWeaponData extends AxiomWeaponBaseData {
  static DEFAULT_ICON = "systems/axiom/assets/icons/items/weapon-range.svg";


  static defineSchema() {
    return {
      ...this.commonWeaponFields({ category: "ranged" }),
      range: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      ammo: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      ammoContainer: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      ammunition: new fields.StringField({ required: false, blank: true, initial: "" })
    };
  }
}
