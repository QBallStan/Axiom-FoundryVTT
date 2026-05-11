import AxiomItemData from "./base.mjs";

const fields = foundry.data.fields;

export default class AxiomWeaponBaseData extends AxiomItemData {
  static commonWeaponFields({ category = "melee" } = {}) {
    return {
      ...super.commonFields(),
      category: new fields.StringField({ required: true, choices: ["melee", "ranged", "mixed"], initial: category }),
      skill: new fields.StringField({ required: false, blank: true, initial: "" }),
      meleeSkill: new fields.StringField({ required: false, blank: true, initial: "Melee" }),
      rangedSkill: new fields.StringField({ required: false, blank: true, initial: "Marksmanship" }),
      damage: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      armorPenetration: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      delivery: new fields.StringField({ required: true, choices: ["kinetic", "direct"], initial: "kinetic" }),
      elemental: new fields.StringField({ required: false, blank: true, initial: "" }),
      hands: new fields.StringField({ required: true, choices: ["one", "two", "versatile"], initial: "one" }),
      minStrength: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      parryBonus: new fields.NumberField({ required: true, integer: true, initial: 0 })
    };
  }
}
