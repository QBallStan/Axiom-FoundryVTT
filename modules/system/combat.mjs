import AxiomRoll from "./rolls/axiom-roll.mjs";
import { isMeleeWeaponItem, isRangedWeaponItem } from "./items.mjs";

/**
 * Combat helpers for Axiom//Core.
 *
 * This module owns first-pass attack automation while keeping the workflow
 * transparent. It resolves defense rolls, unopposed attacks, mitigation, wound
 * severity, and optional wound application from chat cards.
 */
export default class AxiomCombat extends foundry.documents.Combat {

  static FLAGS = {
    activationStartAp: "activationStartAp",
    activationKey: "activationKey",
    pass: "pass"
  };

  async nextTurn() {
    if (!this.started || !game.user?.isGM) return super.nextTurn();

    await this._applyIdleActionPointLoss();
    const nextActivation = this._findNextAxiomActivation();
    if (nextActivation) {
      await this.update({
        turn: nextActivation.turn,
        [`flags.axiom.${AxiomCombat.FLAGS.pass}`]: nextActivation.pass
      });
      await AxiomCombat.onCombatTurnStart(this);
      return this;
    }

    await this._startNextAxiomRound();
    await AxiomCombat.onCombatTurnStart(this);
    return this;
  }

  async forceNextTurn() {
    if (!this.started || !game.user?.isGM) return super.nextTurn();

    const turns = this.turns ?? [];
    if (!turns.length) return this;

    const currentTurn = Number.isInteger(this.turn) ? this.turn : -1;
    const wraps = currentTurn >= turns.length - 1;
    const nextTurn = wraps ? 0 : currentTurn + 1;
    const updateData = {
      turn: nextTurn,
      [`flags.axiom.${AxiomCombat.FLAGS.pass}`]: wraps ? 1 : this.getAxiomPass()
    };

    if (wraps) {
      updateData.round = Math.max(1, Number(this.round ?? 0) + 1);
      await this._restoreAllActionPoints();
    }

    await this.update(updateData);
    await AxiomCombat.onCombatTurnStart(this);
    return this;
  }

  async previousTurn() {
    return super.previousTurn();
  }

  async _applyIdleActionPointLoss() {
    const combatant = this.combatant;
    const actor = combatant?.actor;
    const tracker = AxiomCombat.getActionPointTracker(actor);
    if (!combatant || !actor || !tracker) return;

    const startAp = Number(combatant.getFlag?.("axiom", AxiomCombat.FLAGS.activationStartAp));
    if (!Number.isFinite(startAp) || startAp <= 0) return;

    const current = Number(tracker.current ?? 0);
    const min = Number(tracker.min ?? 0);
    if (!Number.isFinite(current) || current <= min) return;

    // If the combatant has not spent AP since this activation began, advancing
    // the turn counts as doing nothing and costs 1 AP.
    if (current >= startAp) {
      await actor.update({ "system.trackers.actionPoints.current": Math.max(min, current - 1) });
    }
  }

  getAxiomPass() {
    const value = Number(this.getFlag?.("axiom", AxiomCombat.FLAGS.pass) ?? 1);
    return Number.isFinite(value) && value > 0 ? value : 1;
  }

  _findNextAxiomActivation() {
    const turns = this.turns ?? [];
    if (!turns.length) return null;

    const currentTurn = Number.isInteger(this.turn) ? this.turn : -1;
    const currentPass = this.getAxiomPass();
    const hasAp = combatant => AxiomCombat.getActionPointCurrent(combatant?.actor) > 0;

    for (let index = currentTurn + 1; index < turns.length; index += 1) {
      if (hasAp(turns[index])) return { turn: index, pass: currentPass };
    }

    for (let index = 0; index <= currentTurn; index += 1) {
      if (hasAp(turns[index])) return { turn: index, pass: currentPass + 1 };
    }

    return null;
  }

  async _startNextAxiomRound() {
    await this._restoreAllActionPoints();

    const firstTurn = (this.turns ?? []).findIndex(combatant => AxiomCombat.getActionPointCurrent(combatant?.actor) > 0);
    const nextRound = Math.max(1, Number(this.round ?? 0) + 1);
    return this.update({
      round: nextRound,
      turn: Math.max(0, firstTurn),
      [`flags.axiom.${AxiomCombat.FLAGS.pass}`]: 1
    });
  }

  async _restoreAllActionPoints() {
    const updates = [];
    for (const combatant of this.combatants ?? []) {
      const actor = combatant.actor;
      const tracker = AxiomCombat.getActionPointTracker(actor);
      if (!actor || !tracker) continue;

      const max = Number(tracker.max ?? 0);
      if (!Number.isFinite(max)) continue;
      updates.push(actor.update({ "system.trackers.actionPoints.current": Math.max(0, max) }));
    }
    await Promise.all(updates);
  }

  static getActionPointTracker(actor) {
    return actor?.system?.trackers?.actionPoints ?? null;
  }

  static getActionPointCurrent(actor) {
    const tracker = this.getActionPointTracker(actor);
    if (!tracker) return 0;
    const current = Number(tracker.current ?? 0);
    return Number.isFinite(current) ? current : 0;
  }

  static getMomentumTracker(actor) {
    return actor?.system?.trackers?.momentum ?? null;
  }

  static async onCombatTurnStart(combat) {
    if (!game.user?.isGM || !combat?.started) return;

    const combatant = combat.combatant;
    const actor = combatant?.actor;
    if (!combatant || !actor) return;

    const activationKey = `${combat.id}:${combat.round}:${combat.getAxiomPass?.() ?? 1}:${combat.turn}:${combatant.id}`;
    if (combatant.getFlag?.("axiom", this.FLAGS.activationKey) === activationKey) return;

    await this.stepMomentumTowardZero(actor);

    const ap = this.getActionPointCurrent(actor);
    await combatant.setFlag?.("axiom", this.FLAGS.activationStartAp, ap);
    await combatant.setFlag?.("axiom", this.FLAGS.activationKey, activationKey);
    ui.combat?.render?.();
  }

  static async onCombatStart(combat) {
    if (!game.user?.isGM || !combat) return;
    await combat._restoreAllActionPoints?.();
    await this.onCombatTurnStart(combat);
  }

  static async stepMomentumTowardZero(actor) {
    const tracker = this.getMomentumTracker(actor);
    if (!tracker) return;

    const current = Number(tracker.current ?? 0);
    if (!Number.isFinite(current) || current === 0) return;

    const min = Number(tracker.min ?? -5);
    const max = Number(tracker.max ?? 5);
    const next = Math.min(max, Math.max(min, current + (current > 0 ? -1 : 1)));
    if (next === current) return;

    await actor.update({ "system.trackers.momentum.current": next });
  }

  static SETTINGS = {
    dodgeSkillName: "dodgeSkillName",
    unarmedCombatSkillName: "unarmedCombatSkillName"
  };

  static COVER_DEFENSE_BONUS = {
    lightCover: 10,
    mediumCover: 20,
    heavyCover: 30
  };

  static RANGE_MODIFIERS = {
    short: 10,
    medium: 0,
    long: -10,
    extreme: -30,
    outOfRange: -40
  };

  static STATUS_TEST_PENALTY_IDS = ["fatigue", "chilled", "entangled"];

  static getDodgeSkillName() {
    return this._getConfiguredSkillName(this.SETTINGS.dodgeSkillName, "Dodge");
  }

  static getUnarmedCombatSkillName() {
    return this._getConfiguredSkillName(this.SETTINGS.unarmedCombatSkillName, "Melee");
  }

  static getConfiguredCombatSkills() {
    return {
      dodge: this.getDodgeSkillName(),
      unarmed: this.getUnarmedCombatSkillName()
    };
  }

