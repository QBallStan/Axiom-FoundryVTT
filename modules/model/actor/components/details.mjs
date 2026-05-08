const fields = foundry.data.fields;

export class AxiomDetailsModel extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      xp: new fields.SchemaField({
        current: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        spent: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        total: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 })
      }),
      firstName: new fields.StringField({ required: false, blank: true, initial: "" }),
      lastName: new fields.StringField({ required: false, blank: true, initial: "" }),
      species: new fields.StringField({ required: false, blank: true, initial: "" }),
      culture: new fields.StringField({ required: false, blank: true, initial: "" }),
      profession: new fields.StringField({ required: false, blank: true, initial: "" }),
      role: new fields.StringField({ required: false, blank: true, initial: "" }),
      disposition: new fields.StringField({ required: false, blank: true, initial: "" }),
      morale: new fields.StringField({ required: false, blank: true, initial: "" }),
      treasure: new fields.StringField({ required: false, blank: true, initial: "" }),
      age: new fields.StringField({ required: false, blank: true, initial: "" }),
      height: new fields.StringField({ required: false, blank: true, initial: "" }),
      weight: new fields.StringField({ required: false, blank: true, initial: "" }),
      eyeColor: new fields.StringField({ required: false, blank: true, initial: "" }),
      hairColor: new fields.StringField({ required: false, blank: true, initial: "" }),
      skinTone: new fields.StringField({ required: false, blank: true, initial: "" }),
      distinguishingMarks: new fields.StringField({ required: false, blank: true, initial: "" }),
      origin: new fields.StringField({ required: false, blank: true, initial: "" }),
      faction: new fields.StringField({ required: false, blank: true, initial: "" }),
      biography: new fields.HTMLField({ required: false, blank: true, initial: "" }),
      notes: new fields.HTMLField({ required: false, blank: true, initial: "" })
    };
  }
}
