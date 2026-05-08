import AxiomItemData from "./base.mjs";

const fields = foundry.data.fields;

export default class AxiomArmorData extends AxiomItemData {
  static DEFAULT_ICON = "systems/axiom/assets/icons/items/armor.svg";


  static defineSchema() {
    return {
      ...super.commonFields(),
      armor: new fields.SchemaField({
        head: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        torso: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        arms: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        legs: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 })
      }),
      broken: new fields.BooleanField({ required: true, initial: false })
    };
  }
}
