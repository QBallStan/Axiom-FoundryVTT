import AxiomItemData from "./base.mjs";

const fields = foundry.data.fields;

export default class AxiomShieldData extends AxiomItemData {
  static DEFAULT_ICON = "systems/axiom/assets/icons/items/shield.svg";

  static defineSchema() {
    return {
      ...super.commonFields(),
      skill: new fields.StringField({ required: true, blank: true, initial: "Melee" }),
      blockValue: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      armorBonus: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      cover: new fields.StringField({ required: true, choices: ["light", "medium", "heavy"], initial: "light" })
    };
  }
}
