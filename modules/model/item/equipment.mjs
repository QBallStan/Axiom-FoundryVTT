import AxiomItemData from "./base.mjs";

const fields = foundry.data.fields;

export default class AxiomEquipmentData extends AxiomItemData {
  static DEFAULT_ICON = "systems/axiom/assets/icons/items/equipment.svg";


  static defineSchema() {
    return {
      ...super.commonFields(),
      skill: new fields.StringField({ required: false, blank: true, initial: "" }),
      rollModifier: new fields.NumberField({ required: true, integer: true, initial: 0 })
    };
  }
}
