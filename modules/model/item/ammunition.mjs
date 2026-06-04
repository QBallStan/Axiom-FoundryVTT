import AxiomItemData from "./base.mjs";

const fields = foundry.data.fields;

export default class AxiomAmmunitionData extends AxiomItemData {
  static DEFAULT_ICON = "systems/axiom/assets/icons/items/ammo.svg";


  static defineSchema() {
    return {
      ...super.commonFields(),
      elemental: new fields.StringField({ required: true, choices: ["none", "fire", "cold", "electric", "acid", "corruption", "radiant", "necrotic", "psychic"], initial: "none" }),
      damageModifier: new fields.NumberField({ required: true, integer: true, initial: 0 }),
      armorPenetrationModifier: new fields.NumberField({ required: true, integer: true, initial: 0 })
    };
  }
}
