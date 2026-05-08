import AxiomItemData from "./base.mjs";

const fields = foundry.data.fields;

export default class AxiomWeaponBaseData extends AxiomItemData {
  static commonWeaponFields({ category = "melee" } = {}) {
    return {
      ...super.commonFields(),
      category: new fields.StringField({ required: true, initial: category }),
      skill: new fields.StringField({ required: false, blank: true, initial: "" }),
      damage: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      armorPenetration: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      delivery: new fields.StringField({ required: true, initial: "kinetic" })
    };
  }
}
