import { isMeleeWeaponItem, isWeaponItem } from "../items.mjs";

const ODD_DOUBLES = new Set([11, 33, 55, 77, 99]);

/**
 * Central roll logic for Axiom//Core d100 roll-under tests.
 * Kept independent from sheets/apps so chat cards, opposed rolls, and combat
 * automation can all consume the same result object later.
 */
export default class AxiomRoll {
  static async test({ actor, title, testType = "skill", attributeOne, attributeTwo, skillValue = 0, difficulty = 0, modifiers = 0, item = null, rollMode = "public" } = {}) {
    const roll = await new Roll("1d100").evaluate();
    const d100 = Number(roll.total ?? 0);
    const basePool = this.calculateBasePool(actor, attributeOne, attributeTwo, skillValue);
    const rawSuccessTarget = basePool + Number(difficulty ?? 0) + Number(modifiers ?? 0);
    const successTarget = Math.min(150, Math.max(5, rawSuccessTarget));
    const result = this.evaluateResult({ d100, successTarget });

    return {
      actor,
      item,
      title,
      testType,
      roll,
      rollMode,
      attributeOne,
      attributeTwo,
      skillValue: Number(skillValue ?? 0),
      basePool,
      difficulty: Number(difficulty ?? 0),
      modifiers: Number(modifiers ?? 0),
      rawSuccessTarget,
      successTarget,
      ...result,
      isWeaponRoll: isWeaponItem(item)
    };
  }

  static calculateBasePool(actor, attributeOne, attributeTwo, skillValue = 0) {
    const first = this.getAttributeValue(actor, attributeOne);
    const second = this.getAttributeValue(actor, attributeTwo ?? attributeOne);
    return first + second + Number(skillValue ?? 0);
  }

  static getAttributeValue(actor, key) {
    const attribute = actor?.system?.attributes?.[key];
    if (!attribute) return 0;

    if (attribute.value !== undefined) return Number(attribute.value ?? 0);

    // In V14 data models, computed properties are not always present in the
    // serialized form used by applications. Fall back to the stored parts so
    // roll previews remain accurate inside the roll window.
    return Number(attribute.base ?? 0) + Number(attribute.adv ?? 0) + Number(attribute.mod ?? 0);
  }



  static getHitLocation(d100) {
    const reversed = this.getReversedD100(d100);

    if (reversed >= 1 && reversed <= 10) return { key: "head", label: "AXIOM.RollCard.HitLocations.Head", value: reversed };
    if (reversed >= 11 && reversed <= 50) return { key: "torso", label: "AXIOM.RollCard.HitLocations.Torso", value: reversed };
    if (reversed >= 51 && reversed <= 60) return { key: "leftArm", label: "AXIOM.RollCard.HitLocations.LeftArm", value: reversed };
    if (reversed >= 61 && reversed <= 70) return { key: "rightArm", label: "AXIOM.RollCard.HitLocations.RightArm", value: reversed };
    if (reversed >= 71 && reversed <= 85) return { key: "leftLeg", label: "AXIOM.RollCard.HitLocations.LeftLeg", value: reversed };
    return { key: "rightLeg", label: "AXIOM.RollCard.HitLocations.RightLeg", value: reversed };
  }

  static getReversedD100(value) {
    const rollValue = this.normalizeD100(value);
    const display = this.formatD100(rollValue);
    return this.normalizeD100([...display].reverse().join(""));
  }

  static formatWeaponDamage({ damage = 0, armorPenetration = 0, damageModifier = 0, hits = 0 } = {}) {
    const baseDamage = Number(damage ?? 0);
    const modifier = Number(damageModifier ?? 0);
    const hitDamage = Number(hits ?? 0);
    const totalDamage = Math.max(0, baseDamage + modifier + hitDamage);
    const ap = Number(armorPenetration ?? 0);
    return game.i18n.format("AXIOM.RollCard.WeaponDamageDisplay", { damage: totalDamage, ap });
  }

  static normalizeD100(value) {
    const stringValue = String(value ?? "").trim();
    if (stringValue === "" || stringValue === "00" || stringValue === "0") return 100;

    const number = Number(stringValue);
    if (!Number.isFinite(number)) return 100;
    return Math.min(100, Math.max(1, Math.trunc(number)));
  }

  static normalizeSuccessTarget(value) {
    const number = Number(String(value ?? "").trim());
    if (!Number.isFinite(number)) return 5;
    return Math.min(150, Math.max(5, Math.trunc(number)));
  }

  static evaluateResult({ d100, successTarget, hitModifier = 0 } = {}) {
    const rollValue = this.normalizeD100(d100);
    const target = Number(successTarget ?? 0);
    const automaticSuccess = rollValue >= 1 && rollValue <= 5;
    const automaticFailure = rollValue >= 96;
    const baseHits = Math.floor(target / 10) - Math.floor(rollValue / 10);
    const appliedHitModifier = Number(hitModifier ?? 0);
    const hits = baseHits + appliedHitModifier;

    const success = automaticSuccess || (!automaticFailure && rollValue <= target);
    const complication = ODD_DOUBLES.has(rollValue);
    const outcome = this.getOutcome({ success, hits });

    return {
      d100: rollValue,
      success,
      automaticSuccess,
      automaticFailure,
      baseHits,
      hitModifier: appliedHitModifier,
      hits,
      hitsDisplay: this.formatSigned(hits),
      complication,
      outcomeKey: outcome.key,
      outcomeLabel: outcome.label,
      outcomeTierLabel: outcome.tierLabel,
      outcomeCss: success ? "success" : "failure"
    };
  }

  static getOutcome({ success, hits }) {
    if (success) {
      if (hits >= 6) return { key: "exceptionalSuccess", label: "AXIOM.RollCard.Success", tierLabel: "AXIOM.RollCard.Outcomes.ExceptionalSuccess" };
      if (hits >= 4) return { key: "majorSuccess", label: "AXIOM.RollCard.Success", tierLabel: "AXIOM.RollCard.Outcomes.MajorSuccess" };
      if (hits >= 2) return { key: "strongSuccess", label: "AXIOM.RollCard.Success", tierLabel: "AXIOM.RollCard.Outcomes.StrongSuccess" };
      return { key: "narrowSuccess", label: "AXIOM.RollCard.Success", tierLabel: "AXIOM.RollCard.Outcomes.NarrowSuccess" };
    }

    if (hits <= -6) return { key: "exceptionalFailure", label: "AXIOM.RollCard.Failure", tierLabel: "AXIOM.RollCard.Outcomes.ExceptionalFailure" };
    if (hits <= -4) return { key: "majorFailure", label: "AXIOM.RollCard.Failure", tierLabel: "AXIOM.RollCard.Outcomes.MajorFailure" };
    if (hits <= -2) return { key: "strongFailure", label: "AXIOM.RollCard.Failure", tierLabel: "AXIOM.RollCard.Outcomes.StrongFailure" };
    return { key: "narrowFailure", label: "AXIOM.RollCard.Failure", tierLabel: "AXIOM.RollCard.Outcomes.NarrowFailure" };
  }

  static formatSigned(value) {
    const number = Number(value ?? 0);
    return number > 0 ? `+${number}` : `${number}`;
  }

  static formatD100(value) {
    const number = Number(value ?? 0);
    if (number === 100) return "00";
    return String(number).padStart(2, "0");
  }
}
