const fields = foundry.data.fields;

/**
 * Minimal ActiveEffect system data for Axiom conditions.
 *
 * WFRP stores numbered condition counters on `system.condition.value`, and
 * its token icon renderer reads that value directly while drawing the effect
 * icon. Axiom mirrors that shape so stack counters are available at token draw
 * time instead of being recovered from actor sheet flags after the fact.
 */
export class AxiomActiveEffectData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      condition: new fields.SchemaField({
        value: new fields.NumberField({ required: false, nullable: true, integer: true, min: 0, initial: null }),
        numbered: new fields.BooleanField({ required: true, initial: false }),
        trigger: new fields.StringField({ required: false, blank: true, initial: "" })
      })
    };
  }
}

const { ActiveEffect } = foundry.documents;

export class AxiomActiveEffect extends ActiveEffect {
  apply(actor, change) {
    if (this.isConditional) return;
    return super.apply(actor, change);
  }

  get isConditional() {
    return Boolean(this.getFlag?.("axiom", "conditional"));
  }

  get conditionValue() {
    return Number(
      foundry.utils.getProperty(this, "system.condition.value")
      ?? this.getFlag?.("axiom", "value")
      ?? 0
    ) || 0;
  }

  get isNumberedCondition() {
    return Boolean(
      foundry.utils.getProperty(this, "system.condition.numbered")
      ?? this.getFlag?.("axiom", "numbered")
    );
  }
}
