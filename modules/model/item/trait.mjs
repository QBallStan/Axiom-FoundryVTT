import AxiomItemData from "./base.mjs";

const fields = foundry.data.fields;

export default class AxiomTraitData extends AxiomItemData {
  static DEFAULT_ICON = "systems/axiom/assets/icons/items/trait.svg";


  static defineSchema() {
    return {
      ...super.descriptionFields(),
      category: new fields.StringField({ required: true, choices: ["quality", "flaw"], initial: "quality" })
    };
  }
}
