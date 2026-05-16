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
        sprinting: new fields.NumberField({ required: true, integer: true, min: 0, max: 3, initial: 0 }),
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
    this.computeDerivedSubAttributes();
    this.computeDerivedTrackers();
  }

  computeDerivedSubAttributes() {
    const strength = this.attributes.strength.value;
    const agility = this.attributes.agility.value;
    const fortitude = this.attributes.fortitude.value;
    const resolve = this.attributes.resolve.value;
    const instinct = this.attributes.instinct.value;
    const size = Number(this.size ?? 0);

    this.subAttributes.movement = this.applyDerivedActiveEffects(
      this.constructor.calculateMovement(agility),
      "system.subAttributes.movement"
    );
    this.subAttributes.initiative = this.applyDerivedActiveEffects(
      this.constructor.calculateInitiative(agility, instinct),
      "system.subAttributes.initiative"
    );
    this.subAttributes.toughness = this.applyDerivedActiveEffects(
      this.constructor.calculateToughness(fortitude),
      "system.subAttributes.toughness"
    );
    this.subAttributes.corruptionThreshold = this.applyDerivedActiveEffects(
      this.constructor.calculateCorruption(resolve),
      "system.subAttributes.corruptionThreshold"
    );
    this.subAttributes.damageModifier = this.applyDerivedActiveEffects(
      this.constructor.calculateDamageModifier(strength, size),
      "system.subAttributes.damageModifier"
    );
  }

  computeDerivedTrackers() {
    const actionPoints = this.trackers?.actionPoints;
    if (!actionPoints) return;

    const sourceMax = foundry.utils.getProperty(this.parent?._source, "system.trackers.actionPoints.max");
    const rawMax = Number(sourceMax ?? actionPoints.max ?? 0);
    const baseMax = Number.isFinite(rawMax) ? Math.max(0, rawMax) : 0;
    const effectiveMax = this.applyDerivedActiveEffects(baseMax, "system.trackers.actionPoints.max");
    actionPoints.max = baseMax > 0 ? Math.max(1, effectiveMax) : Math.max(0, effectiveMax);

    const current = Number(actionPoints.current ?? 0);
    if (Number.isFinite(current)) actionPoints.current = Math.min(current, actionPoints.max);
  }

  applyDerivedActiveEffects(baseValue, key) {
    let value = Number(baseValue ?? 0);
    if (!Number.isFinite(value)) value = 0;

    const changes = [];
    for (const effect of this._getApplicableActiveEffects()) {
      if (effect.disabled || effect.getFlag?.("axiom", "conditional")) continue;

      for (const change of effect.changes ?? []) {
        if (change?.key !== key) continue;
        const changeValue = Number(change.value ?? 0);
        if (!Number.isFinite(changeValue)) continue;

        changes.push({
          type: this.constructor.normalizeActiveEffectChangeType(change),
          value: changeValue,
          priority: Number(change.priority ?? 0) || 0
        });
      }
    }

    changes.sort((a, b) => a.priority - b.priority);

    for (const change of changes) {
      if (change.type === "multiply") value *= change.value;
      else if (change.type === "override") value = change.value;
      else if (change.type === "upgrade") value = Math.max(value, change.value);
      else if (change.type === "downgrade") value = Math.min(value, change.value);
      else if (change.type === "subtract") value -= change.value;
      else value += change.value;
    }

    return Math.trunc(value);
  }

  _getApplicableActiveEffects() {
    const actor = this.parent;
    if (!actor) return [];

    if (typeof actor.allApplicableEffects === "function") {
      return Array.from(actor.allApplicableEffects());
    }

    return Array.from(actor.effects ?? []);
  }

  static normalizeActiveEffectChangeType(change) {
    const type = change?.type ?? change?.mode ?? "add";
    if (typeof type === "string") return type.toLowerCase();

    const modes = globalThis.CONST?.ACTIVE_EFFECT_MODES ?? {};
    if (type === modes.MULTIPLY || type === 1) return "multiply";
    if (type === modes.ADD || type === 2) return "add";
    if (type === modes.DOWNGRADE || type === 3) return "downgrade";
    if (type === modes.UPGRADE || type === 4) return "upgrade";
    if (type === modes.OVERRIDE || type === 5) return "override";
    return "add";
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