  static findDodgeSkill(actor) {
    return this.findActorSkillByName(actor, this.getDodgeSkillName());
  }

  static findUnarmedCombatSkill(actor) {
    return this.findActorSkillByName(actor, this.getUnarmedCombatSkillName());
  }

  static findActorSkillByName(actor, name) {
    const raw = String(name ?? "").trim();
    if (!actor || !raw) return null;

    const direct = actor.items?.get?.(raw);
    if (direct?.type === "skill") return direct;

    const normalized = this.normalizeSkillReference(raw);
    return actor.items
      ?.filter(item => item.type === "skill")
      .find(skill => this.getSkillAliases(skill).includes(normalized)) ?? null;
  }

  static getEquippedMeleeWeapons(actor) {
    if (!actor) return [];

    return actor.items
      ?.filter(item => isMeleeWeaponItem(item))
      .filter(item => (item.system?.state ?? "carried") === "equipped") ?? [];
  }

  static getPrimaryParrySkill(actor) {
    const equippedWeapon = this.getEquippedMeleeWeapons(actor).find(weapon => String(weapon.system?.skill ?? "").trim());
    if (equippedWeapon) {
      const skill = this.findActorSkillByName(actor, equippedWeapon.system.skill);
      if (skill) return { skill, weapon: equippedWeapon, source: "weapon" };
    }

    const skill = this.findUnarmedCombatSkill(actor);
    return skill ? { skill, weapon: null, source: "unarmed" } : null;
  }

  static getSkillAliases(skill) {
    const aliases = new Set([skill?.id, skill?.name]);
    const name = this.normalizeSkillReference(skill?.name);

    const standardAliases = {
      dodge: ["dodge", game.i18n.localize("AXIOM.Skill.Names.Dodge")],
      melee: ["melee", game.i18n.localize("AXIOM.Skill.Names.Melee")],
      marksmanship: ["marksmanship", game.i18n.localize("AXIOM.Skill.Names.Marksmanship")],
      athletics: ["athletics", game.i18n.localize("AXIOM.Skill.Names.Athletics")]
    };

    for (const [key, values] of Object.entries(standardAliases)) {
      if (values.map(value => this.normalizeSkillReference(value)).includes(name)) {
        aliases.add(key);
        values.forEach(value => aliases.add(value));
      }
    }

    return Array.from(aliases).map(value => this.normalizeSkillReference(value)).filter(Boolean);
  }

  static normalizeSkillReference(value) {
    return String(value ?? "")
      .trim()
      .toLocaleLowerCase(game.i18n.lang)
      .replaceAll(/[^\p{L}\p{N}]+/gu, "");
  }

  static warnMissingSkill(actor, skillName, actionLabel = "") {
    ui.notifications?.warn(game.i18n.format("AXIOM.Combat.MissingConfiguredSkill", {
      actor: actor?.name ?? game.i18n.localize("AXIOM.RollCard.UnknownActor"),
      skill: skillName,
      action: actionLabel || game.i18n.localize("AXIOM.Combat.Action")
    }));
  }

  static getSelectedDefender() {
    const targets = Array.from(game.user?.targets ?? []);
    if (targets.length !== 1) {
      ui.notifications?.warn(game.i18n.localize("AXIOM.Combat.TargetOneDefender"));
      return null;
    }

    const token = targets[0];
    if (!token?.actor) {
      ui.notifications?.warn(game.i18n.localize("AXIOM.Combat.TargetHasNoActor"));
      return null;
    }

    return token;
  }

  static getActorToken(actor) {
    if (!actor) return null;
    const controlled = canvas?.tokens?.controlled?.find(token => token.actor?.id === actor.id);
    if (controlled) return controlled;
    return actor.getActiveTokens?.(true, true)?.[0] ?? null;
  }

  static getRangeModifier({ attackerActor, weapon, targetToken } = {}) {
    if (!attackerActor || !weapon || !isRangedWeaponItem(weapon) || !targetToken) return null;

    const attackerToken = this.getActorToken(attackerActor);
    if (!attackerToken) return null;

    const distance = this.measureTokenDistance(attackerToken, targetToken);
    if (!Number.isFinite(distance)) return null;

    const range = Number(weapon.system?.range ?? 0);
    if (range <= 0) return null;

    let band = "medium";
    if (distance <= Math.ceil(range / 2)) band = "short";
    else if (distance <= range) band = "medium";
    else if (distance <= range * 2) band = "long";
    else if (distance <= range * 3) band = "extreme";
    else band = "outOfRange";

    return {
      band,
      distance,
      modifier: this.RANGE_MODIFIERS[band] ?? 0,
      label: `AXIOM.Combat.RangeBands.${band}`
    };
  }
  static getRangeModifierRow({ attackerActor, weapon, targetToken } = {}) {
    const range = this.getRangeModifier({ attackerActor, weapon, targetToken });
    if (!range || Number(range.modifier ?? 0) === 0) return null;

    return {
      id: "auto-range",
      label: range.label,
      value: Number(range.modifier ?? 0),
      active: true,
      automatic: true,
      locked: true,
      range: {
        band: range.band,
        distance: Number(range.distance ?? 0)
      }
    };
  }

  static applyTargetBasedAttackModifiers(state, targetToken) {
    const nextState = foundry.utils.deepClone(state ?? {});
    const attackerActor = game.actors?.get(nextState.actorId) ?? null;
    const weapon = attackerActor?.items?.get(nextState.itemId) ?? null;
    if (!attackerActor || !weapon || !isRangedWeaponItem(weapon) || !targetToken?.actor) return nextState;

    const rangeRow = this.getRangeModifierRow({ attackerActor, weapon, targetToken });
    const rows = Array.isArray(nextState.modifierRows) ? [...nextState.modifierRows] : [];
    const existingIndex = rows.findIndex(row => row.id === "auto-range");

    if (rangeRow) {
      if (existingIndex >= 0) rows[existingIndex] = { ...rows[existingIndex], ...rangeRow, active: rows[existingIndex].active !== false };
      else rows.push(rangeRow);
    } else if (existingIndex >= 0 && rows[existingIndex].locked) {
      rows.splice(existingIndex, 1);
    }

    nextState.modifierRows = rows;
    return nextState;
  }


  static measureTokenDistance(attackerToken, targetToken) {
    const origin = attackerToken.center ?? attackerToken.object?.center;
    const destination = targetToken.center ?? targetToken.object?.center;
    if (!origin || !destination) return null;

    if (canvas?.grid?.measurePath) {
      const result = canvas.grid.measurePath([origin, destination], { gridSpaces: true });
      if (Number.isFinite(Number(result?.distance))) return Number(result.distance);
      if (Array.isArray(result?.segments) && result.segments[0]?.distance !== undefined) return Number(result.segments[0].distance);
    }

    if (canvas?.grid?.measureDistance) return canvas.grid.measureDistance(origin, destination, { gridSpaces: true });

    const dx = destination.x - origin.x;
    const dy = destination.y - origin.y;
    const pixels = Math.hypot(dx, dy);
    const size = Number(canvas?.grid?.size ?? 1);
    const distance = Number(canvas?.scene?.grid?.distance ?? 1);
    return (pixels / size) * distance;
  }

  static getCoverBonus(actor) {
    if (!actor) return 0;
    for (const [statusId, bonus] of [["heavyCover", 30], ["mediumCover", 20], ["lightCover", 10]]) {
      const value = Number(actor.system?.statuses?.[statusId] ?? actor.getAxiomStatusValue?.(statusId) ?? 0);
      if (value > 0) return bonus;
    }
    return 0;
  }

