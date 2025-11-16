export default class axiomActor extends Actor {

    prepareData() {

        // In case some steps need to be overwritten later

        super.prepareData();
    }

    prepareDerivedData() {

        const actorData = this.system;

        // add possibility for switch Statement on the different actor types

        this._preparePlayerCharacterData(actorData);
    }

    _preparePlayerCharacterData(actorData) {

        // Calculation of Base Character values

        this._setCharacterValues(actorData);
    }

    async _setCharacterValues(data) {

        // Calculation of values here
    }

    setNote(note) {

        // Method to update character notes

        this.update({ "system.note": note});
    }

    addLogEntry(Entry) {

        // Add a log entry to the character event log

        let log = this.system.log;
        log.push(Entry);
        this.update({ "system.log": log});
    }
    
}