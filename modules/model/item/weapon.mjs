import AxiomWeaponBaseData from "./weapon-base.mjs";

const fields = foundry.data.fields;

export default class AxiomWeaponData extends AxiomWeaponBaseData {
  static DEFAULT_ICON = "systems/axiom/assets/icons/items/weapon.svg";

  static defineSchema() {
    return {
      ...this.commonWeaponFields({ category: "melee" }),
      reach: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
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
