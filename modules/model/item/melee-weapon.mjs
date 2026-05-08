import AxiomWeaponBaseData from "./weapon-base.mjs";

export default class AxiomMeleeWeaponData extends AxiomWeaponBaseData {
  static DEFAULT_ICON = "systems/axiom/assets/icons/items/weapon-melee.svg";


  static defineSchema() {
    return this.commonWeaponFields({ category: "melee" });
  }
}