  static getWoundPenalty(actor) {
    const wounds = actor?.system?.wounds;
    const storedPenalty = Number(wounds?.penalties?.total ?? NaN);
    if (Number.isFinite(storedPenalty)) return storedPenalty;

    const minor = Number(wounds?.minor?.current ?? Object.values(wounds?.minor?.slots ?? {}).filter(slot => slot?.taken).length ?? 0);
    const major = Number(wounds?.major?.current ?? Object.values(wounds?.major?.slots ?? {}).filter(slot => slot?.taken).length ?? 0);
    return (minor * -5) + (major * -10);
  }

  static getMomentumModifier(actor) {
    return Number(actor?.system?.trackers?.momentum?.current ?? 0) * 5;
  }

  static getStatusTestPenalty(actor) {
    if (!actor) return 0;
    return this.STATUS_TEST_PENALTY_IDS.reduce((total, statusId) => {
      const value = Number(actor.system?.statuses?.[statusId] ?? actor.getAxiomStatusValue?.(statusId) ?? 0);
      return total - (value * 5);
    }, 0);
  }

  static buildAutomaticModifierRows(actor, { includeCover = false } = {}) {
    const rows = [
      { id: "auto-wounds", label: "AXIOM.Roll.ModifierSources.WoundPenalty", value: this.getWoundPenalty(actor), automatic: true, locked: true },
      { id: "auto-momentum", label: "AXIOM.Roll.ModifierSources.Momentum", value: this.getMomentumModifier(actor), automatic: true, locked: true },
      { id: "auto-statuses", label: "AXIOM.Roll.ModifierSources.StatusPenalty", value: this.getStatusTestPenalty(actor), automatic: true, locked: true }
    ];

    if (includeCover) {
      rows.push({ id: "auto-cover", label: "AXIOM.Combat.Cover", value: this.getCoverBonus(actor), automatic: true, locked: true });
    }

    return rows.filter(row => Number(row.value ?? 0) !== 0);
  }

  static getSkillRollParts(actor, skill) {
    const attributeOne = skill?.system?.attributeOne ?? "strength";
    const attributeTwo = skill?.system?.attributeTwo ?? attributeOne;
    const skillValue = Number(skill?.system?.level ?? 0);
    const basePool = AxiomRoll.calculateBasePool(actor, attributeOne, attributeTwo, skillValue);
    return { attributeOne, attributeTwo, skillValue, basePool };
  }

  static getAttackData(state) {
    const rows = Array.isArray(state.modifierRows) ? state.modifierRows : [];
    const activeModifierTotal = rows.reduce((sum, row) => row.active === false ? sum : sum + Number(row.value ?? 0), 0);
    const successTarget = Math.min(120, Math.max(5, Number(state.basePool ?? 0) + Number(state.difficulty ?? 0) + activeModifierTotal));
    const result = AxiomRoll.evaluateResult({ d100: state.d100, successTarget, hitModifier: Number(state.fateHitBonus ?? 0) });
    return { ...result, successTarget, activeModifierTotal };
  }

  static async rollDefense(state, defenseType) {
    const defenderToken = this.getSelectedDefender();
    if (!defenderToken) return null;

    const defender = defenderToken.actor;
    const attackActor = game.actors?.get(state.actorId) ?? null;
    const weapon = attackActor?.items?.get(state.itemId) ?? null;
    const isRanged = (state.weaponInfo?.category ?? weapon?.system?.category) === "ranged";

    let skill = null;
    let defenseLabel = "";
    if (defenseType === "parry") {
      const parry = this.getPrimaryParrySkill(defender);
      skill = parry?.skill ?? null;
      defenseLabel = parry?.weapon
        ? game.i18n.format("AXIOM.Combat.ParryWith", { weapon: parry.weapon.name })
        : game.i18n.localize("AXIOM.Combat.Parry");
      if (!skill) {
        this.warnMissingSkill(defender, this.getUnarmedCombatSkillName(), game.i18n.localize("AXIOM.Combat.Parry"));
        return null;
      }
    } else {
      skill = this.findDodgeSkill(defender);
      defenseLabel = game.i18n.localize("AXIOM.Combat.Dodge");
      if (!skill) {
        this.warnMissingSkill(defender, this.getDodgeSkillName(), game.i18n.localize("AXIOM.Combat.Dodge"));
        return null;
      }
    }

    const roll = await new Roll("1d100").evaluate();
    const parts = this.getSkillRollParts(defender, skill);
    const modifierRows = this.buildAutomaticModifierRows(defender, { includeCover: isRanged });
    const modifierTotal = modifierRows.reduce((sum, row) => sum + Number(row.value ?? 0), 0);
    const successTarget = Math.min(120, Math.max(5, parts.basePool + modifierTotal));
    const result = AxiomRoll.evaluateResult({ d100: roll.total, successTarget });
    const attack = this.getAttackData(state);
    const combatResult = this.resolveAttack({ state, attack, defender, defenderToken, defense: { ...result, roll, ...parts, modifierRows, modifierTotal, successTarget, type: defenseType, label: defenseLabel, skillName: skill.name } });

    return { roll, combatResult };
  }

  static resolveUnopposed(state) {
    const targetToken = this.getSelectedDefender();
    const defender = targetToken?.actor ?? null;
    const nextState = foundry.utils.deepClone(state);
    const existing = nextState.modifierRows?.find(row => row.id === "auto-unopposed");
    if (!existing) {
      nextState.modifierRows = [...(nextState.modifierRows ?? []), {
        id: "auto-unopposed",
        label: "AXIOM.Combat.UnopposedBonus",
        value: 20,
        active: true,
        automatic: true,
        locked: true
      }];
    }

    const attack = this.getAttackData(nextState);
    const combatResult = this.resolveAttack({ state: nextState, attack, defender, defenderToken: targetToken, defense: null, unopposed: true });
    return { state: nextState, combatResult };
  }

  static resolveAttack({ state, attack, defender = null, defenderToken = null, defense = null, unopposed = false } = {}) {
    const hitsAttack = Boolean(attack?.success) && (unopposed || Number(attack.hits ?? 0) > Number(defense?.hits ?? -999));
    const netHits = hitsAttack ? Number(attack.hits ?? 0) - Number(defense?.hits ?? 0) : 0;
    const hitLocation = state.isWeaponRoll ? AxiomRoll.getHitLocation(state.d100) : null;
    const damage = hitsAttack
      ? this.calculateDamage({ state, defender, hitLocation, netHits })
      : this.emptyDamage();

    return {
      resolved: true,
      unopposed,
      defenderActorId: defender?.id ?? "",
      defenderTokenId: defenderToken?.id ?? "",
      defenderName: defender?.name ?? game.i18n.localize("AXIOM.Combat.NoDefender"),
      defense: defense ? this.serializeDefense(defense) : null,
      attackHits: Number(attack?.hits ?? 0),
      attackHitsDisplay: AxiomRoll.formatSigned(attack?.hits ?? 0),
      defenseHits: Number(defense?.hits ?? 0),
      defenseHitsDisplay: AxiomRoll.formatSigned(defense?.hits ?? 0),
      netHits,
      netHitsDisplay: AxiomRoll.formatSigned(netHits),
      hitsAttack,
      outcomeLabel: hitsAttack ? "AXIOM.Combat.AttackHits" : "AXIOM.Combat.AttackMisses",
      outcomeCss: hitsAttack ? "hit" : "miss",
      hitLocation: hitLocation ? {
        key: hitLocation.key,
        value: hitLocation.value,
        label: hitLocation.label,
        labelText: game.i18n.localize(hitLocation.label)
      } : null,
      damage,
      canApplyWound: Boolean(hitsAttack && defender && damage.finalDamage > 0 && damage.woundSeverity),
      woundApplied: false
    };
  }

