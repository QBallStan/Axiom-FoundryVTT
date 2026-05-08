import AxiomItemData from "./base.mjs";

const fields = foundry.data.fields;

export default class AxiomSkillData extends AxiomItemData {
  static DEFAULT_ICON = "systems/axiom/assets/icons/items/skill.svg";


  static defineSchema() {
    return {
      ...super.descriptionField(),
      level: new fields.NumberField({ required: true, integer: true, min: 0, max: 50, initial: 0 }),
      attributeOne: new fields.StringField({ required: true, initial: "strength" }),
      attributeTwo: new fields.StringField({ required: true, initial: "agility" }),
      category: new fields.StringField({ required: true, initial: "core" })
    };
  }
}
