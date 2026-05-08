const fields = foundry.data.fields;

export class AxiomAttributesModel extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      strength: new fields.EmbeddedDataField(AxiomAttributeModel),
      agility: new fields.EmbeddedDataField(AxiomAttributeModel),
      fortitude: new fields.EmbeddedDataField(AxiomAttributeModel),
      logic: new fields.EmbeddedDataField(AxiomAttributeModel),
      resolve: new fields.EmbeddedDataField(AxiomAttributeModel),
      charisma: new fields.EmbeddedDataField(AxiomAttributeModel),
      instinct: new fields.EmbeddedDataField(AxiomAttributeModel),
      power: new fields.EmbeddedDataField(AxiomAttributeModel)
    };
  }

  compute() {
    for (const attribute of Object.values(this)) {
      if (attribute instanceof AxiomAttributeModel) attribute.computeValue();
    }
  }
}

export class AxiomAttributeModel extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      base: new fields.NumberField({ required: true, integer: true, initial: 10 }),
      adv: new fields.NumberField({ required: true, integer: true, initial: 0 }),
      mod: new fields.NumberField({ required: true, integer: true, initial: 0 }),
      max: new fields.NumberField({ required: true, integer: true, initial: 20 })
    };
  }

  computeValue() {
    this.value = Number(this.base ?? 0) + Number(this.adv ?? 0) + Number(this.mod ?? 0);
  }
}
