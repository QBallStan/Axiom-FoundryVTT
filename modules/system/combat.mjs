import AxiomRoll from "./rolls/axiom-roll.mjs";
import { getWeaponRange, isEquippedGearState, isMeleeWeaponItem, isRangedWeaponItem, isShieldItem } from "./items.mjs";

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
    pass: "pass",
    movementUsed: "movementUsed",
    movementWarningRound: "movementWarningRound",
    attackCount: "attackCount",
    attackCountRound: "attackCountRound",
    avoidingOpeningsRound: "avoidingOpeningsRound"
  };

  static _turnStartLocks = new Set();

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
      await this._resetAllMovementUsed();
      await this._resetAllAttackCounts();
      await this._clearAllAvoidOpenings();
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
    await this._resetAllMovementUsed();
    await this._resetAllAttackCounts();
    await this._clearAllAvoidOpenings();

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

      const max = AxiomCombat.getEffectiveActionPointMax(actor);
      if (!Number.isFinite(max)) continue;
      updates.push(actor.update({ "system.trackers.actionPoints.current": Math.max(0, max) }));
    }
    await Promise.all(updates);
  }

  async _resetAllMovementUsed() {
    const updates = [];
    for (const combatant of this.combatants ?? []) {
      if (!combatant) continue;
      updates.push(combatant.update({
        [`flags.axiom.${AxiomCombat.FLAGS.movementUsed}`]: 0,
        [`flags.axiom.${AxiomCombat.FLAGS.movementWarningRound}`]: null
      }));
    }
    await Promise.all(updates);
  }

  async _resetAllAttackCounts() {
    const updates = [];
    for (const combatant of this.combatants ?? []) {
      if (!combatant) continue;
      updates.push(combatant.update({
        [`flags.axiom.${AxiomCombat.FLAGS.attackCount}`]: 0,
        [`flags.axiom.${AxiomCombat.FLAGS.attackCountRound}`]: Number(this.round ?? 0) || 0
      }));
    }
    await Promise.all(updates);
  }

  async _resetAllMomentum() {
    const updates = [];
    for (const combatant of this.combatants ?? []) {
      const actor = combatant?.actor;
      if (!actor?.system?.trackers?.momentum) continue;
      updates.push(actor.update({ "system.trackers.momentum.current": 0 }));
    }
    await Promise.all(updates);
  }

  async _clearAllAvoidOpenings() {
    const updates = [];
    for (const combatant of this.combatants ?? []) {
      if (!combatant) continue;
      updates.push(combatant.unsetFlag?.("axiom", AxiomCombat.FLAGS.avoidingOpeningsRound));
    }
    await Promise.all(updates.filter(Boolean));
  }

  static getActionPointTracker(actor) {
    return actor?.system?.trackers?.actionPoints ?? null;
  }

  static getStatusStacks(actor, statusId) {
    const value = Number(actor?.system?.statuses?.[statusId] ?? actor?.getAxiomStatusValue?.(statusId) ?? 0);
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  }

  static getEffectiveActionPointMax(actor) {
    const tracker = this.getActionPointTracker(actor);
    if (!tracker) return 0;

    const rawMax = Number(tracker.max ?? 0);
    return Number.isFinite(rawMax) ? Math.max(0, rawMax) : 0;
  }

  static getActionPointCurrent(actor) {
    const tracker = this.getActionPointTracker(actor);
    if (!tracker) return 0;
    const current = Number(tracker.current ?? 0);
    const value = Number.isFinite(current) ? current : 0;
    return Math.min(value, this.getEffectiveActionPointMax(actor));
  }

  static getCurrentCombat() {
    const combat = game.combat ?? null;
    return combat?.started ? combat : null;
  }

  static getCombatantForActor(actor, combat = this.getCurrentCombat()) {
    if (!actor || !combat?.started) return null;

    const tokens = actor.getActiveTokens?.(true, true) ?? [];
    const tokenIds = new Set(tokens.map(token => token.id).filter(Boolean));
    const actorId = actor.id;
    const actorUuid = actor.uuid;

    return (combat.combatants ?? []).find(combatant => {
      if (!combatant) return false;
      if (combatant.actor === actor) return true;
      if (combatant.actor?.id && combatant.actor.id === actorId) return true;
      if (combatant.actor?.uuid && combatant.actor.uuid === actorUuid) return true;
      if (combatant.tokenId && tokenIds.has(combatant.tokenId)) return true;
      return false;
    }) ?? null;
  }

  static getCombatantAttackCount(combatant, combat = this.getCurrentCombat()) {
    if (!combatant || !combat?.started) return 0;

    const round = Number(combat.round ?? 0) || 0;
    const storedRound = Number(combatant.getFlag?.("axiom", this.FLAGS.attackCountRound) ?? 0) || 0;
    if (storedRound !== round) return 0;

    const count = Number(combatant.getFlag?.("axiom", this.FLAGS.attackCount) ?? 0);
    return Number.isFinite(count) ? Math.max(0, count) : 0;
  }

  static getActorAttackCount(actor, combat = this.getCurrentCombat()) {
    const combatant = this.getCombatantForActor(actor, combat);
    return this.getCombatantAttackCount(combatant, combat);
  }

  static getMultipleAttackPenaltyValue(actor) {
    const value = Number(actor?.system?.combat?.multipleAttackPenalty ?? -20);
    return Number.isFinite(value) ? value : -20;
  }

  static getMultipleAttackPenalty(actor, combat = this.getCurrentCombat()) {
    if (!actor || !combat?.started) return 0;
    const attackCount = this.getActorAttackCount(actor, combat);
    if (attackCount <= 0) return 0;
    return this.getMultipleAttackPenaltyValue(actor) * attackCount;
  }

  static async registerWeaponAttack(actor, combat = this.getCurrentCombat()) {
    if (!actor || !combat?.started) return;

    const combatant = this.getCombatantForActor(actor, combat);
    if (!combatant) return;

    const round = Number(combat.round ?? 0) || 0;
    const count = this.getCombatantAttackCount(combatant, combat);
    try {
      await combatant.update({
        [`flags.axiom.${this.FLAGS.attackCount}`]: count + 1,
        [`flags.axiom.${this.FLAGS.attackCountRound}`]: round
      });
    } catch (error) {
      console.warn("AXIOM//CORE | Could not update combatant attack count", error);
    }
  }

  static async clampActionPointsToEffectiveMax(actor) {
    const tracker = this.getActionPointTracker(actor);
    if (!actor || !tracker) return;

    const current = Number(tracker.current ?? 0);
    const effectiveMax = this.getEffectiveActionPointMax(actor);
    if (!Number.isFinite(current) || current <= effectiveMax) return;

    await actor.update({ "system.trackers.actionPoints.current": effectiveMax });
  }

  static getMomentumTracker(actor) {
    return actor?.system?.trackers?.momentum ?? null;
  }

  static getMomentumCurrent(actor) {
    const tracker = this.getMomentumTracker(actor);
    const current = Number(tracker?.current ?? 0);
    return Number.isFinite(current) ? Math.max(0, current) : 0;
  }

  static getMomentumMax(actor) {
    const tracker = this.getMomentumTracker(actor);
    const max = Number(tracker?.max ?? (actor?.type === "npc" ? 1 : 3));
    return Number.isFinite(max) ? Math.max(0, max) : 0;
  }

  static async adjustMomentum(actor, delta = 0) {
    const tracker = this.getMomentumTracker(actor);
    if (!actor || !tracker) return { changed: false, current: 0, max: 0, capped: false };

    const current = this.getMomentumCurrent(actor);
    const max = this.getMomentumMax(actor);
    const next = Math.min(max, Math.max(0, current + Number(delta ?? 0)));
    if (next === current) return { changed: false, current, max, capped: delta > 0 && current >= max };

    await actor.update({ "system.trackers.momentum.current": next });
    return { changed: true, current: next, previous: current, max, capped: delta > 0 && next >= max };
  }

  static async spendMomentum(actor, amount = 1) {
    const current = this.getMomentumCurrent(actor);
    const cost = Math.max(0, Number(amount ?? 0));
    if (!actor || cost <= 0 || current < cost) return false;
    await actor.update({ "system.trackers.momentum.current": current - cost });
    return true;
  }

  static canSpendMomentum(actor, amount = 1) {
    return this.getMomentumCurrent(actor) >= Math.max(0, Number(amount ?? 0));
  }

  static getCombatantForTokenId(tokenId, combat = this.getCurrentCombat()) {
    if (!tokenId || !combat?.started) return null;
    return (combat.combatants ?? []).find(combatant => combatant?.tokenId === tokenId || combatant?.token?.id === tokenId) ?? null;
  }

  static async avoidOpenings(actor, combat = this.getCurrentCombat()) {
    if (!actor || !combat?.started) return false;
    const combatant = this.getCombatantForActor(actor, combat);
    if (!combatant) return false;
    if (!await this.spendMomentum(actor, 1)) return false;
    await combatant.setFlag?.("axiom", this.FLAGS.avoidingOpeningsRound, Number(combat.round ?? 0) || 0);
    ui.combat?.render?.();
    return true;
  }

  static hasAvoidOpenings(combatant, combat = this.getCurrentCombat()) {
    if (!combatant || !combat?.started) return false;
    const round = Number(combat.round ?? 0) || 0;
    return Number(combatant.getFlag?.("axiom", this.FLAGS.avoidingOpeningsRound) ?? -1) === round;
  }

  static async onCombatTurnStart(combat) {
    if (!game.user?.isGM || !combat?.started) return;

    const combatant = combat.combatant;
    const actor = combatant?.actor;
    if (!combatant || !actor) return;

    const pass = combat.getAxiomPass?.() ?? 1;
    const activationKey = `${combat.id}:${combat.round}:${pass}:${combat.turn}:${combatant.id}`;
    if (combatant.getFlag?.("axiom", this.FLAGS.activationKey) === activationKey) return;
    if (this._turnStartLocks.has(activationKey)) return;

    this._turnStartLocks.add(activationKey);
    try {
      // Store the activation key before resolving status automation. The updateCombat
      // hook and direct turn advancement can both reach this method in the same tick.
      // Setting the key early prevents duplicate start-of-turn chat cards.
      await combatant.setFlag?.("axiom", this.FLAGS.activationKey, activationKey);

      if (pass === 1) {
        await this.resolveStartOfTurnStatuses(combat, combatant, actor);
      }

      await this.clampActionPointsToEffectiveMax(actor);

      const ap = this.getActionPointCurrent(actor);
      await combatant.setFlag?.("axiom", this.FLAGS.activationStartAp, ap);
      ui.combat?.render?.();
    } finally {
      this._turnStartLocks.delete(activationKey);
    }
  }

  static async resolveStartOfTurnStatuses(combat, combatant, actor) {
    if (!actor || !combatant) return;

    const round = Number(combat?.round ?? 0) || 0;
    const statusKey = `${combat?.id ?? ""}:${round}:${combatant.id}`;
    const lastKey = combatant.getFlag?.("axiom", "statusTurnKey");
    if (lastKey === statusKey) return;

    await combatant.setFlag?.("axiom", "statusTurnKey", statusKey);

    const chilled = this.getStatusStacks(actor, "chilled");
    if (chilled > 0) await actor.removeStatus?.("chilled", 1);

    if (this.getStatusStacks(actor, "sprinting") > 0) await actor.clearStatus?.("sprinting");
    if (this.getStatusStacks(actor, "distracted") > 0) await actor.clearStatus?.("distracted");

    const statusesWithCards = ["burning", "bleeding", "stunned", "corroding"]
      .map(statusId => ({ statusId, stacks: this.getStatusStacks(actor, statusId), status: CONFIG.AXIOM?.statuses?.[statusId] }))
      .filter(entry => entry.status && entry.stacks > 0);

    if (statusesWithCards.length) await this.createStartOfTurnStatusCard({ combat, combatant, actor, statuses: statusesWithCards });
  }

  static async createStartOfTurnStatusCard({ combat, combatant, actor, statuses } = {}) {
    const rows = statuses.map(({ statusId, stacks, status }) => this.renderStartOfTurnStatusRow(statusId, stacks, status)).join("");
    if (!rows) return null;

    const content = `
      <article class="axiom-chat-card roll-card axiom-status-card" data-actor-id="${actor.id}" data-combatant-id="${combatant.id}">
        <header class="card-header">
          <div class="card-title">
            <strong>${game.i18n.localize("AXIOM.StatusCard.Title")}</strong>
            <span>${foundry.utils.escapeHTML(actor.name ?? combatant.name ?? "")}</span>
          </div>
          <div class="card-badge">${game.i18n.localize("AXIOM.StatusCard.Badge")}</div>
        </header>
        <section class="card-body">
          ${rows}
        </section>
      </article>
    `;

    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content,
      style: CONST.CHAT_MESSAGE_STYLES?.OTHER,
      flags: {
        axiom: {
          statusCard: true,
          actorId: actor.id,
          combatId: combat?.id ?? "",
          combatantId: combatant.id,
          round: Number(combat?.round ?? 0) || 0
        }
      }
    });
  }

  static renderStartOfTurnStatusRow(statusId, stacks, status) {
    const label = game.i18n.localize(status.label);
    const stackLabel = game.i18n.format("AXIOM.StatusCard.Stacks", { stacks });
    const actionLabel = this.getStatusCardActionLabel(statusId);
    const icon = status.icon ? `<i class="${status.icon}"></i>` : "";
    const button = actionLabel
      ? `<button type="button" class="axiom-status-card-button" data-action="resolveStatus" data-status-id="${statusId}">${actionLabel}</button>`
      : "";

    return `
      <div class="axiom-status-card-row" data-status-id="${statusId}">
        <div class="axiom-status-card-main">
          <span class="axiom-status-card-icon">${icon}</span>
          <div>
            <strong>${label}</strong>
            <span>${stackLabel}</span>
          </div>
        </div>
        ${button}
      </div>
    `;
  }

  static getStatusCardActionLabel(statusId) {
    switch (statusId) {
      case "burning": return game.i18n.localize("AXIOM.StatusCard.TakeDamage");
      case "bleeding": return game.i18n.localize("AXIOM.StatusCard.ApplyBleeding");
      case "stunned": return game.i18n.localize("AXIOM.StatusCard.Recover");
      case "corroding": return game.i18n.localize("AXIOM.StatusCard.TakeDamage");
      default: return "";
    }
  }

  static async onCombatStart(combat) {
    if (!game.user?.isGM || !combat) return;
    await combat._restoreAllActionPoints?.();
    await combat._resetAllMovementUsed?.();
    await combat._resetAllAttackCounts?.();
    await combat._resetAllMomentum?.();
    await combat._clearAllAvoidOpenings?.();
    await this.onCombatTurnStart(combat);
  }

  static async onCombatEnd(combat) {
    if (!game.user?.isGM || !combat) return;
    await combat._restoreAllActionPoints?.();
    await combat._resetAllMovementUsed?.();
    await combat._resetAllAttackCounts?.();
    await combat._resetAllMomentum?.();
    await combat._clearAllAvoidOpenings?.();
  }

  static async stepMomentumTowardZero(actor) {
    // Momentum is now a positive spendable resource and no longer drifts toward zero.
    return actor;
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
    close: 30,
    short: 20,
    medium: 10,
    long: 0,
    extreme: -20,
    outOfRange: -40
  };

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
      .filter(item => isEquippedGearState(item.system?.state ?? "carried")) ?? [];
  }


  static getEquippedShields(actor) {
    if (!actor) return [];

    return actor.items
      ?.filter(item => isShieldItem(item))
      .filter(item => isEquippedGearState(item.system?.state ?? "carried")) ?? [];
  }

  static getPrimaryShieldBlockSkill(actor) {
    const shield = this.getEquippedShields(actor).find(item => String(item.system?.skill ?? "").trim());
    if (!shield) return null;

    const skill = this.findActorSkillByName(actor, shield.system.skill);
    return skill ? { skill, shield } : { skill: null, shield };
  }

  static hasEquippedShield(actor) {
    return this.getEquippedShields(actor).length > 0;
  }

  static canBlockAttackState(state) {
    const targetActorId = state?.combatTarget?.actorId;
    const defender = targetActorId ? game.actors?.get(targetActorId) : null;
    if (defender) return this.hasEquippedShield(defender);

    const target = this.getSelectedOrTargetedDefender({ warn: false });
    return this.hasEquippedShield(target?.actor);
  }

  static getPrimaryParrySkill(actor) {
    const equippedWeapon = this.getEquippedMeleeWeapons(actor).find(weapon => String(weapon.system?.meleeSkill || weapon.system?.skill || "").trim());
    if (equippedWeapon) {
      const skill = this.findActorSkillByName(actor, equippedWeapon.system.meleeSkill || equippedWeapon.system.skill);
      if (skill) return { skill, weapon: equippedWeapon, source: "weapon" };
    }

    const skill = this.findUnarmedCombatSkill(actor);
    return skill ? { skill, weapon: null, source: "unarmed" } : null;
  }

  static normalizeGuardValue(value) {
    return String(value ?? "full") === "limited" ? "limited" : "full";
  }

  static getWeaponGuardValue(weapon) {
    return this.normalizeGuardValue(weapon?.system?.guard ?? "full");
  }

  static getAttackingWeaponFromState(state) {
    const actor = game.actors?.get(state?.actorId ?? "") ?? null;
    return actor?.items?.get(state?.itemId ?? "") ?? null;
  }

  static getAttackingWeaponFromOpposedData(opposedData) {
    const actor = game.actors?.get(opposedData?.attacker?.actorId ?? "") ?? null;
    return actor?.items?.get(opposedData?.weapon?.itemId ?? "") ?? null;
  }

  static getDefenseGuardValue({ defenseType, defender, shield = null, parry = null } = {}) {
    if (defenseType === "block") return shield ? "full" : null;
    if (!["parry", "counterattack"].includes(defenseType)) return null;

    const parryData = parry ?? this.getPrimaryParrySkill(defender);
    if (parryData?.weapon) return this.getWeaponGuardValue(parryData.weapon);
    if (parryData?.source === "unarmed" || parryData?.skill) return "limited";
    return null;
  }

  static buildGuardModifierRow({ isMeleeAttack = false, attackWeapon = null, defender = null, defenseType = "", shield = null, parry = null } = {}) {
    if (!isMeleeAttack || !["parry", "block", "counterattack"].includes(defenseType)) return null;

    const attackerGuard = this.getWeaponGuardValue(attackWeapon);
    const defenderGuard = this.getDefenseGuardValue({ defenseType, defender, shield, parry });
    if (!defenderGuard || attackerGuard === defenderGuard) return null;

    const value = attackerGuard === "limited" && defenderGuard === "full" ? 10 : -10;
    return {
      id: "auto-guard",
      label: value > 0 ? "AXIOM.Roll.ModifierSources.GuardAdvantage" : "AXIOM.Roll.ModifierSources.GuardDisadvantage",
      value,
      automatic: true,
      locked: true
    };
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

    const range = getWeaponRange(weapon, attackerActor);
    if (range <= 0) return null;

    let band = "medium";
    if (distance <= Math.ceil(range / 4)) band = "close";
    else if (distance <= Math.ceil(range / 2)) band = "short";
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

  static getTargetSizeModifier(targetToken) {
    const size = Number(targetToken?.actor?.system?.size ?? 0);
    return Number.isFinite(size) ? size * 5 : 0;
  }

  static getTargetSizeModifierRow(targetToken) {
    const modifier = this.getTargetSizeModifier(targetToken);
    if (modifier === 0) return null;

    return {
      id: "auto-target-size",
      label: "AXIOM.Combat.TargetSize",
      value: modifier,
      active: true,
      automatic: true,
      locked: true,
      targetSize: Number(targetToken?.actor?.system?.size ?? 0)
    };
  }

  static _upsertAutomaticTargetModifier(rows, row, id) {
    const existingIndex = rows.findIndex(existing => existing.id === id);

    if (row) {
      if (existingIndex >= 0) rows[existingIndex] = { ...rows[existingIndex], ...row, active: rows[existingIndex].active !== false };
      else rows.push(row);
    } else if (existingIndex >= 0 && rows[existingIndex].locked) {
      rows.splice(existingIndex, 1);
    }
  }

  static applyTargetBasedAttackModifiers(state, targetToken) {
    const nextState = foundry.utils.deepClone(state ?? {});
    const attackerActor = game.actors?.get(nextState.actorId) ?? null;
    const weapon = attackerActor?.items?.get(nextState.itemId) ?? null;
    if (!attackerActor || !weapon || !targetToken?.actor) return nextState;

    const attackCategory = nextState.weaponInfo?.category ?? (isRangedWeaponItem(weapon) && !isMeleeWeaponItem(weapon) ? "ranged" : "melee");
    const rows = Array.isArray(nextState.modifierRows) ? [...nextState.modifierRows] : [];

    this._upsertAutomaticTargetModifier(rows, this.getTargetSizeModifierRow(targetToken), "auto-target-size");

    if (attackCategory === "ranged") {
      this._upsertAutomaticTargetModifier(rows, this.getRangeModifierRow({ attackerActor, weapon, targetToken }), "auto-range");
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
    return 0;
  }

  static getStatusModifierRows(actor) {
    if (!actor) return [];

    return Object.values(CONFIG.AXIOM?.statuses ?? {})
      .map(status => {
        const perStack = Number(status.rollModifierPerStack ?? 0);
        if (!Number.isFinite(perStack) || perStack === 0) return null;

        const stacks = Number(actor.system?.statuses?.[status.id] ?? actor.getAxiomStatusValue?.(status.id) ?? 0);
        if (!Number.isFinite(stacks) || stacks <= 0) return null;

        return {
          id: `auto-status-${status.id}`,
          label: status.label,
          value: perStack * stacks,
          automatic: true,
          locked: true
        };
      })
      .filter(Boolean);
  }

  static getStatusTestPenalty(actor) {
    return this.getStatusModifierRows(actor).reduce((total, row) => total + Number(row.value ?? 0), 0);
  }

  static buildAutomaticModifierRows(actor, { includeCover = false } = {}) {
    const rows = [
      { id: "auto-wounds", label: "AXIOM.Roll.ModifierSources.WoundPenalty", value: this.getWoundPenalty(actor), automatic: true, locked: true },
      ...this.getStatusModifierRows(actor)
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
    const calculatedSuccessTarget = AxiomRoll.normalizeSuccessTarget(Number(state.basePool ?? 0) + Number(state.difficulty ?? 0) + activeModifierTotal);
    const hasManualSuccessTarget = state.manualSuccessTarget !== null && state.manualSuccessTarget !== undefined && state.manualSuccessTarget !== "";
    const successTarget = hasManualSuccessTarget ? AxiomRoll.normalizeSuccessTarget(state.manualSuccessTarget) : calculatedSuccessTarget;
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
    let shield = null;
    if (defenseType === "block") {
      const block = this.getPrimaryShieldBlockSkill(defender);
      skill = block?.skill ?? null;
      defenseLabel = block?.shield ? game.i18n.format("AXIOM.Combat.BlockWith", { shield: block.shield.name }) : game.i18n.localize("AXIOM.Combat.Block");
      if (!block?.shield) {
        ui.notifications?.warn(game.i18n.format("AXIOM.Combat.NoShieldAvailable", { actor: defender.name }));
        return null;
      }
      if (!skill) {
        this.warnMissingSkill(defender, block.shield.system?.skill ?? "", game.i18n.localize("AXIOM.Combat.Block"));
        return null;
      }
    } else if (defenseType === "counterattack") {
      const parry = this.getPrimaryParrySkill(defender);
      skill = parry?.skill ?? null;
      defenseLabel = game.i18n.localize("AXIOM.Combat.Momentum.Counterattack");
      if (!this.canSpendMomentum(defender, 1)) {
        ui.notifications?.warn(game.i18n.localize("AXIOM.Combat.Momentum.Insufficient"));
        return null;
      }
      if (!skill) {
        this.warnMissingSkill(defender, this.getUnarmedCombatSkillName(), game.i18n.localize("AXIOM.Combat.Momentum.Counterattack"));
        return null;
      }
    } else if (defenseType === "counterattack") {
      const parry = this.getPrimaryParrySkill(defender);
      skill = parry?.skill ?? null;
      defenseLabel = game.i18n.localize("AXIOM.Combat.Momentum.Counterattack");
      if (!this.canSpendMomentum(defender, 1)) {
        ui.notifications?.warn(game.i18n.localize("AXIOM.Combat.Momentum.Insufficient"));
        return null;
      }
      if (!skill) {
        this.warnMissingSkill(defender, this.getUnarmedCombatSkillName(), game.i18n.localize("AXIOM.Combat.Momentum.Counterattack"));
        return null;
      }
    } else if (defenseType === "parry") {
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
    const guardShield = defenseType === "block" ? this.getPrimaryShieldBlockSkill(defender)?.shield ?? null : null;
    const guardParry = ["parry", "counterattack"].includes(defenseType) ? this.getPrimaryParrySkill(defender) : null;
    if (guardShield) modifierRows.push({
      id: "auto-shield-block",
      label: "AXIOM.Roll.ModifierSources.ShieldBlock",
      value: Number(guardShield.system?.blockValue ?? 0),
      automatic: true,
      locked: true
    });
    const guardRow = this.buildGuardModifierRow({
      isMeleeAttack: !isRanged,
      attackWeapon: weapon,
      defender,
      defenseType,
      shield: guardShield,
      parry: guardParry
    });
    if (guardRow) modifierRows.push(guardRow);
    const modifierTotal = modifierRows.reduce((sum, row) => sum + Number(row.value ?? 0), 0);
    const successTarget = Math.min(150, Math.max(5, parts.basePool + modifierTotal));
    const result = AxiomRoll.evaluateResult({ d100: roll.total, successTarget });
    const attack = this.getAttackData(state);
    const blockShield = guardShield;
    const combatResult = this.resolveAttack({ state, attack, defender, defenderToken, defense: { ...result, roll, ...parts, modifierRows, modifierTotal, successTarget, type: defenseType, label: defenseLabel, skillName: skill.name, shieldArmorBonus: Number(blockShield?.system?.armorBonus ?? 0), shieldName: blockShield?.name ?? "" } });

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

  static getOpposedRollUnits(result) {
    const value = AxiomRoll.normalizeD100(result?.d100 ?? result?.roll?.total ?? result?.roll ?? 100);
    return value % 10;
  }

  static getOpposedAttackSuccess(attack) {
    if (attack?.success !== undefined) return Boolean(attack.success);
    const d100 = attack?.d100 ?? attack?.roll;
    const successTarget = Number(attack?.successTarget ?? 0);
    return AxiomRoll.evaluateResult({ d100, successTarget }).success;
  }

  static resolveOpposedHits(attack, defense, { unopposed = false } = {}) {
    const attackHits = Number(attack?.hits ?? 0);

    if (unopposed || !defense) {
      const attackerWins = this.getOpposedAttackSuccess(attack);
      return {
        attackerWins,
        defenderWins: false,
        winner: attackerWins ? "attacker" : "defender",
        netHits: attackerWins ? Math.max(0, attackHits) : 0,
        margin: attackerWins ? Math.max(0, attackHits) : 0,
        stalemate: false,
        tieBreaker: attackerWins ? "unopposed" : "unopposedFailure"
      };
    }

    const defenseHits = Number(defense?.hits ?? 0);
    const hitDifference = attackHits - defenseHits;
    if (hitDifference > 0) {
      return { attackerWins: true, defenderWins: false, winner: "attacker", netHits: hitDifference, margin: hitDifference, stalemate: false, tieBreaker: "hits" };
    }
    if (hitDifference < 0) {
      return { attackerWins: false, defenderWins: true, winner: "defender", netHits: 0, margin: Math.abs(hitDifference), stalemate: false, tieBreaker: "hits" };
    }

    const attackComplication = Boolean(attack?.complication);
    const defenseComplication = Boolean(defense?.complication);
    if (attackComplication !== defenseComplication) {
      const attackerWins = defenseComplication;
      return {
        attackerWins,
        defenderWins: !attackerWins,
        winner: attackerWins ? "attacker" : "defender",
        netHits: attackerWins ? 1 : 0,
        margin: 1,
        stalemate: false,
        tieBreaker: "complication"
      };
    }

    const attackUnits = this.getOpposedRollUnits(attack);
    const defenseUnits = this.getOpposedRollUnits(defense);
    if (attackUnits < defenseUnits) {
      return { attackerWins: true, defenderWins: false, winner: "attacker", netHits: 1, margin: 1, stalemate: false, tieBreaker: "units" };
    }
    if (attackUnits > defenseUnits) {
      return { attackerWins: false, defenderWins: true, winner: "defender", netHits: 0, margin: 1, stalemate: false, tieBreaker: "units" };
    }

    return { attackerWins: false, defenderWins: false, winner: "stalemate", netHits: 0, margin: 0, stalemate: true, tieBreaker: "stalemate" };
  }

  static getOpposedResultLabel(opposedResult, { unopposed = false } = {}) {
    if (opposedResult?.stalemate) return "AXIOM.Combat.OpposedStalemate";
    if (unopposed && opposedResult?.attackerWins) return "AXIOM.Combat.UnopposedSuccess";
    if (unopposed) return "AXIOM.Combat.UnopposedFailure";
    return opposedResult?.attackerWins ? "AXIOM.Combat.AttackerWins" : "AXIOM.Combat.DefenderWins";
  }

  static getOpposedTieBreakerLabel(opposedResult) {
    const labels = {
      hits: "AXIOM.Combat.TieBreakerHits",
      units: "AXIOM.Combat.TieBreakerUnits",
      complication: "AXIOM.Combat.TieBreakerComplication",
      stalemate: "AXIOM.Combat.TieBreakerStalemate",
      unopposed: "AXIOM.Combat.TieBreakerUnopposed",
      unopposedFailure: "AXIOM.Combat.TieBreakerUnopposedFailure"
    };
    return labels[opposedResult?.tieBreaker] ?? labels.hits;
  }

  static resolveAttack({ state, attack, defender = null, defenderToken = null, defense = null, unopposed = false } = {}) {
    const opposedResult = this.resolveOpposedHits(attack, defense, { unopposed });
    const hitsAttack = opposedResult.attackerWins;
    const netHits = hitsAttack ? opposedResult.netHits : 0;
    const hitLocation = state.isWeaponRoll ? AxiomRoll.getAttackHitLocation(state.d100, state) : null;
    const damage = hitsAttack
      ? this.calculateDamage({ state, defender, hitLocation, netHits, defense })
      : this.emptyDamage();

    return {
      resolved: true,
      unopposed,
      defenderActorId: defender?.id ?? "",
      defenderTokenId: defenderToken?.id ?? "",
      defenderSceneId: canvas?.scene?.id ?? defenderToken?.scene?.id ?? defenderToken?.document?.parent?.id ?? defenderToken?.parent?.id ?? "",
      defenderName: defender?.name ?? game.i18n.localize("AXIOM.Combat.NoDefender"),
      defense: defense ? this.serializeDefense(defense) : null,
      attackHits: Number(attack?.hits ?? 0),
      attackHitsDisplay: AxiomRoll.formatSigned(attack?.hits ?? 0),
      defenseHits: Number(defense?.hits ?? 0),
      defenseHitsDisplay: AxiomRoll.formatSigned(defense?.hits ?? 0),
      netHits,
      netHitsDisplay: AxiomRoll.formatSigned(netHits),
      opposedMargin: opposedResult.margin,
      opposedMarginDisplay: AxiomRoll.formatSigned(opposedResult.margin ?? 0),
      opposedWinner: opposedResult.winner,
      opposedResultLabel: this.getOpposedResultLabel(opposedResult, { unopposed }),
      opposedTieBreakerLabel: this.getOpposedTieBreakerLabel(opposedResult),
      stalemate: Boolean(opposedResult.stalemate),
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
      outcomeTierLabel: defense.outcomeTierLabel,
      shieldItemId: defense.shieldItemId ?? defense.shield?.itemId ?? "",
      shieldName: defense.shieldName ?? defense.shield?.name ?? "",
      shieldBlockValue: Number(defense.shieldBlockValue ?? defense.shield?.blockValue ?? 0),
      shieldArmorBonus: Number(defense.shieldArmorBonus ?? defense.shield?.armorBonus ?? 0)
    };
  }

  static calculateDamage({ state, defender, hitLocation, netHits = 0, defense = null } = {}) {
    const weaponInfo = state.weaponInfo ?? {};
    const category = weaponInfo.category ?? "";
    const baseDamage = Number(weaponInfo.damage ?? 0);
    const damageModifier = category === "melee" ? Number(weaponInfo.damageModifier ?? 0) : 0;
    const armorPenetration = Number(weaponInfo.armorPenetration ?? 0);
    const delivery = weaponInfo.delivery ?? "kinetic";
    const rawDamage = Math.max(0, baseDamage + damageModifier + Number(netHits ?? 0));
    const shieldArmorBonus = defense?.type === "block" ? Number(defense.shieldArmorBonus ?? defense.shield?.armorBonus ?? 0) : 0;
    const armor = delivery === "direct" ? 0 : this.getArmorAtLocation(defender, hitLocation?.key) + shieldArmorBonus;
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
      shieldArmorBonus,
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
    if (hitLocationKey === "head" || hitLocationKey === "headVitals") return "head";
    if (hitLocationKey === "torso") return "torso";
    if (["leftArm", "rightArm", "arms", "hands"].includes(hitLocationKey)) return "arms";
    if (["leftLeg", "rightLeg", "legs"].includes(hitLocationKey)) return "legs";
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

  static resolveCombatResultTarget(combatResult = {}) {
    const tokenId = combatResult?.defenderTokenId ?? combatResult?.tokenId ?? "";
    const sceneId = combatResult?.defenderSceneId ?? combatResult?.sceneId ?? canvas?.scene?.id ?? "";

    if (tokenId) {
      const canvasToken = canvas?.tokens?.get?.(tokenId);
      if (canvasToken?.actor) return { actor: canvasToken.actor, token: canvasToken, tokenDocument: canvasToken.document };

      const scene = sceneId ? game.scenes?.get?.(sceneId) : null;
      const tokenDocument = scene?.tokens?.get?.(tokenId) ?? null;
      if (tokenDocument?.actor) return { actor: tokenDocument.actor, token: tokenDocument.object ?? null, tokenDocument };
    }

    const actor = game.actors?.get(combatResult?.defenderActorId);
    return actor ? { actor, token: null, tokenDocument: null } : null;
  }

  static async applyWound(combatResult) {
    const target = this.resolveCombatResultTarget(combatResult);
    const actor = target?.actor ?? null;
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

    await actor.update({ [`system.wounds.${applied.severity}.slots.${applied.slot}.taken`]: true });
    if (applied.severity === "critical") {
      if (actor.type === "npc") await actor.addStatus?.("dead", 1);
      else await actor.addStatus?.("incapacitated", 1);
    }

    return { ...applied, actor, token: target?.token ?? null, tokenDocument: target?.tokenDocument ?? null };
  }

  static findAvailableWoundSlot(actor, startingSeverity) {
    const order = ["grazing", "minor", "major", "critical"];
    const start = Math.max(0, order.indexOf(startingSeverity));
    const slotOrder = ["one", "two", "three", "four", "five"];

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
      sceneId: canvas?.scene?.id ?? token.scene?.id ?? token.document?.parent?.id ?? token.parent?.id ?? "",
      actorId: token.actor.id ?? "",
      name: token.name ?? token.actor.name ?? game.i18n.localize("AXIOM.Combat.NoDefender"),
      assignedAfterRoll: Boolean(assignedAfterRoll)
    };
  }

  static getTokenFromCombatTarget(target = {}) {
    if (!target) return null;
    const token = canvas?.tokens?.get?.(target.tokenId);
    if (token?.actor) return token;

    const scene = target.sceneId ? game.scenes?.get?.(target.sceneId) : null;
    const tokenDocument = scene?.tokens?.get?.(target.tokenId) ?? null;
    if (tokenDocument?.object?.actor) return tokenDocument.object;
    if (tokenDocument?.actor) return { id: tokenDocument.id, name: tokenDocument.name, actor: tokenDocument.actor, document: tokenDocument };

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
    const ChatCard = game.axiom?.chat?.AxiomChatCard;
    const effectiveAttackState = ChatCard ? ChatCard.normalizeState(attackState) : foundry.utils.deepClone(attackState ?? {});
    const attack = this.getAttackData(effectiveAttackState);
    return this.normalizeOpposedData({
      id: foundry.utils.randomID(),
      attackMessageId: attackMessage.id,
      assignedAfterRoll: Boolean(effectiveAttackState.combatTarget?.assignedAfterRoll),
      attackType: effectiveAttackState.weaponInfo?.category ?? "melee",
      attacker: {
        actorId: effectiveAttackState.actorId ?? "",
        name: effectiveAttackState.actorName ?? game.i18n.localize("AXIOM.RollCard.UnknownActor")
      },
      weapon: {
        itemId: effectiveAttackState.itemId ?? "",
        name: effectiveAttackState.title ?? "",
        damage: Number(effectiveAttackState.weaponInfo?.damage ?? 0),
        armorPenetration: Number(effectiveAttackState.weaponInfo?.armorPenetration ?? 0),
        damageModifier: Number(effectiveAttackState.weaponInfo?.damageModifier ?? 0),
        delivery: effectiveAttackState.weaponInfo?.delivery ?? "kinetic"
      },
      defender: defenderToken?.actor && !unopposed ? {
        tokenId: defenderToken.id,
        sceneId: canvas?.scene?.id ?? defenderToken.scene?.id ?? defenderToken.document?.parent?.id ?? defenderToken.parent?.id ?? "",
        actorId: defenderToken.actor.id,
        name: defenderToken.name ?? defenderToken.actor.name
      } : {
        tokenId: defenderToken?.id ?? "",
        sceneId: canvas?.scene?.id ?? defenderToken?.scene?.id ?? defenderToken?.document?.parent?.id ?? defenderToken?.parent?.id ?? "",
        actorId: defenderToken?.actor?.id ?? "",
        name: defenderToken?.actor?.name ?? game.i18n.localize("AXIOM.Combat.NarrativeTarget")
      },
      attack: this.serializeAttackForOpposition(effectiveAttackState, attack)
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
    let shield = null;
    let parry = null;
    if (defenseType === "block") {
      const block = this.getPrimaryShieldBlockSkill(defender);
      shield = block?.shield ?? null;
      skill = block?.skill ?? null;
      defenseLabel = shield ? game.i18n.format("AXIOM.Combat.BlockWith", { shield: shield.name }) : game.i18n.localize("AXIOM.Combat.Block");
      if (!shield) {
        ui.notifications?.warn(game.i18n.format("AXIOM.Combat.NoShieldAvailable", { actor: defender.name }));
        return null;
      }
      if (!skill) {
        this.warnMissingSkill(defender, shield.system?.skill ?? "", game.i18n.localize("AXIOM.Combat.Block"));
        return null;
      }
    } else if (defenseType === "parry") {
      parry = this.getPrimaryParrySkill(defender);
      skill = parry?.skill ?? null;
      defenseLabel = parry?.weapon
        ? game.i18n.format("AXIOM.Combat.ParryWith", { weapon: parry.weapon.name })
        : game.i18n.localize("AXIOM.Combat.Parry");
      if (!skill) {
        this.warnMissingSkill(defender, this.getUnarmedCombatSkillName(), game.i18n.localize("AXIOM.Combat.Parry"));
        return null;
      }
    } else if (defenseType === "counterattack") {
      parry = this.getPrimaryParrySkill(defender);
      skill = parry?.skill ?? null;
      defenseLabel = game.i18n.localize("AXIOM.Combat.Momentum.Counterattack");
      if (!this.canSpendMomentum(defender, 1)) {
        ui.notifications?.warn(game.i18n.localize("AXIOM.Combat.Momentum.Insufficient"));
        return null;
      }
      if (!skill) {
        this.warnMissingSkill(defender, this.getUnarmedCombatSkillName(), game.i18n.localize("AXIOM.Combat.Momentum.Counterattack"));
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
    if (shield) modifierRows.push({
      id: "auto-shield-block",
      label: "AXIOM.Roll.ModifierSources.ShieldBlock",
      value: Number(shield.system?.blockValue ?? 0),
      automatic: true,
      locked: true
    });
    const guardRow = this.buildGuardModifierRow({
      isMeleeAttack: opposedData.isMelee,
      attackWeapon: this.getAttackingWeaponFromOpposedData(opposedData),
      defender,
      defenseType,
      shield,
      parry
    });
    if (guardRow) modifierRows.push(guardRow);
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
        actionPoints: 0,
        combatDefense: {
          attackMessageId: attackMessage.id,
          defenseType,
          skillName: skill.name,
          shield: shield ? {
            itemId: shield.id,
            name: shield.name,
            blockValue: Number(shield.system?.blockValue ?? 0),
            armorBonus: Number(shield.system?.armorBonus ?? 0)
          } : null,
          counterWeapon: defenseType === "counterattack" ? (() => {
            const weapon = this.getPrimaryParrySkill(defender)?.weapon ?? null;
            return weapon ? {
              itemId: weapon.id,
              name: weapon.name,
              damage: Number(weapon.system?.damage ?? 0),
              armorPenetration: Number(weapon.system?.armorPenetration ?? 0),
              damageModifier: Number(defender.system?.subAttributes?.damageModifier ?? 0),
              delivery: weapon.system?.delivery ?? "kinetic"
            } : null;
          })() : null
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

    const ChatCard = game.axiom?.chat?.AxiomChatCard;
    if (ChatCard) {
      const nextAttackState = ChatCard.normalizeState(attackMessage.getFlag("axiom", "roll") ?? attackState);
      nextAttackState.combatOppositionCreated = true;
      await ChatCard.replaceMessageState(attackMessage, nextAttackState, { refreshLinkedResults: false });
    }

    const opposedResultMessage = await this.createOpposedResultCard({ opposedData, defenseState, defenseMessage, unopposed: false });
    const combatResultMessage = await this.createCombatResultCard({ opposedData, defenseState, defenseMessage, unopposed: false });
    return { opposedResultMessage, combatResultMessage };
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
  static OPPOSED_RESULT_TEMPLATE = "systems/axiom/templates/chat/opposed-result-card.hbs";
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

    const ChatCard = game.axiom?.chat?.AxiomChatCard;
    let effectiveAttackState = ChatCard ? ChatCard.normalizeState(attackState) : foundry.utils.deepClone(attackState);
    effectiveAttackState.combatTarget = this.serializeCombatTarget(defenderToken, { assignedAfterRoll });
    effectiveAttackState = this.applyTargetBasedAttackModifiers(effectiveAttackState, defenderToken);

    if (ChatCard) {
      await ChatCard.replaceMessageState(attackMessage, effectiveAttackState, { refreshLinkedResults: false });
    }

    const attack = this.getAttackData(effectiveAttackState);
    const data = this.normalizeOpposedData({
      id: foundry.utils.randomID(),
      attackMessageId: attackMessage.id,
      assignedAfterRoll,
      attackType: effectiveAttackState.weaponInfo?.category ?? "melee",
      attacker: {
        actorId: effectiveAttackState.actorId ?? "",
        name: effectiveAttackState.actorName ?? game.i18n.localize("AXIOM.RollCard.UnknownActor")
      },
      weapon: {
        itemId: effectiveAttackState.itemId ?? "",
        name: effectiveAttackState.title ?? "",
        damage: Number(effectiveAttackState.weaponInfo?.damage ?? 0),
        armorPenetration: Number(effectiveAttackState.weaponInfo?.armorPenetration ?? 0),
        damageModifier: Number(effectiveAttackState.weaponInfo?.damageModifier ?? 0),
        delivery: effectiveAttackState.weaponInfo?.delivery ?? "kinetic"
      },
      defender: {
        tokenId: defenderToken.id,
        sceneId: canvas?.scene?.id ?? defenderToken.scene?.id ?? defenderToken.document?.parent?.id ?? defenderToken.parent?.id ?? "",
        actorId: defenderToken.actor.id,
        name: defenderToken.name ?? defenderToken.actor.name
      },
      attack: this.serializeAttackForOpposition(effectiveAttackState, attack)
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
    const location = state.isWeaponRoll ? AxiomRoll.getAttackHitLocation(state.d100, state) : null;
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
      resolved: Boolean(data.resolved),
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
        sceneId: data.defender?.sceneId ?? "",
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
      showBlock: this.hasEquippedShield(this.getTokenFromCombatTarget(normalized.defender)?.actor ?? game.actors?.get(normalized.defender.actorId)),
      showCounterattack: normalized.isMelee && this.canSpendMomentum(this.getTokenFromCombatTarget(normalized.defender)?.actor ?? game.actors?.get(normalized.defender.actorId), 1),
      resolved: Boolean(normalized.resolved),
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
    let shield = null;
    let parry = null;
    if (defenseType === "block") {
      const block = this.getPrimaryShieldBlockSkill(defender);
      shield = block?.shield ?? null;
      skill = block?.skill ?? null;
      defenseLabel = shield ? game.i18n.format("AXIOM.Combat.BlockWith", { shield: shield.name }) : game.i18n.localize("AXIOM.Combat.Block");
      if (!shield) {
        ui.notifications?.warn(game.i18n.format("AXIOM.Combat.NoShieldAvailable", { actor: defender.name }));
        return null;
      }
      if (!skill) {
        this.warnMissingSkill(defender, shield.system?.skill ?? "", game.i18n.localize("AXIOM.Combat.Block"));
        return null;
      }
    } else if (defenseType === "parry") {
      parry = this.getPrimaryParrySkill(defender);
      skill = parry?.skill ?? null;
      defenseLabel = parry?.weapon
        ? game.i18n.format("AXIOM.Combat.ParryWith", { weapon: parry.weapon.name })
        : game.i18n.localize("AXIOM.Combat.Parry");
      if (!skill) {
        this.warnMissingSkill(defender, this.getUnarmedCombatSkillName(), game.i18n.localize("AXIOM.Combat.Parry"));
        return null;
      }
    } else if (defenseType === "counterattack") {
      parry = this.getPrimaryParrySkill(defender);
      skill = parry?.skill ?? null;
      defenseLabel = game.i18n.localize("AXIOM.Combat.Momentum.Counterattack");
      if (!this.canSpendMomentum(defender, 1)) {
        ui.notifications?.warn(game.i18n.localize("AXIOM.Combat.Momentum.Insufficient"));
        return null;
      }
      if (!skill) {
        this.warnMissingSkill(defender, this.getUnarmedCombatSkillName(), game.i18n.localize("AXIOM.Combat.Momentum.Counterattack"));
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
    if (shield) modifierRows.push({
      id: "auto-shield-block",
      label: "AXIOM.Roll.ModifierSources.ShieldBlock",
      value: Number(shield.system?.blockValue ?? 0),
      automatic: true,
      locked: true
    });
    const guardRow = this.buildGuardModifierRow({
      isMeleeAttack: opposedData.isMelee,
      attackWeapon: this.getAttackingWeaponFromOpposedData(opposedData),
      defender,
      defenseType,
      shield,
      parry
    });
    if (guardRow) modifierRows.push(guardRow);
    const modifierTotal = modifierRows.reduce((sum, row) => sum + Number(row.value ?? 0), 0);
    const successTarget = Math.min(150, Math.max(5, parts.basePool + modifierTotal));
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
        skillName: skill.name,
        shield: shield ? {
          itemId: shield.id,
          name: shield.name,
          blockValue: Number(shield.system?.blockValue ?? 0),
          armorBonus: Number(shield.system?.armorBonus ?? 0)
        } : null,
        counterWeapon: defenseType === "counterattack" ? (() => {
          const weapon = this.getPrimaryParrySkill(defender)?.weapon ?? null;
          return weapon ? {
            itemId: weapon.id,
            name: weapon.name,
            damage: Number(weapon.system?.damage ?? 0),
            armorPenetration: Number(weapon.system?.armorPenetration ?? 0),
            damageModifier: Number(defender.system?.subAttributes?.damageModifier ?? 0),
            delivery: weapon.system?.delivery ?? "kinetic"
          } : null;
        })() : null
      }
    };

    const ChatCard = game.axiom?.chat?.AxiomChatCard;
    const defenseMessage = await ChatCard.createMessage(defenseState, {
      roll,
      rollMode: "public",
      speaker: ChatMessage.getSpeaker({ actor: defender })
    });

    await this.waitForDiceAnimation(defenseMessage);

    if (defenseType === "counterattack") await this.spendMomentum(defender, 1);
    await this.createOpposedResultCard({ opposedData, defenseState, defenseMessage, unopposed: false });
    await this.markOpposedTestResolved(opposedMessage);
    await this.createCombatResultCard({ opposedData, defenseState, defenseMessage, unopposed: false });
    return defenseMessage;
  }

  static async resolveOpposedUnopposed(opposedMessage) {
    const opposedData = this.normalizeOpposedData(opposedMessage?.getFlag?.("axiom", "combatOpposed") ?? {});
    await this.markOpposedTestResolved(opposedMessage);
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

  static async markOpposedTestResolved(opposedMessage) {
    const data = opposedMessage?.getFlag?.("axiom", "combatOpposed");
    if (!data) return null;
    const nextData = this.normalizeOpposedData({ ...data, resolved: true });
    const content = await this.renderOpposedTest(nextData);
    return opposedMessage.update({ content, flags: { axiom: { combatOpposed: nextData } } });
  }

  static getOpposedWinnerActor(opposedData, opposedResult) {
    if (!opposedData || opposedResult?.stalemate) return null;
    if (opposedResult?.attackerWins) return game.actors?.get(opposedData.attacker?.actorId) ?? null;
    const token = this.getTokenFromCombatTarget(opposedData.defender);
    return token?.actor ?? game.actors?.get(opposedData.defender?.actorId) ?? null;
  }

  static isMomentumEligibleOpposedResult({ opposedData, defenseState = null, unopposed = false } = {}) {
    if (unopposed) return false;
    if (defenseState?.combatDefense?.defenseType === "counterattack") return false;
    const attackType = opposedData?.attackType ?? "";
    return attackType === "melee" || attackType === "ranged";
  }

  static async grantMomentumForOpposedResult(data, { opposedData, defenseState = null, unopposed = false } = {}) {
    if (!this.isMomentumEligibleOpposedResult({ opposedData, defenseState, unopposed })) return null;
    if (Number(data?.netHits ?? 0) < 2 || data?.stalemate) return null;

    const opposedResult = { attackerWins: data.winner === "attacker", defenderWins: data.winner === "defender", stalemate: Boolean(data.stalemate) };
    const actor = this.getOpposedWinnerActor(opposedData, opposedResult);
    if (!actor) return null;

    const before = this.getMomentumCurrent(actor);
    const result = await this.adjustMomentum(actor, 1);
    const after = this.getMomentumCurrent(actor);
    return {
      actorId: actor.id,
      actorName: actor.name ?? "",
      before,
      after,
      max: this.getMomentumMax(actor),
      gained: after > before,
      capped: after <= before
    };
  }

  static buildOpposedResultData({ opposedData, defenseState = null, defenseMessage = null, unopposed = false } = {}) {
    const attackMessage = game.messages?.get(opposedData?.attackMessageId);
    const currentAttackState = attackMessage?.getFlag?.("axiom", "roll") ?? null;
    const attack = currentAttackState ? this.serializeAttackForOpposition(currentAttackState, this.getAttackData(currentAttackState)) : opposedData.attack;
    const defense = defenseState ? this.serializeAttackForOpposition(defenseState, this.getAttackData(defenseState)) : null;
    const opposedResult = this.resolveOpposedHits(attack, defense, { unopposed: Boolean(unopposed) });
    const winnerName = opposedResult.stalemate
      ? game.i18n.localize("AXIOM.Combat.NoVictor")
      : opposedResult.attackerWins ? (opposedData.attacker?.name ?? "") : (opposedData.defender?.name ?? "");

    return {
      id: foundry.utils.randomID(),
      attackMessageId: opposedData.attackMessageId ?? "",
      defenseMessageId: defenseMessage?.id ?? "",
      opposedMessageId: defenseState?.combatDefense?.opposedMessageId ?? "",
      attackerName: opposedData.attacker?.name ?? "",
      defenderName: opposedData.defender?.name ?? "",
      winner: opposedResult.winner,
      winnerName,
      winnerLabel: this.getOpposedResultLabel(opposedResult, { unopposed: Boolean(unopposed) }),
      netHits: Number(opposedResult.margin ?? 0),
      netHitsDisplay: AxiomRoll.formatSigned(opposedResult.margin ?? 0),
      tieBreakerLabel: this.getOpposedTieBreakerLabel(opposedResult),
      stalemate: Boolean(opposedResult.stalemate),
      outcomeCss: opposedResult.attackerWins ? "hit" : opposedResult.defenderWins ? "miss" : "stalemate",
      attack: {
        hits: Number(attack?.hits ?? 0),
        hitsDisplay: AxiomRoll.formatSigned(attack?.hits ?? 0)
      },
      defense: {
        hits: Number(defense?.hits ?? 0),
        hitsDisplay: AxiomRoll.formatSigned(defense?.hits ?? 0)
      }
    };
  }

  static async renderOpposedResult(data) {
    return foundry.applications.handlebars.renderTemplate(this.OPPOSED_RESULT_TEMPLATE, { card: data });
  }

  static async createOpposedResultCard({ opposedData, defenseState = null, defenseMessage = null, unopposed = false } = {}) {
    if (unopposed) return null;
    const data = this.buildOpposedResultData({ opposedData, defenseState, defenseMessage, unopposed });
    data.momentumGain = await this.grantMomentumForOpposedResult(data, { opposedData, defenseState, unopposed });
    const content = await this.renderOpposedResult(data);
    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ alias: game.i18n.localize("AXIOM.Combat.OpposedResult") }),
      content,
      cssClass: "axiom-roll-message",
      flags: { axiom: { opposedResultCard: data } }
    });
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

  static buildCounterattackCombatResultData({ opposedData, defenseState = null, defenseMessage = null } = {}) {
    const attackMessage = game.messages?.get(opposedData?.attackMessageId);
    const currentAttackState = attackMessage?.getFlag?.("axiom", "roll") ?? null;
    const originalAttack = currentAttackState ? this.serializeAttackForOpposition(currentAttackState, this.getAttackData(currentAttackState)) : opposedData.attack;
    const counterRoll = defenseState ? this.serializeAttackForOpposition(defenseState, this.getAttackData(defenseState)) : null;
    const opposedResult = this.resolveOpposedHits(originalAttack, counterRoll, { unopposed: false });
    if (!opposedResult.defenderWins || !counterRoll) return null;

    const originalAttacker = game.actors?.get(opposedData?.attacker?.actorId) ?? null;
    const counterWeapon = defenseState?.combatDefense?.counterWeapon ?? {};
    const hitLocation = AxiomRoll.getAttackHitLocation(counterRoll.d100 ?? defenseState?.d100 ?? 100, {});
    const armor = this.getArmorAtLocation(originalAttacker, hitLocation?.key);
    const toughness = Number(originalAttacker?.system?.subAttributes?.toughness ?? 0);

    return this.normalizeCombatResultCard({
      id: foundry.utils.randomID(),
      attackMessageId: opposedData.attackMessageId ?? "",
      defenseMessageId: defenseMessage?.id ?? "",
      opposedMessageId: defenseState?.combatDefense?.opposedMessageId ?? "",
      unopposed: false,
      attackerName: opposedData.defender?.name ?? "",
      defenderName: opposedData.attacker?.name ?? "",
      defenderActorId: opposedData.attacker?.actorId ?? "",
      defenderTokenId: "",
      defenderSceneId: "",
      weaponName: counterWeapon.name ?? game.i18n.localize("AXIOM.Combat.Momentum.Counterattack"),
      hitLocationKey: hitLocation?.key ?? "",
      hitLocationLabel: hitLocation?.label ?? "AXIOM.Combat.NotApplicableShort",
      hitLocationText: hitLocation?.labelText ?? game.i18n.localize(hitLocation?.label ?? "AXIOM.Combat.NotApplicableShort"),
      attack: {
        d100: Number(counterRoll.d100 ?? 100),
        roll: counterRoll.rollDisplay ?? AxiomRoll.formatD100(counterRoll.d100),
        successTarget: Number(counterRoll.successTarget ?? 0),
        hits: Number(counterRoll.hits ?? 0),
        success: Boolean(counterRoll.success),
        complication: Boolean(counterRoll.complication)
      },
      defense: {
        d100: Number(originalAttack.d100 ?? 100),
        roll: originalAttack.rollDisplay ?? AxiomRoll.formatD100(originalAttack.d100),
        successTarget: Number(originalAttack.successTarget ?? 0),
        hits: Number(originalAttack.hits ?? 0),
        success: Boolean(originalAttack.success),
        complication: Boolean(originalAttack.complication)
      },
      values: {
        baseDamage: Number(counterWeapon.damage ?? 0),
        damageModifier: Number(counterWeapon.damageModifier ?? 0),
        armorPenetration: Number(counterWeapon.armorPenetration ?? 0),
        armor,
        shieldArmorBonus: 0,
        toughness
      },
      woundApplied: false
    });
  }

  static buildCombatResultData({ opposedData, defenseState = null, defenseMessage = null, unopposed = false } = {}) {
    const attackMessage = game.messages?.get(opposedData?.attackMessageId);
    if (defenseState?.combatDefense?.defenseType === "counterattack") {
      const counterattackData = this.buildCounterattackCombatResultData({ opposedData, defenseState, defenseMessage });
      if (counterattackData) return counterattackData;
    }
    const currentAttackState = attackMessage?.getFlag?.("axiom", "roll") ?? null;
    const attack = currentAttackState ? this.serializeAttackForOpposition(currentAttackState, this.getAttackData(currentAttackState)) : opposedData.attack;
    const defense = defenseState ? this.serializeAttackForOpposition(defenseState, this.getAttackData(defenseState)) : null;
    const defenderToken = this.getTokenFromCombatTarget(opposedData?.defender);
    const defender = defenderToken?.actor ?? game.actors?.get(opposedData?.defender?.actorId);
    const hitLocation = attack.hitLocation ?? null;
    const shieldArmorBonus = defenseState?.combatDefense?.defenseType === "block" ? Number(defenseState.combatDefense?.shield?.armorBonus ?? 0) : 0;
    const armor = this.getArmorAtLocation(defender, hitLocation?.key) + shieldArmorBonus;
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
      defenderTokenId: opposedData.defender?.tokenId ?? "",
      defenderSceneId: opposedData.defender?.sceneId ?? "",
      weaponName: opposedData.weapon?.name ?? "",
      hitLocationKey: hitLocation?.key ?? "",
      hitLocationLabel: hitLocation?.label ?? "AXIOM.Combat.NotApplicableShort",
      hitLocationText: hitLocation?.labelText ?? game.i18n.localize("AXIOM.Combat.NotApplicableShort"),
      attack: {
        d100: Number(attack.d100 ?? 100),
        roll: attack.rollDisplay ?? AxiomRoll.formatD100(attack.d100),
        successTarget: Number(attack.successTarget ?? 0),
        hits: Number(attack.hits ?? 0),
        success: Boolean(attack.success),
        complication: Boolean(attack.complication)
      },
      defense: {
        d100: defense ? Number(defense.d100 ?? 100) : null,
        roll: defense?.rollDisplay ?? "",
        successTarget: Number(defense?.successTarget ?? 0),
        hits: unopposed ? 0 : Number(defense?.hits ?? 0),
        success: Boolean(defense?.success),
        complication: Boolean(defense?.complication)
      },
      values: {
        baseDamage: Number(opposedData.weapon?.damage ?? 0),
        damageModifier: opposedData.attackType === "melee" ? Number(opposedData.weapon?.damageModifier ?? 0) : 0,
        armorPenetration: Number(opposedData.weapon?.armorPenetration ?? 0),
        armor,
        shieldArmorBonus,
        toughness
      },
      woundApplied: false
    });
  }

  static normalizeCombatResultCard(data = {}) {
    const attackHits = Number(data.attack?.hits ?? 0);
    const defenseHits = data.unopposed ? 0 : Number(data.defense?.hits ?? 0);
    const opposedResult = this.resolveOpposedHits(data.attack, data.defense, { unopposed: Boolean(data.unopposed) });
    const netHits = opposedResult.attackerWins ? opposedResult.netHits : 0;
    const hitsAttack = opposedResult.attackerWins;
    const opposedMargin = Number(opposedResult.margin ?? 0);
    const opposedWinnerName = opposedResult.stalemate
      ? game.i18n.localize("AXIOM.Combat.NoVictor")
      : opposedResult.attackerWins ? (data.attackerName ?? "") : (data.defenderName ?? "");
    const baseDamage = Number(data.values?.baseDamage ?? 0);
    const damageModifier = Number(data.values?.damageModifier ?? 0);
    const armorPenetration = Number(data.values?.armorPenetration ?? 0);
    const armor = Number(data.values?.armor ?? 0);
    const toughness = Number(data.values?.toughness ?? 0);
    const shieldArmorBonus = Number(data.values?.shieldArmorBonus ?? 0);
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
    const effectiveArmorTooltip = shieldArmorBonus > 0
      ? `Effective Armor: Armor ${armor - shieldArmorBonus} + Shield ${shieldArmorBonus} - AP ${armorPenetration} = ${effectiveArmor}`
      : `Effective Armor: Armor ${armor} - AP ${armorPenetration} = ${effectiveArmor}`;
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
        d100: Number(data.attack?.d100 ?? AxiomRoll.normalizeD100(data.attack?.roll ?? 100)),
        roll: data.attack?.roll ?? "",
        successTarget: Number(data.attack?.successTarget ?? 0),
        hits: attackHits,
        hitsDisplay: AxiomRoll.formatSigned(attackHits),
        success: this.getOpposedAttackSuccess(data.attack),
        complication: Boolean(data.attack?.complication)
      },
      defense: {
        d100: data.defense?.d100 ?? (data.defense?.roll ? AxiomRoll.normalizeD100(data.defense.roll) : null),
        roll: data.defense?.roll ?? "",
        successTarget: Number(data.defense?.successTarget ?? 0),
        hits: defenseHits,
        hitsDisplay: AxiomRoll.formatSigned(defenseHits),
        success: Boolean(data.defense?.success),
        complication: Boolean(data.defense?.complication)
      },
      values: { baseDamage, damageModifier, armorPenetration, armor, shieldArmorBonus, toughness },
      netHits,
      netHitsDisplay: AxiomRoll.formatSigned(netHits),
      opposed: {
        winner: opposedResult.winner,
        winnerName: opposedWinnerName,
        margin: opposedMargin,
        marginDisplay: AxiomRoll.formatSigned(opposedMargin),
        resultLabel: this.getOpposedResultLabel(opposedResult, { unopposed: Boolean(data.unopposed) }),
        tieBreakerLabel: this.getOpposedTieBreakerLabel(opposedResult),
        stalemate: Boolean(opposedResult.stalemate)
      },
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
      canApplyWound: Boolean(finalDamage > 0 && woundSeverity && (data.defenderTokenId || data.defenderActorId)),
      woundApplied: Boolean(data.woundApplied),
      appliedWound: data.appliedWound ?? null,
      defenderActorId: data.defenderActorId ?? "",
      defenderTokenId: data.defenderTokenId ?? "",
      defenderSceneId: data.defenderSceneId ?? ""
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

    const defender = this.resolveCombatResultTarget(existing)?.actor ?? game.actors?.get(existing.defenderActorId);
    const hitLocation = attack?.hitLocation ?? { key: existing.hitLocationKey, label: existing.hitLocationLabel, labelText: existing.hitLocationText };
    const shieldArmorBonus = defenseState?.combatDefense?.defenseType === "block" ? Number(defenseState.combatDefense?.shield?.armorBonus ?? existing.values?.shieldArmorBonus ?? 0) : Number(existing.values?.shieldArmorBonus ?? 0);

    return this.normalizeCombatResultCard({
      ...existing,
      hitLocationKey: hitLocation?.key ?? existing.hitLocationKey ?? "",
      hitLocationLabel: hitLocation?.label ?? existing.hitLocationLabel ?? "AXIOM.Combat.NotApplicableShort",
      hitLocationText: hitLocation?.labelText ?? existing.hitLocationText ?? game.i18n.localize("AXIOM.Combat.NotApplicableShort"),
      attack: {
        d100: Number(attack?.d100 ?? existing.attack?.d100 ?? AxiomRoll.normalizeD100(existing.attack?.roll ?? 100)),
        roll: attack?.rollDisplay ?? existing.attack?.roll ?? "",
        successTarget: Number(attack?.successTarget ?? existing.attack?.successTarget ?? 0),
        hits: Number(attack?.hits ?? existing.attack?.hits ?? 0),
        success: Boolean(attack?.success ?? existing.attack?.success ?? this.getOpposedAttackSuccess(existing.attack)),
        complication: Boolean(attack?.complication ?? existing.attack?.complication)
      },
      defense: {
        d100: defense ? Number(defense.d100 ?? existing.defense?.d100 ?? AxiomRoll.normalizeD100(existing.defense?.roll ?? 100)) : existing.defense?.d100 ?? null,
        roll: defense?.rollDisplay ?? existing.defense?.roll ?? "",
        successTarget: Number(defense?.successTarget ?? existing.defense?.successTarget ?? 0),
        hits: existing.unopposed ? 0 : Number(defense?.hits ?? existing.defense?.hits ?? 0),
        success: Boolean(defense?.success ?? existing.defense?.success),
        complication: Boolean(defense?.complication ?? existing.defense?.complication)
      },
      values: {
        baseDamage: Number(attackState?.weaponInfo?.damage ?? existing.values?.baseDamage ?? 0),
        damageModifier: attackState?.weaponInfo?.category === "melee" ? Number(attackState?.weaponInfo?.damageModifier ?? existing.values?.damageModifier ?? 0) : 0,
        armorPenetration: Number(attackState?.weaponInfo?.armorPenetration ?? existing.values?.armorPenetration ?? 0),
        armor: this.getArmorAtLocation(defender, hitLocation?.key) + shieldArmorBonus,
        shieldArmorBonus,
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

  static async refreshOpposedResultMessage(message) {
    const existing = message?.getFlag?.("axiom", "opposedResultCard");
    if (!existing) return null;

    const attackMessage = game.messages?.get(existing.attackMessageId);
    const attackState = attackMessage?.getFlag?.("axiom", "roll") ?? null;
    const defenseMessage = game.messages?.get(existing.defenseMessageId);
    const defenseState = defenseMessage?.getFlag?.("axiom", "roll") ?? null;
    const opposedData = this.normalizeOpposedData({
      attackMessageId: existing.attackMessageId ?? "",
      attacker: { name: existing.attackerName ?? "", actorId: attackState?.actorId ?? "" },
      defender: { name: existing.defenderName ?? "", actorId: defenseState?.actorId ?? "" },
      attack: attackState ? this.serializeAttackForOpposition(attackState, this.getAttackData(attackState)) : {},
      attackType: attackState?.weaponInfo?.category ?? "melee"
    });
    const normalized = {
      ...this.buildOpposedResultData({ opposedData, defenseState, defenseMessage, unopposed: false }),
      id: existing.id ?? foundry.utils.randomID(),
      attackerName: existing.attackerName ?? opposedData.attacker.name,
      defenderName: existing.defenderName ?? opposedData.defender.name
    };
    const content = await this.renderOpposedResult(normalized);
    return message.update({ content, flags: { axiom: { opposedResultCard: normalized } } });
  }

  static async refreshLinkedCombatResultsForRollMessage(rollMessage) {
    const id = rollMessage?.id;
    if (!id) return;
    const linkedCombatResults = game.messages?.filter?.(message => {
      const data = message.getFlag?.("axiom", "combatResultCard");
      return data && (data.attackMessageId === id || data.defenseMessageId === id);
    }) ?? [];
    const linkedOpposedResults = game.messages?.filter?.(message => {
      const data = message.getFlag?.("axiom", "opposedResultCard");
      return data && (data.attackMessageId === id || data.defenseMessageId === id);
    }) ?? [];

    for (const message of linkedOpposedResults) await this.refreshOpposedResultMessage(message);
    for (const message of linkedCombatResults) await this.refreshCombatResultMessage(message);
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
      opposed.querySelector("[data-action='combatBlock']")?.addEventListener("click", event => {
        event.preventDefault(); event.stopPropagation(); this.resolveOpposedDefense(message, "block");
      });
      opposed.querySelector("[data-action='combatCounterattack']")?.addEventListener("click", event => {
        event.preventDefault(); event.stopPropagation(); this.resolveOpposedDefense(message, "counterattack");
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

    const statusCard = element.querySelector?.(".axiom-chat-card.axiom-status-card");
    if (statusCard) {
      statusCard.querySelectorAll("[data-action='resolveStatus']").forEach(button => {
        button.addEventListener("click", event => this._onResolveStatusCardAction(event, message));
      });
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
      defenderTokenId: data.defenderTokenId,
      defenderSceneId: data.defenderSceneId,
      damage: { woundSeverity: data.woundSeverity }
    });
    if (!applied) return;
    await this.updateCombatResultMessage(message, {
      woundApplied: true,
      appliedWound: { severity: applied.severity, slot: applied.slot, label: `AXIOM.Combat.Wounds.${applied.severity}` }
    });
  }

  static async _onResolveStatusCardAction(event, message) {
    event.preventDefault();
    event.stopPropagation();
    if (!game.user?.isGM) return;

    const button = event.currentTarget;
    const statusId = button?.dataset?.statusId;
    const actorId = message.getFlag?.("axiom", "actorId") ?? message.speaker?.actor;
    const actor = actorId ? game.actors?.get(actorId) : null;
    if (!actor || !statusId) return;

    let result = null;
    if (["burning", "corroding"].includes(statusId)) result = await this.resolveOngoingDamageStatus(actor, statusId);
    else if (statusId === "bleeding") result = await this.resolveBleedingStatus(actor);
    else if (statusId === "stunned") result = await this.resolveStunnedRecovery(actor);

    if (!result) return;
    await this.updateStatusCardRow(message, statusId, result);
  }

  static async resolveOngoingDamageStatus(actor, statusId) {
    const stacks = this.getStatusStacks(actor, statusId);
    if (stacks <= 0) return null;

    const rawDamage = stacks * 2;
    const armorPenetration = stacks * 2;
    const armor = this.getArmorAtLocation(actor, "torso");
    const effectiveArmor = Math.max(0, armor - armorPenetration);
    const toughness = Number(actor.system?.subAttributes?.toughness ?? 0);
    const finalDamage = Math.max(0, rawDamage - effectiveArmor - toughness);
    const woundSeverity = this.getWoundSeverity(finalDamage);
    let applied = null;

    if (woundSeverity) {
      applied = await this.applyWound({
        defenderActorId: actor.id,
        damage: { woundSeverity }
      });
    }

    await actor.addStatus?.(statusId, 1);

    return {
      label: game.i18n.format("AXIOM.StatusCard.DamageResolved", {
        finalDamage,
        wound: woundSeverity ? game.i18n.localize(`AXIOM.Combat.Wounds.${applied?.severity ?? woundSeverity}`) : game.i18n.localize("AXIOM.Combat.NoWound")
      }),
      details: game.i18n.format("AXIOM.StatusCard.DamageFormula", {
        rawDamage,
        armor,
        armorPenetration,
        effectiveArmor,
        toughness,
        finalDamage
      })
    };
  }

  static async resolveBleedingStatus(actor) {
    const stacks = this.getStatusStacks(actor, "bleeding");
    if (stacks <= 0) return null;

    let appliedCount = 0;
    for (let index = 0; index < stacks; index += 1) {
      const applied = await this.applyWound({ defenderActorId: actor.id, damage: { woundSeverity: "grazing" } });
      if (applied) appliedCount += 1;
    }

    return {
      label: game.i18n.format("AXIOM.StatusCard.BleedingResolved", { wounds: appliedCount }),
      details: game.i18n.format("AXIOM.StatusCard.BleedingFormula", { stacks })
    };
  }

  static async resolveStunnedRecovery(actor) {
    const stacks = this.getStatusStacks(actor, "stunned");
    if (stacks <= 0) return null;

    const d100 = (await new Roll("1d100").evaluate()).total;
    const basePool = AxiomRoll.calculateAttributeCheckPool(actor, "fortitude", "resolve");
    const successTarget = AxiomRoll.normalizeSuccessTarget(basePool);
    const result = AxiomRoll.evaluateResult({ d100, successTarget });
    const recovered = Math.max(0, Number(result.hits ?? 0));
    if (recovered > 0) await actor.removeStatus?.("stunned", recovered);
    await this.clampActionPointsToEffectiveMax(actor);

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `
        <article class="axiom-chat-card roll-card axiom-status-card axiom-status-recovery-card">
          <header class="card-header">
            <div class="card-title">
              <strong>${game.i18n.localize("AXIOM.StatusCard.StunnedRecovery")}</strong>
              <span>${foundry.utils.escapeHTML(actor.name ?? "")}</span>
            </div>
            <div class="card-badge">${AxiomRoll.formatD100(d100)} / ${successTarget}</div>
          </header>
          <section class="card-body">
            <div class="axiom-status-card-result ${result.success ? "success" : "failure"}">
              <span>${game.i18n.localize("AXIOM.RollCard.Hits")}</span>
              <strong>${AxiomRoll.formatSigned(result.hits)}</strong>
              <em>${game.i18n.localize(result.outcomeTierLabel)}</em>
            </div>
          </section>
        </article>
      `,
      style: CONST.CHAT_MESSAGE_STYLES?.OTHER
    });

    return {
      label: game.i18n.format("AXIOM.StatusCard.StunnedResolved", { recovered }),
      details: game.i18n.format("AXIOM.StatusCard.StunnedFormula", { roll: AxiomRoll.formatD100(d100), target: successTarget })
    };
  }

  static async updateStatusCardRow(message, statusId, result) {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = message.content ?? "";
    const row = wrapper.querySelector(`.axiom-status-card-row[data-status-id="${statusId}"]`);
    if (!row) return;

    row.classList.add("resolved");
    const button = row.querySelector("button");
    if (button) button.remove();

    const note = document.createElement("div");
    note.className = "axiom-status-card-resolution";
    note.innerHTML = `<strong>${foundry.utils.escapeHTML(result.label ?? game.i18n.localize("AXIOM.StatusCard.Resolved"))}</strong>${result.details ? `<span>${foundry.utils.escapeHTML(result.details)}</span>` : ""}`;
    row.append(note);

    await message.update({ content: wrapper.innerHTML });
  }

  static _getConfiguredSkillName(settingKey, fallback) {
    const value = game.settings?.get?.("axiom", settingKey);
    return String(value ?? fallback).trim() || fallback;
  }
}
