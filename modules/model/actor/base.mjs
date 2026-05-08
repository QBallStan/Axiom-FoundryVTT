import { AxiomAttributesModel } from "./components/characteristics.mjs";
import { AxiomTrackersModel } from "./components/trackers.mjs";
import { AxiomWoundsModel } from "./components/wounds.mjs";
import { AxiomDetailsModel } from "./components/details.mjs";

const fields = foundry.data.fields;

export default class AxiomActorBaseData extends foundry.abstract.TypeDataModel {
  static DEFAULT_ICON = "systems/axiom/assets/icons/actors/protagonist.svg";
  static DEFAULT_TOKEN_ICON = "systems/axiom/assets/icons/actors/protagonist.svg";

  static defineSchema() {
    return {
      attributes: new fields.EmbeddedDataField(AxiomAttributesModel),
      size: new fields.NumberField({
        required: true,
        integer: true,
        initial: 0,
      }),
      trackers: new fields.EmbeddedDataField(AxiomTrackersModel),
      wounds: new fields.EmbeddedDataField(AxiomWoundsModel),
      subAttributes: new fields.SchemaField({
        movement: new fields.NumberField({
          required: true,
          integer: true,
          initial: 6,
        }),
        initiative: new fields.NumberField({
          required: true,
          integer: true,
          initial: 4,
        }),
        damageModifier: new fields.NumberField({
          required: true,
          integer: true,
          initial: 0,
        }),
        toughness: new fields.NumberField({
          required: true,
          integer: true,
          initial: 4,
        }),
        corruptionThreshold: new fields.NumberField({
          required: true,
          integer: true,
          initial: 6,
        }),
      }),
      corruption: new fields.SchemaField({
        current: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 })
      }),
      currency: new fields.SchemaField({
        value: new fields.StringField({ required: false, blank: true, initial: "" }),
        coins: new fields.SchemaField({
          gold: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
          silver: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
          copper: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 })
        })
      }),
      statuses: new fields.SchemaField({
        burning: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        bleeding: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        stunned: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        chilled: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        corroding: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        entangled: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        fatigue: new fields.NumberField({ required: true, integer: true, min: 0, max: 5, initial: 0 }),
        prone: new fields.NumberField({ required: true, integer: true, min: 0, max: 1, initial: 0 }),
        fear: new fields.NumberField({ required: true, integer: true, min: 0, max: 1, initial: 0 }),
        lightCover: new fields.NumberField({ required: true, integer: true, min: 0, max: 1, initial: 0 }),
        mediumCover: new fields.NumberField({ required: true, integer: true, min: 0, max: 1, initial: 0 }),
        heavyCover: new fields.NumberField({ required: true, integer: true, min: 0, max: 1, initial: 0 }),
        incapacitated: new fields.NumberField({ required: true, integer: true, min: 0, max: 1, initial: 0 }),
        dead: new fields.NumberField({ required: true, integer: true, min: 0, max: 1, initial: 0 }),
      }),
      details: new fields.EmbeddedDataField(AxiomDetailsModel),
    };
  }

  prepareDerivedData() {
    super.prepareDerivedData();

    this.attributes.compute();
    this.wounds.compute();

    const strength = this.attributes.strength.value;
    const agility = this.attributes.agility.value;
    const fortitude = this.attributes.fortitude.value;
    const resolve = this.attributes.resolve.value;
    const instinct = this.attributes.instinct.value;
    const size = Number(this.size ?? 0);

    this.subAttributes.movement = this.constructor.calculateMovement(agility);
    this.subAttributes.initiative = this.constructor.calculateInitiative(agility, instinct);
    this.subAttributes.toughness = this.constructor.calculateToughness(fortitude);
    this.subAttributes.corruptionThreshold = this.constructor.calculateCorruption(resolve);
    this.subAttributes.damageModifier = this.constructor.calculateDamageModifier(strength, size);
  }

  static calculateMovement(agility) {
    return 4 + Math.ceil(Number(agility ?? 0) / 5);
  }

  static calculateInitiative(agility, instinct) {
    return Math.ceil((Number(agility ?? 0) + Number(instinct ?? 0)) / 5);
  }

  static calculateToughness(fortitude) {
    return Math.ceil(Number(fortitude ?? 0) / 5);
  }

  static calculateCorruption(resolve) {
    return 4 + Math.ceil(Number(resolve ?? 0) / 5);
  }

  static calculateDamageModifier(strength, size = 0) {
    const strengthValue = Math.max(Number(strength ?? 0), 1);
    return Math.ceil(strengthValue / 5) - 3 + Number(size ?? 0);
  }
}
