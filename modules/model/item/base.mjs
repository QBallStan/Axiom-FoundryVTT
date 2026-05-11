const fields = foundry.data.fields;

const ITEM_GENRE_TAGS = [
  "primitive",
  "ancient",
  "medieval",
  "renaissance",
  "industrial",
  "modern",
  "nearFuture",
  "cyberpunk",
  "sciFi",
  "postApocalyptic",
  "fantasy",
  "horror",
  "universal"
];

export default class AxiomItemData extends foundry.abstract.TypeDataModel {
  static genreFields() {
    return {
      genre: new fields.SchemaField({
        tag: new fields.ArrayField(
          new fields.StringField({ required: true, choices: ITEM_GENRE_TAGS, initial: "universal" }),
          { required: true, initial: [] }
        )
      })
    };
  }

  static descriptionFields() {
    return {
      ...this.genreFields(),
      description: new fields.SchemaField({
        value: new fields.HTMLField({ required: false, blank: true, initial: "" })
      })
    };
  }

  static descriptionField() {
    return this.descriptionFields();
  }

  static commonFields() {
    return {
      ...this.descriptionFields(),
      price: new fields.StringField({ required: false, blank: true, initial: "" }),
      priceCoins: new fields.SchemaField({
        gold: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        silver: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        copper: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 })
      }),
      weight: new fields.NumberField({ required: true, min: 0, initial: 0 }),
      quantity: new fields.NumberField({ required: true, integer: true, min: 0, initial: 1 }),
      availability: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      state: new fields.StringField({ required: true, choices: ["equipped", "carried", "stored", "mainHand", "offHand", "bothHands"], initial: "carried" })
    };
  }

  static defineSchema() {
    return this.commonFields();
  }
}