  static serializeDefense(defense) {
    return {
      type: defense.type,
      label: defense.label,
      skillName: defense.skillName,
      d100: AxiomRoll.normalizeD100(defense.d100),
      rollDisplay: AxiomRoll.formatD100(defense.d100),
      successTarget: Number(defense.successTarget ?? 0),
      basePool: Number(defense.basePool ?? 0),
      modifierTotal: Number(defense.modifierTotal ?? 0),
      modifierTotalDisplay: AxiomRoll.formatSigned(defense.modifierTotal ?? 0),
      hits: Number(defense.hits ?? 0),
      hitsDisplay: AxiomRoll.formatSigned(defense.hits ?? 0),
      success: Boolean(defense.success),
      complication: Boolean(defense.complication),
      outcomeTierLabel: defense.outcomeTierLabel
    };
  }

  static calculateDamage({ state, defender, hitLocation, netHits = 0 } = {}) {
    const weaponInfo = state.weaponInfo ?? {};
    const category = weaponInfo.category ?? "";
    const baseDamage = Number(weaponInfo.damage ?? 0);
    const damageModifier = category === "melee" ? Number(weaponInfo.damageModifier ?? 0) : 0;
    const armorPenetration = Number(weaponInfo.armorPenetration ?? 0);
    const delivery = weaponInfo.delivery ?? "kinetic";
    const rawDamage = Math.max(0, baseDamage + damageModifier + Number(netHits ?? 0));
    const armor = delivery === "direct" ? 0 : this.getArmorAtLocation(defender, hitLocation?.key);
    const effectiveArmor = delivery === "direct" ? 0 : Math.max(0, armor - armorPenetration);
    const toughness = Number(defender?.system?.subAttributes?.toughness ?? 0);
    const finalDamage = Math.max(0, rawDamage - effectiveArmor - toughness);
    const woundSeverity = this.getWoundSeverity(finalDamage);

    return {
      baseDamage,
      damageModifier,
      netHits: Number(netHits ?? 0),
      rawDamage,
      delivery,
      armor,
      armorPenetration,
      effectiveArmor,
      toughness,
      finalDamage,
      finalDamageDisplay: String(finalDamage),
      woundSeverity,
      woundSeverityLabel: woundSeverity ? `AXIOM.Combat.Wounds.${woundSeverity}` : "AXIOM.Combat.NoWound"
    };
  }

  static emptyDamage() {
    return {
      baseDamage: 0,
      damageModifier: 0,
      netHits: 0,
      rawDamage: 0,
      delivery: "",
      armor: 0,
      armorPenetration: 0,
      effectiveArmor: 0,
      toughness: 0,
      finalDamage: 0,
      finalDamageDisplay: "0",
      woundSeverity: "",
      woundSeverityLabel: "AXIOM.Combat.NoWound"
    };
  }

  static getArmorAtLocation(actor, hitLocationKey) {
    if (!actor || !hitLocationKey) return 0;
    const armorKey = this.getArmorKeyForLocation(hitLocationKey);
    return actor.items
      ?.filter(item => item.type === "armor" && item.system?.state === "equipped")
      .reduce((sum, item) => sum + Number(item.system?.armor?.[armorKey] ?? 0), 0) ?? 0;
  }

  static getArmorKeyForLocation(hitLocationKey) {
    if (hitLocationKey === "head") return "head";
    if (hitLocationKey === "torso") return "torso";
    if (["leftArm", "rightArm"].includes(hitLocationKey)) return "arms";
    if (["leftLeg", "rightLeg"].includes(hitLocationKey)) return "legs";
    return "torso";
  }

  static getWoundSeverity(finalDamage) {
    const damage = Number(finalDamage ?? 0);
    if (damage <= 0) return "";
    if (damage <= 2) return "grazing";
    if (damage <= 4) return "minor";
    if (damage <= 6) return "major";
    return "critical";
  }

  static async applyWound(combatResult) {
    const actor = game.actors?.get(combatResult?.defenderActorId);
    if (!actor) {
      ui.notifications?.warn(game.i18n.localize("AXIOM.Combat.ApplyWoundNoActor"));
      return null;
    }

    const severity = combatResult?.damage?.woundSeverity;
    if (!severity) {
      ui.notifications?.info(game.i18n.localize("AXIOM.Combat.NoWoundToApply"));
      return null;
    }

    const applied = this.findAvailableWoundSlot(actor, severity);
    if (!applied) {
      ui.notifications?.warn(game.i18n.format("AXIOM.Combat.NoWoundSlot", { actor: actor.name }));
      return null;
    }

    const updates = { [`system.wounds.${applied.severity}.slots.${applied.slot}.taken`]: true };
    if (applied.severity === "critical") updates["system.statuses.incapacitated"] = 1;
    await actor.update(updates);
    if (applied.severity === "critical") await actor.addStatus?.("incapacitated", 1);

    return applied;
  }

  static findAvailableWoundSlot(actor, startingSeverity) {
    const order = ["grazing", "minor", "major", "critical"];
    const start = Math.max(0, order.indexOf(startingSeverity));
    const slotOrder = ["one", "two", "three"];

    for (const severity of order.slice(start)) {
      const slots = actor.system?.wounds?.[severity]?.slots ?? {};
      for (const slot of slotOrder) {
        if (slots[slot] && !slots[slot].taken) return { severity, slot };
      }
    }

    return null;
  }

  static getInitialCombatTargetData() {
    const targets = this.getCombatTokensFromUserTargets();
    if (targets.length !== 1) return null;
    return this.serializeCombatTarget(targets[0], { assignedAfterRoll: false });
  }

  static serializeCombatTarget(token, { assignedAfterRoll = false } = {}) {
    if (!token?.actor) return null;
    return {
      tokenId: token.id ?? "",
      sceneId: canvas?.scene?.id ?? token.scene?.id ?? "",
      actorId: token.actor.id ?? "",
      name: token.name ?? token.actor.name ?? game.i18n.localize("AXIOM.Combat.NoDefender"),
      assignedAfterRoll: Boolean(assignedAfterRoll)
    };
  }

  static getTokenFromCombatTarget(target = {}) {
    if (!target) return null;
    const token = canvas?.tokens?.get?.(target.tokenId);
    if (token?.actor) return token;
    const actor = game.actors?.get(target.actorId);
    return actor?.getActiveTokens?.(true, true)?.[0] ?? null;
  }

  static getSelectedOrTargetedDefender({ warn = true } = {}) {
    const targets = this.getCombatTokensFromUserTargets();
    if (targets.length === 1) return targets[0];

    const controlled = canvas?.tokens?.controlled?.filter(token => token?.actor) ?? [];
    if (controlled.length === 1) return controlled[0];

    if (targets.length > 1 || controlled.length > 1) {
      if (warn) ui.notifications?.warn(game.i18n.localize("AXIOM.Combat.TargetOneDefender"));
      return null;
    }

    if (warn) ui.notifications?.warn(game.i18n.localize("AXIOM.Combat.SelectOrTargetDefender"));
    return null;
  }

  static async getDefenderForAttackMessage(attackMessage) {
    const attackState = attackMessage?.getFlag?.("axiom", "roll");
    if (!attackState?.isWeaponRoll) return null;

    let token = this.getTokenFromCombatTarget(attackState.combatTarget);
    let assignedAfterRoll = false;

    if (!token?.actor) {
      token = this.getSelectedOrTargetedDefender();
      assignedAfterRoll = true;
    }

    if (!token?.actor) return null;

    if (!attackState.combatTarget || assignedAfterRoll) {
      const ChatCard = game.axiom?.chat?.AxiomChatCard;
      if (ChatCard) {
        let nextState = ChatCard.normalizeState(attackState);
        nextState.combatTarget = this.serializeCombatTarget(token, { assignedAfterRoll });
        if (assignedAfterRoll) nextState = this.applyTargetBasedAttackModifiers(nextState, token);
        await ChatCard.replaceMessageState(attackMessage, nextState, { refreshLinkedResults: false });
      }
    }

    return token;
  }

