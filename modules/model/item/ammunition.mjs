import AxiomItemData from "./base.mjs";

export default class AxiomAmmunitionData extends AxiomItemData {
  static DEFAULT_ICON = "systems/axiom/assets/icons/items/ammo.svg";


  static defineSchema() {
    return super.commonFields();
  }
}
