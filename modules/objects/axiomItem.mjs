export default class axiomItem extends Item {

  /** Prepare base and derived item data */
  prepareData() {
    super.prepareData();

    // In case you want item typed logic later
    const itemData = this.system;

    switch (this.type) {
      case "skill":
        this._prepareSkill(itemData);
        break;

      case "armor":
        this._prepareArmor(itemData);
        break;

      case "weapon":
        this._prepareWeapon(itemData);
        break;
    }
  }

  _prepareSkill(data) {
    // Future logic, for now nothing
  }

  _prepareArmor(data) {
    // Future logic
  }

  _prepareWeapon(data) {
    // Future logic
  }

}