  static buildOpposedDataFromAttackState(attackMessage, attackState, defenderToken, { unopposed = false } = {}) {
    const attack = this.getAttackData(attackState);
    return this.normalizeOpposedData({
      id: foundry.utils.randomID(),
      attackMessageId: attackMessage.id,
      assignedAfterRoll: Boolean(attackState.combatTarget?.assignedAfterRoll),
      attackType: attackState.weaponInfo?.category ?? "melee",
      attacker: {
        actorId: attackState.actorId ?? "",
        name: attackState.actorName ?? game.i18n.localize("AXIOM.RollCard.UnknownActor")
      },
      weapon: {
        itemId: attackState.itemId ?? "",
        name: attackState.title ?? "",
        damage: Number(attackState.weaponInfo?.damage ?? 0),
        armorPenetration: Number(attackState.weaponInfo?.armorPenetration ?? 0),
        damageModifier: Number(attackState.weaponInfo?.damageModifier ?? 0),
        delivery: attackState.weaponInfo?.delivery ?? "kinetic"
      },
      defender: defenderToken?.actor && !unopposed ? {
        tokenId: defenderToken.id,
        actorId: defenderToken.actor.id,
        name: defenderToken.name ?? defenderToken.actor.name
      } : {
        tokenId: defenderToken?.id ?? "",
        actorId: defenderToken?.actor?.id ?? "",
        name: defenderToken?.actor?.name ?? game.i18n.localize("AXIOM.Combat.NarrativeTarget")
      },
      attack: this.serializeAttackForOpposition(attackState, attack)
    });
  }

  static async resolveAttackCardDefense(attackMessage, defenseType) {
    const attackState = attackMessage?.getFlag?.("axiom", "roll");
    if (!attackState?.isWeaponRoll) return null;

    const defenderToken = await this.getDefenderForAttackMessage(attackMessage);
    if (!defenderToken?.actor) return null;

    const currentAttackState = attackMessage?.getFlag?.("axiom", "roll") ?? attackState;
    const opposedData = this.buildOpposedDataFromAttackState(attackMessage, currentAttackState, defenderToken);
    const defender = defenderToken.actor;

    let skill = null;
    let defenseLabel = "";
    if (defenseType === "parry") {
      const parry = this.getPrimaryParrySkill(defender);
      skill = parry?.skill ?? null;
      defenseLabel = parry?.weapon
        ? game.i18n.format("AXIOM.Combat.ParryWith", { weapon: parry.weapon.name })
        : game.i18n.localize("AXIOM.Combat.Parry");
      if (!skill) {
        this.warnMissingSkill(defender, this.getUnarmedCombatSkillName(), game.i18n.localize("AXIOM.Combat.Parry"));
        return null;
      }
    } else {
      skill = this.findDodgeSkill(defender);
      defenseLabel = game.i18n.localize("AXIOM.Combat.Dodge");
      if (!skill) {
        this.warnMissingSkill(defender, this.getDodgeSkillName(), game.i18n.localize("AXIOM.Combat.Dodge"));
        return null;
      }
    }

    const parts = this.getSkillRollParts(defender, skill);
    const modifierRows = this.buildAutomaticModifierRows(defender, { includeCover: opposedData.isRanged });
    const { default: AxiomRollWindow } = await import("../apps/roll-window.mjs");

    return new AxiomRollWindow({
      rollData: {
        actor: defender,
        item: skill,
        title: defenseLabel,
        testName: defenseLabel,
        testType: "defense",
        sourceType: "combat-defense",
        attributeOne: parts.attributeOne,
        attributeTwo: parts.attributeTwo,
        skillValue: parts.skillValue,
        modifierRows,
        combatDefense: {
          attackMessageId: attackMessage.id,
          defenseType,
          skillName: skill.name
        }
      }
    }).render({ force: true });
  }

  static async createCombatResultFromDefenseMessage(defenseMessage) {
    const defenseState = defenseMessage?.getFlag?.("axiom", "roll") ?? null;
    const attackMessageId = defenseState?.combatDefense?.attackMessageId;
    const attackMessage = attackMessageId ? game.messages?.get(attackMessageId) : null;
    const attackState = attackMessage?.getFlag?.("axiom", "roll") ?? null;
    if (!defenseState || !attackState?.isWeaponRoll || !attackMessage) return null;

    const defender = game.actors?.get(defenseState.actorId) ?? null;
    const defenderToken = this.getTokenFromCombatTarget(attackState.combatTarget) ?? this.getActorToken(defender);
    const opposedData = this.buildOpposedDataFromAttackState(attackMessage, attackState, defenderToken ?? { actor: defender, id: "", name: defender?.name });
    return this.createCombatResultCard({ opposedData, defenseState, defenseMessage, unopposed: false });
  }



  static async waitForDiceAnimation(message, { timeout = 5000, fallbackDelay = 1200 } = {}) {
    if (!game.dice3d) return;

    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

    try {
      if (typeof game.dice3d.waitFor3DAnimationByMessageID === "function" && message?.id) {
        await Promise.race([
          game.dice3d.waitFor3DAnimationByMessageID(message.id),
          sleep(timeout)
        ]);
        return;
      }
    } catch (error) {
      console.warn("Axiom | Dice So Nice animation wait failed", error);
      return;
    }

    await sleep(fallbackDelay);
  }


  static OPPOSED_TEMPLATE = "systems/axiom/templates/chat/opposed-test-card.hbs";
  static RESULT_TEMPLATE = "systems/axiom/templates/chat/combat-result-card.hbs";

  static getCombatTokensFromUserTargets() {
    return Array.from(game.user?.targets ?? []).filter(token => token?.actor);
  }

  static async createOpposedTestFromTargets(attackMessage, { allowMultipleChoice = true } = {}) {
    const attackState = attackMessage?.getFlag?.("axiom", "roll");
    if (!attackState?.isWeaponRoll) return null;

    const targets = this.getCombatTokensFromUserTargets();
    if (!targets.length) {
      ui.notifications?.warn(game.i18n.localize("AXIOM.Combat.TargetOneDefender"));
      return null;
    }

    if (targets.length === 1) return this.createOpposedTestCard({ attackMessage, attackState, defenderToken: targets[0], assignedAfterRoll: true });

    if (!allowMultipleChoice) {
      ui.notifications?.warn(game.i18n.localize("AXIOM.Combat.TargetOneDefender"));
      return null;
    }

    const choices = targets.map(token => `<option value="${token.id}">${foundry.utils.escapeHTML(token.name ?? token.actor?.name ?? "")}</option>`).join("");
    let tokenId = null;
    try {
      tokenId = await foundry.applications.api.DialogV2.prompt({
        window: { title: game.i18n.localize("AXIOM.Combat.ChooseDefender") },
        classes: ["axiom", "combat-dialog"],
        modal: true,
        content: `<div class="axiom"><div class="form-group"><label>${game.i18n.localize("AXIOM.Combat.Defender")}</label><select name="tokenId">${choices}</select></div></div>`,
        ok: {
          label: game.i18n.localize("AXIOM.Combat.AssignOpponent"),
          callback: (event, button) => button.form.elements.tokenId.value
        },
        rejectClose: false
      });
    } catch {
      return null;
    }

    const token = targets.find(target => target.id === tokenId) ?? targets[0];
    return this.createOpposedTestCard({ attackMessage, attackState, defenderToken: token, assignedAfterRoll: true });
  }

  static async createOpposedTestCard({ attackMessage, attackState, defenderToken, assignedAfterRoll = false } = {}) {
    if (!attackMessage || !attackState || !defenderToken?.actor) return null;

    const attack = this.getAttackData(attackState);
    const data = this.normalizeOpposedData({
      id: foundry.utils.randomID(),
      attackMessageId: attackMessage.id,
      assignedAfterRoll,
      attackType: attackState.weaponInfo?.category ?? "melee",
      attacker: {
        actorId: attackState.actorId ?? "",
        name: attackState.actorName ?? game.i18n.localize("AXIOM.RollCard.UnknownActor")
      },
      weapon: {
        itemId: attackState.itemId ?? "",
        name: attackState.title ?? "",
        damage: Number(attackState.weaponInfo?.damage ?? 0),
        armorPenetration: Number(attackState.weaponInfo?.armorPenetration ?? 0),
        damageModifier: Number(attackState.weaponInfo?.damageModifier ?? 0),
        delivery: attackState.weaponInfo?.delivery ?? "kinetic"
      },
      defender: {
        tokenId: defenderToken.id,
        actorId: defenderToken.actor.id,
        name: defenderToken.name ?? defenderToken.actor.name
      },
      attack: this.serializeAttackForOpposition(attackState, attack)
    });

    const content = await this.renderOpposedTest(data);
    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: game.actors?.get(attackState.actorId) ?? null }),
      content,
      cssClass: "axiom-roll-message",
      flags: { axiom: { combatOpposed: data } }
    });
  }

  static serializeAttackForOpposition(state, attack = this.getAttackData(state)) {
    const location = state.isWeaponRoll ? AxiomRoll.getHitLocation(state.d100) : null;
    return {
      d100: Number(attack.d100 ?? state.d100 ?? 100),
      rollDisplay: AxiomRoll.formatD100(attack.d100 ?? state.d100 ?? 100),
      successTarget: Number(attack.successTarget ?? 0),
      hits: Number(attack.hits ?? 0),
      hitsDisplay: AxiomRoll.formatSigned(attack.hits ?? 0),
      success: Boolean(attack.success),
      complication: Boolean(attack.complication),
      outcomeTierLabel: attack.outcomeTierLabel ?? "",
      hitLocation: location ? {
        key: location.key,
        value: location.value,
        label: location.label,
        labelText: game.i18n.localize(location.label)
      } : null
    };
  }

  static normalizeOpposedData(data = {}) {
    const attackType = data.attackType ?? "melee";

    return {
      id: data.id ?? foundry.utils.randomID(),
      attackMessageId: data.attackMessageId ?? "",
      assignedAfterRoll: Boolean(data.assignedAfterRoll),
      attackType,
      isMelee: attackType === "melee",
      isRanged: attackType === "ranged",
      attacker: {
        actorId: data.attacker?.actorId ?? "",
        name: data.attacker?.name ?? game.i18n.localize("AXIOM.RollCard.UnknownActor")
      },
      weapon: {
        itemId: data.weapon?.itemId ?? "",
        name: data.weapon?.name ?? "",
        damage: Number(data.weapon?.damage ?? 0),
        armorPenetration: Number(data.weapon?.armorPenetration ?? 0),
        damageModifier: Number(data.weapon?.damageModifier ?? 0),
        delivery: data.weapon?.delivery ?? "kinetic"
      },
      defender: {
        tokenId: data.defender?.tokenId ?? "",
        actorId: data.defender?.actorId ?? "",
        name: data.defender?.name ?? game.i18n.localize("AXIOM.Combat.NoDefender")
      },
      attack: data.attack ?? {}
    };
  }

  static async renderOpposedTest(data) {
    return foundry.applications.handlebars.renderTemplate(this.OPPOSED_TEMPLATE, { card: this.prepareOpposedCardData(data) });
  }

  static prepareOpposedCardData(data = {}) {
    const normalized = this.normalizeOpposedData(data);
    return {
      ...normalized,
      attackTypeLabel: normalized.isRanged ? "AXIOM.Combat.RangedAttack" : "AXIOM.Combat.MeleeAttack",
      showParry: normalized.isMelee,
      assignedAfterRollNote: normalized.assignedAfterRoll ? "AXIOM.Combat.AssignedAfterRollNote" : ""
    };
  }

  static async resolveOpposedDefense(opposedMessage, defenseType) {
    const opposedData = this.normalizeOpposedData(opposedMessage?.getFlag?.("axiom", "combatOpposed") ?? {});
    const defender = game.actors?.get(opposedData.defender.actorId);
    if (!defender) {
      ui.notifications?.warn(game.i18n.localize("AXIOM.Combat.TargetHasNoActor"));
      return null;
    }

    let skill = null;
    let defenseLabel = "";
    if (defenseType === "parry") {
      const parry = this.getPrimaryParrySkill(defender);
      skill = parry?.skill ?? null;
      defenseLabel = parry?.weapon
        ? game.i18n.format("AXIOM.Combat.ParryWith", { weapon: parry.weapon.name })
        : game.i18n.localize("AXIOM.Combat.Parry");
      if (!skill) {
        this.warnMissingSkill(defender, this.getUnarmedCombatSkillName(), game.i18n.localize("AXIOM.Combat.Parry"));
        return null;
      }
    } else {
      skill = this.findDodgeSkill(defender);
      defenseLabel = game.i18n.localize("AXIOM.Combat.Dodge");
      if (!skill) {
        this.warnMissingSkill(defender, this.getDodgeSkillName(), game.i18n.localize("AXIOM.Combat.Dodge"));
        return null;
      }
    }

    const roll = await new Roll("1d100").evaluate();
    const parts = this.getSkillRollParts(defender, skill);
    const modifierRows = this.buildAutomaticModifierRows(defender, { includeCover: opposedData.isRanged });
    const modifierTotal = modifierRows.reduce((sum, row) => sum + Number(row.value ?? 0), 0);
    const successTarget = Math.min(120, Math.max(5, parts.basePool + modifierTotal));
    const result = AxiomRoll.evaluateResult({ d100: roll.total, successTarget });

    const defenseState = {
      rollId: foundry.utils.randomID(),
      actorId: defender.id,
      actorName: defender.name,
      title: defenseLabel,
      testType: "defense",
      testTypeLabel: "AXIOM.Combat.Defense",
      d100: result.d100,
      basePool: parts.basePool,
      difficulty: 0,
      modifierRows,
      isWeaponRoll: false,
      combatDefense: {
        opposedMessageId: opposedMessage.id,
        defenseType,
        skillName: skill.name
      }
    };

    const ChatCard = game.axiom?.chat?.AxiomChatCard;
    const defenseMessage = await ChatCard.createMessage(defenseState, {
      roll,
      rollMode: "public",
      speaker: ChatMessage.getSpeaker({ actor: defender })
    });

    await this.waitForDiceAnimation(defenseMessage);

    await this.createCombatResultCard({ opposedData, defenseState, defenseMessage, unopposed: false });
    return defenseMessage;
  }

  static async resolveOpposedUnopposed(opposedMessage) {
    const opposedData = this.normalizeOpposedData(opposedMessage?.getFlag?.("axiom", "combatOpposed") ?? {});
    return this.createCombatResultCard({ opposedData, defenseState: null, defenseMessage: null, unopposed: true });
  }

  static async resolveAttackCardUnopposed(attackMessage) {
    let attackState = attackMessage?.getFlag?.("axiom", "roll");
    if (!attackState?.isWeaponRoll) return null;

    let defenderToken = this.getTokenFromCombatTarget(attackState.combatTarget);
    if (!defenderToken?.actor) {
      defenderToken = this.getSelectedOrTargetedDefender({ warn: false });
      if (defenderToken?.actor) {
        const ChatCard = game.axiom?.chat?.AxiomChatCard;
        if (ChatCard) {
          let nextState = ChatCard.normalizeState(attackState);
          nextState.combatTarget = this.serializeCombatTarget(defenderToken, { assignedAfterRoll: true });
          nextState = this.applyTargetBasedAttackModifiers(nextState, defenderToken);
          await ChatCard.replaceMessageState(attackMessage, nextState, { refreshLinkedResults: false });
          attackState = nextState;
        }
      }
    }

    const opposedData = this.buildOpposedDataFromAttackState(attackMessage, attackState, defenderToken, { unopposed: true });
    return this.createCombatResultCard({ opposedData, defenseState: null, defenseMessage: null, unopposed: true });
  }

  static async createCombatResultCard({ opposedData, defenseState = null, defenseMessage = null, unopposed = false } = {}) {
    const data = this.buildCombatResultData({ opposedData, defenseState, defenseMessage, unopposed });
    const content = await this.renderCombatResult(data);
    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: game.actors?.get(opposedData?.attacker?.actorId) ?? null }),
      content,
      cssClass: "axiom-roll-message",
      flags: { axiom: { combatResultCard: data } }
    });
  }

  static buildCombatResultData({ opposedData, defenseState = null, defenseMessage = null, unopposed = false } = {}) {
    const attackMessage = game.messages?.get(opposedData?.attackMessageId);
    const currentAttackState = attackMessage?.getFlag?.("axiom", "roll") ?? null;
    const attack = currentAttackState ? this.serializeAttackForOpposition(currentAttackState, this.getAttackData(currentAttackState)) : opposedData.attack;
    const defense = defenseState ? this.serializeAttackForOpposition(defenseState, this.getAttackData(defenseState)) : null;
    const defender = game.actors?.get(opposedData?.defender?.actorId);
    const hitLocation = attack.hitLocation ?? null;
    const armor = this.getArmorAtLocation(defender, hitLocation?.key);
    const toughness = Number(defender?.system?.subAttributes?.toughness ?? 0);

    return this.normalizeCombatResultCard({
      id: foundry.utils.randomID(),
      attackMessageId: opposedData.attackMessageId ?? "",
      defenseMessageId: defenseMessage?.id ?? "",
      opposedMessageId: defenseState?.combatDefense?.opposedMessageId ?? "",
      unopposed: Boolean(unopposed),
      attackerName: opposedData.attacker?.name ?? "",
      defenderName: opposedData.defender?.name ?? (unopposed ? game.i18n.localize("AXIOM.Combat.NarrativeTarget") : ""),
      defenderActorId: opposedData.defender?.actorId ?? "",
      weaponName: opposedData.weapon?.name ?? "",
      hitLocationKey: hitLocation?.key ?? "",
      hitLocationLabel: hitLocation?.label ?? "AXIOM.Combat.NotApplicableShort",
      hitLocationText: hitLocation?.labelText ?? game.i18n.localize("AXIOM.Combat.NotApplicableShort"),
      attack: {
        roll: attack.rollDisplay ?? AxiomRoll.formatD100(attack.d100),
        successTarget: Number(attack.successTarget ?? 0),
        hits: Number(attack.hits ?? 0),
        complication: Boolean(attack.complication)
      },
      defense: {
        roll: defense?.rollDisplay ?? "",
        successTarget: Number(defense?.successTarget ?? 0),
        hits: unopposed ? 0 : Number(defense?.hits ?? 0),
        complication: Boolean(defense?.complication)
      },
      values: {
        baseDamage: Number(opposedData.weapon?.damage ?? 0),
        damageModifier: opposedData.attackType === "melee" ? Number(opposedData.weapon?.damageModifier ?? 0) : 0,
        armorPenetration: Number(opposedData.weapon?.armorPenetration ?? 0),
        armor,
        toughness
      },
      woundApplied: false
    });
  }

  static normalizeCombatResultCard(data = {}) {
    const attackHits = Number(data.attack?.hits ?? 0);
    const defenseHits = data.unopposed ? 0 : Number(data.defense?.hits ?? 0);
    const netHits = data.unopposed ? attackHits : attackHits - defenseHits;
    const hitsAttack = Boolean(data.unopposed ? attackHits >= 0 : netHits > 0);
    const baseDamage = Number(data.values?.baseDamage ?? 0);
    const damageModifier = Number(data.values?.damageModifier ?? 0);
    const armorPenetration = Number(data.values?.armorPenetration ?? 0);
    const armor = Number(data.values?.armor ?? 0);
    const toughness = Number(data.values?.toughness ?? 0);
    const rawDamage = hitsAttack ? Math.max(0, baseDamage + damageModifier + netHits) : 0;
    const effectiveArmor = Math.max(0, armor - armorPenetration);
    const calculatedFinalDamage = hitsAttack ? Math.max(0, rawDamage - effectiveArmor - toughness) : 0;
    const hasFinalDamageOverride = data.finalDamageOverride !== null && data.finalDamageOverride !== undefined && data.finalDamageOverride !== "";
    const finalDamage = hasFinalDamageOverride ? Math.max(0, Number(data.finalDamageOverride ?? 0)) : calculatedFinalDamage;
    const woundSeverity = this.getWoundSeverity(finalDamage);
    const damageBuildFormula = `${baseDamage} ${AxiomRoll.formatSigned(damageModifier)} ${AxiomRoll.formatSigned(netHits)} = ${rawDamage}`;
    const armorFormula = `${armor} - ${armorPenetration} = ${effectiveArmor}`;
    const mitigationFormula = `${rawDamage} - ${effectiveArmor} - ${toughness} = ${calculatedFinalDamage}`;
    const rawDamageTooltip = `Raw Damage: Base ${baseDamage} + Mod ${damageModifier} + Hits ${netHits} = ${rawDamage}`;
    const effectiveArmorTooltip = `Effective Armor: Armor ${armor} - AP ${armorPenetration} = ${effectiveArmor}`;
    const toughnessTooltip = `Toughness: ${toughness}`;
    const finalDamageTooltip = hasFinalDamageOverride
      ? `Manual Final Damage: ${finalDamage} (calculated ${calculatedFinalDamage})`
      : `Final Damage: ${mitigationFormula}`;

    return {
      id: data.id ?? foundry.utils.randomID(),
      attackMessageId: data.attackMessageId ?? "",
      defenseMessageId: data.defenseMessageId ?? "",
      opposedMessageId: data.opposedMessageId ?? "",
      unopposed: Boolean(data.unopposed),
      attackerName: data.attackerName ?? "",
      defenderName: data.defenderName ?? "",
      weaponName: data.weaponName ?? "",
      hitLocationKey: data.hitLocationKey ?? "",
      hitLocationLabel: data.hitLocationLabel ?? "",
      hitLocationText: data.hitLocationText ?? "",
      attack: {
        roll: data.attack?.roll ?? "",
        successTarget: Number(data.attack?.successTarget ?? 0),
        hits: attackHits,
        hitsDisplay: AxiomRoll.formatSigned(attackHits),
        complication: Boolean(data.attack?.complication)
      },
      defense: {
        roll: data.defense?.roll ?? "",
        successTarget: Number(data.defense?.successTarget ?? 0),
        hits: defenseHits,
        hitsDisplay: AxiomRoll.formatSigned(defenseHits),
        complication: Boolean(data.defense?.complication)
      },
      values: { baseDamage, damageModifier, armorPenetration, armor, toughness },
      netHits,
      netHitsDisplay: AxiomRoll.formatSigned(netHits),
      hitsAttack,
      outcomeLabel: hitsAttack ? "AXIOM.Combat.AttackHits" : "AXIOM.Combat.AttackMisses",
      outcomeCss: hitsAttack ? "hit" : "miss",
      rawDamage,
      effectiveArmor,
      calculatedFinalDamage,
      hasFinalDamageOverride,
      finalDamageOverride: hasFinalDamageOverride ? finalDamage : null,
      finalDamage,
      damageBuildFormula,
      armorFormula,
      mitigationFormula,
      rawDamageTooltip,
      effectiveArmorTooltip,
      toughnessTooltip,
      finalDamageTooltip,
      woundSeverity,
      woundSeverityLabel: woundSeverity ? `AXIOM.Combat.Wounds.${woundSeverity}` : "AXIOM.Combat.NoWound",
      canApplyWound: Boolean(finalDamage > 0 && woundSeverity && data.defenderActorId),
      woundApplied: Boolean(data.woundApplied),
      appliedWound: data.appliedWound ?? null,
      defenderActorId: data.defenderActorId ?? ""
    };
  }

  static rebuildCombatResultData(existing = {}) {
    const attackMessage = game.messages?.get(existing.attackMessageId);
    const attackState = attackMessage?.getFlag?.("axiom", "roll") ?? null;
    const defenseMessage = game.messages?.get(existing.defenseMessageId);
    const defenseState = defenseMessage?.getFlag?.("axiom", "roll") ?? null;

    const attack = attackState
      ? this.serializeAttackForOpposition(attackState, this.getAttackData(attackState))
      : existing.attack;
    const defense = (!existing.unopposed && defenseState)
      ? this.serializeAttackForOpposition(defenseState, this.getAttackData(defenseState))
      : existing.defense;

    const defender = game.actors?.get(existing.defenderActorId);
    const hitLocation = attack?.hitLocation ?? { key: existing.hitLocationKey, label: existing.hitLocationLabel, labelText: existing.hitLocationText };

    return this.normalizeCombatResultCard({
      ...existing,
      hitLocationKey: hitLocation?.key ?? existing.hitLocationKey ?? "",
      hitLocationLabel: hitLocation?.label ?? existing.hitLocationLabel ?? "AXIOM.Combat.NotApplicableShort",
      hitLocationText: hitLocation?.labelText ?? existing.hitLocationText ?? game.i18n.localize("AXIOM.Combat.NotApplicableShort"),
      attack: {
        roll: attack?.rollDisplay ?? existing.attack?.roll ?? "",
        successTarget: Number(attack?.successTarget ?? existing.attack?.successTarget ?? 0),
        hits: Number(attack?.hits ?? existing.attack?.hits ?? 0),
        complication: Boolean(attack?.complication ?? existing.attack?.complication)
      },
      defense: {
        roll: defense?.rollDisplay ?? existing.defense?.roll ?? "",
        successTarget: Number(defense?.successTarget ?? existing.defense?.successTarget ?? 0),
        hits: existing.unopposed ? 0 : Number(defense?.hits ?? existing.defense?.hits ?? 0),
        complication: Boolean(defense?.complication ?? existing.defense?.complication)
      },
      values: {
        baseDamage: Number(attackState?.weaponInfo?.damage ?? existing.values?.baseDamage ?? 0),
        damageModifier: attackState?.weaponInfo?.category === "melee" ? Number(attackState?.weaponInfo?.damageModifier ?? existing.values?.damageModifier ?? 0) : 0,
        armorPenetration: Number(attackState?.weaponInfo?.armorPenetration ?? existing.values?.armorPenetration ?? 0),
        armor: this.getArmorAtLocation(defender, hitLocation?.key),
        toughness: Number(defender?.system?.subAttributes?.toughness ?? existing.values?.toughness ?? 0)
      }
    });
  }

  static async refreshCombatResultMessage(message) {
    const existing = message?.getFlag?.("axiom", "combatResultCard");
    if (!existing) return null;
    const normalized = this.rebuildCombatResultData(existing);
    const content = await this.renderCombatResult(normalized);
    return message.update({ content, flags: { axiom: { combatResultCard: normalized } } });
  }

  static async refreshLinkedCombatResultsForRollMessage(rollMessage) {
    const id = rollMessage?.id;
    if (!id) return;
    const linked = game.messages?.filter?.(message => {
      const data = message.getFlag?.("axiom", "combatResultCard");
      return data && (data.attackMessageId === id || data.defenseMessageId === id);
    }) ?? [];

    for (const message of linked) await this.refreshCombatResultMessage(message);
  }

  static async renderCombatResult(data) {
    return foundry.applications.handlebars.renderTemplate(this.RESULT_TEMPLATE, { card: this.normalizeCombatResultCard(data) });
  }

  static async updateCombatResultMessage(message, changes = {}) {
    const merged = foundry.utils.deepClone(message.getFlag("axiom", "combatResultCard") ?? {});
    for (const [path, value] of Object.entries(changes)) foundry.utils.setProperty(merged, path, value);
    const normalized = this.normalizeCombatResultCard(merged);
    const content = await this.renderCombatResult(normalized);
    return message.update({ content, flags: { axiom: { combatResultCard: normalized } } });
  }

  static onRenderChatMessageHTML(message, element) {
    const opposed = element.querySelector?.(".axiom-chat-card.opposed-test-card");
    if (opposed) {
      opposed.querySelector("[data-action='combatDodge']")?.addEventListener("click", event => {
        event.preventDefault(); event.stopPropagation(); this.resolveOpposedDefense(message, "dodge");
      });
      opposed.querySelector("[data-action='combatParry']")?.addEventListener("click", event => {
        event.preventDefault(); event.stopPropagation(); this.resolveOpposedDefense(message, "parry");
      });
      opposed.querySelector("[data-action='combatUnopposed']")?.addEventListener("click", event => {
        event.preventDefault(); event.stopPropagation(); this.resolveOpposedUnopposed(message);
      });
    }

    const result = element.querySelector?.(".axiom-chat-card.combat-result-card");
    if (result) {
      result.querySelectorAll("[data-result-field]").forEach(input => {
        input.addEventListener("change", event => this._onCombatResultFieldChange(event, message));
        input.addEventListener("keydown", event => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          event.currentTarget.blur();
        });
      });
      result.querySelector("[data-action='applyCombatResultWound']")?.addEventListener("click", event => this._onApplyCombatResultWound(event, message));
    }
  }

  static async _onCombatResultFieldChange(event, message) {
    const input = event.currentTarget;
    const path = input.dataset.resultField;
    if (!path) return;
    const value = input.type === "checkbox" ? input.checked : Number(input.value ?? 0);
    await this.updateCombatResultMessage(message, { [path]: value });
  }

  static async _onApplyCombatResultWound(event, message) {
    event.preventDefault();
    event.stopPropagation();
    const data = this.normalizeCombatResultCard(message.getFlag("axiom", "combatResultCard") ?? {});
    const applied = await this.applyWound({
      defenderActorId: data.defenderActorId,
      damage: { woundSeverity: data.woundSeverity }
    });
    if (!applied) return;
    await this.updateCombatResultMessage(message, {
      woundApplied: true,
      appliedWound: { severity: applied.severity, slot: applied.slot, label: `AXIOM.Combat.Wounds.${applied.severity}` }
    });
  }

  static _getConfiguredSkillName(settingKey, fallback) {
    const value = game.settings?.get?.("axiom", settingKey);
    return String(value ?? fallback).trim() || fallback;
  }
}
