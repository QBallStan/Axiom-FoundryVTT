import AxiomRoll from "./axiom-roll.mjs";
import AxiomCombat from "../combat.mjs";

const { renderTemplate } = foundry.applications.handlebars;

export default class AxiomChatCard {
  static TEMPLATE = "systems/axiom/templates/chat/roll-card.hbs";

  static async render(state) {
    const normalized = this.normalizeState(state);
    const card = this.prepareCardData(normalized);
    return renderTemplate(this.TEMPLATE, { card });
  }

  static normalizeState(state = {}) {
    const modifierRows = Array.isArray(state.modifierRows)
      ? state.modifierRows.map((row, index) => ({
          id: row.id ?? `modifier-${index}`,
          label: row.label ?? game.i18n.localize("AXIOM.Roll.ModifierSources.Custom"),
          value: Number(row.value ?? 0),
          active: row.active !== false,
          automatic: Boolean(row.automatic),
          locked: Boolean(row.locked),
          calledShot: row.calledShot ?? null
        }))
      : [];

    const timeframe = state.timeframe ? {
      key: state.timeframe.key ?? "",
      label: state.timeframe.label ?? "",
      formulaLabel: state.timeframe.formulaLabel ?? "",
      multiplier: Number(state.timeframe.multiplier ?? 1),
      unit: state.timeframe.unit ?? "",
      die: Number(state.timeframe.die ?? 0),
      total: Number(state.timeframe.total ?? 0),
      display: state.timeframe.display ?? ""
    } : null;

    const weaponInfo = state.weaponInfo ? {
      category: state.weaponInfo.category ?? "",
      damage: Number(state.weaponInfo.damage ?? 0),
      armorPenetration: Number(state.weaponInfo.armorPenetration ?? 0),
      damageModifier: Number(state.weaponInfo.damageModifier ?? 0),
      delivery: state.weaponInfo.delivery ?? "",
      range: Number(state.weaponInfo.range ?? 0),
      ammo: Number(state.weaponInfo.ammo ?? 0),
      ammoContainer: Number(state.weaponInfo.ammoContainer ?? 0)
    } : null;

    const combatResult = state.combatResult ? {
      ...state.combatResult,
      attackHitsDisplay: AxiomRoll.formatSigned(state.combatResult.attackHits ?? 0),
      defenseHitsDisplay: AxiomRoll.formatSigned(state.combatResult.defenseHits ?? 0),
      netHitsDisplay: AxiomRoll.formatSigned(state.combatResult.netHits ?? 0),
      canApplyWound: Boolean(state.combatResult.canApplyWound) && !state.combatResult.woundApplied
    } : null;

    return {
      ...state,
      rollId: state.rollId ?? foundry.utils.randomID(),
      actorId: state.actorId ?? "",
      actorName: state.actorName ?? game.i18n.localize("AXIOM.RollCard.UnknownActor"),
      itemId: state.itemId ?? "",
      title: state.title ?? game.i18n.localize("AXIOM.Roll.SkillTest"),
      testType: state.testType ?? "skill",
      testTypeLabel: state.testTypeLabel ?? this.getTestTypeLabel(state.testType ?? "skill"),
      d100: AxiomRoll.normalizeD100(state.d100 ?? 1),
      basePool: Number(state.basePool ?? 0),
      difficulty: Number(state.difficulty ?? 0),
      modifierRows,
      timeframeOnly: Boolean(state.timeframeOnly),
      timeframe,
      isWeaponRoll: Boolean(state.isWeaponRoll),
      isMeleeWeaponRoll: Boolean(state.isMeleeWeaponRoll) || weaponInfo?.category === "melee",
      weaponInfo,
      combatTarget: state.combatTarget ? {
        tokenId: state.combatTarget.tokenId ?? "",
        sceneId: state.combatTarget.sceneId ?? "",
        actorId: state.combatTarget.actorId ?? "",
        name: state.combatTarget.name ?? "",
        assignedAfterRoll: Boolean(state.combatTarget.assignedAfterRoll)
      } : null,
      location: state.location ?? "",
      damage: state.damage ?? "",
      combatResult,
      detailsOpen: Boolean(state.detailsOpen),
      fateHitBonus: Number(state.fateHitBonus ?? 0),
      fateSpent: Number(state.fateSpent ?? 0),
      rerollHistory: Array.isArray(state.rerollHistory) ? state.rerollHistory.map(value => AxiomRoll.normalizeD100(value)) : [],
      complicationResolved: Boolean(state.complicationResolved),
      complicationResolution: state.complicationResolution ?? "",
      combatOppositionCreated: Boolean(state.combatOppositionCreated)
    };
  }

  static prepareCardData(state = {}) {
    const normalized = this.normalizeState(state);
    if (normalized.timeframeOnly) {
      return {
        ...normalized,
        rollDisplay: "",
        timeframeLabel: normalized.timeframe?.label ?? "",
        timeframeFormula: normalized.timeframe?.formulaLabel ?? "",
        timeframeDie: normalized.timeframe?.die ?? 0,
        timeframeTotal: normalized.timeframe?.total ?? 0,
        timeframeDisplay: normalized.timeframe?.display ?? ""
      };
    }

    const activeModifierTotal = normalized.modifierRows.reduce((sum, row) => row.active === false ? sum : sum + Number(row.value ?? 0), 0);
    const rawSuccessTarget = normalized.basePool + normalized.difficulty + activeModifierTotal;
    const successTarget = Math.min(120, Math.max(5, rawSuccessTarget));
    const result = AxiomRoll.evaluateResult({ d100: normalized.d100, successTarget, hitModifier: normalized.fateHitBonus });

    const modifierRows = normalized.modifierRows.map(row => ({
      ...row,
      displayValue: AxiomRoll.formatSigned(row.value),
      labelText: game.i18n.has(row.label) ? game.i18n.localize(row.label) : row.label,
      cssClass: row.active === false ? "inactive" : "active",
      toggleIcon: row.active === false ? "fa-regular fa-square" : "fa-regular fa-square-check",
      toggleLabel: row.active === false ? "AXIOM.RollCard.EnableModifier" : "AXIOM.RollCard.DisableModifier",
      calledShotEffectText: row.calledShot?.effect
        ? game.i18n.localize(row.calledShot.effect)
        : ""
    }));

    const difficultyRow = {
      id: "difficulty",
      label: "AXIOM.Roll.Difficulty",
      labelText: game.i18n.localize("AXIOM.Roll.Difficulty"),
      value: normalized.difficulty,
      displayValue: AxiomRoll.formatSigned(normalized.difficulty),
      active: true,
      fixed: true,
      cssClass: "active fixed"
    };

    const showWeaponSummary = normalized.isWeaponRoll;
    const hitLocation = showWeaponSummary ? AxiomRoll.getHitLocation(normalized.d100) : null;
    const location = normalized.combatResult?.hitLocation?.labelText
      ?? (showWeaponSummary ? game.i18n.localize(hitLocation.label) : normalized.location || game.i18n.localize("AXIOM.RollCard.Pending"));
    const pendingDamageModifier = normalized.weaponInfo?.category === "melee" ? Number(normalized.weaponInfo?.damageModifier ?? 0) : 0;
    const damage = normalized.combatResult?.damage?.finalDamageDisplay
      ?? (showWeaponSummary ? AxiomRoll.formatWeaponDamage({ ...(normalized.weaponInfo ?? {}), damageModifier: pendingDamageModifier, hits: result.hits }) : normalized.damage || game.i18n.localize("AXIOM.RollCard.Pending"));
    const isAttackCard = normalized.isWeaponRoll && normalized.testType === "weapon";
    const combatResolved = Boolean(normalized.combatResult?.resolved);
    const combatTargetName = normalized.combatTarget?.name || game.i18n.localize("AXIOM.Combat.NoDefender");

    return {
      ...normalized,
      ...result,
      rollDisplay: AxiomRoll.formatD100(normalized.d100),
      rollInputValue: normalized.d100 === 100 ? "00" : String(normalized.d100).padStart(2, "0"),
      timeframeLabel: normalized.timeframe?.label ?? "",
      timeframeFormula: normalized.timeframe?.formulaLabel ?? "",
      timeframeDie: normalized.timeframe?.die ?? 0,
      timeframeTotal: normalized.timeframe?.total ?? 0,
      timeframeDisplay: normalized.timeframe?.display ?? "",
      successTarget,
      rawSuccessTarget,
      hitsDisplay: AxiomRoll.formatSigned(result.hits),
      baseHitsDisplay: AxiomRoll.formatSigned(result.baseHits),
      fateHitBonusDisplay: AxiomRoll.formatSigned(normalized.fateHitBonus),
      hasFateHitBonus: normalized.fateHitBonus !== 0,
      fateSpentDisplay: String(normalized.fateSpent),
      rerollHistoryDisplay: normalized.rerollHistory.map(value => AxiomRoll.formatD100(value)).join(", "),
      hasRerollHistory: normalized.rerollHistory.length > 0,
      modifiersDisplay: AxiomRoll.formatSigned(activeModifierTotal),
      difficultyDisplay: AxiomRoll.formatSigned(normalized.difficulty),
      activeModifierTotal,
      activeModifierRows: modifierRows.filter(row => row.active !== false),
      modifierRows,
      hasModifierRows: modifierRows.length > 0,
      difficultyRow,
      hasAnyModifierRows: normalized.difficulty !== 0 || modifierRows.length > 0,
      showWeaponSummary,
      isAttackCard,
      combatResolved,
      showDefenseActions: isAttackCard && !normalized.combatOppositionCreated,
      showParryAction: normalized.weaponInfo?.category !== "ranged",
      showAttackTargetActions: false,
      combatTargetName,
      hasCombatTarget: Boolean(normalized.combatTarget?.actorId),
      combatTargetAssignedAfterRoll: Boolean(normalized.combatTarget?.assignedAfterRoll),
      showApplyWoundAction: Boolean(normalized.combatResult?.canApplyWound) && !normalized.combatResult?.woundApplied,
      combatResult: normalized.combatResult,
      hitLocationValue: hitLocation?.value ?? null,
      hitLocationKey: hitLocation?.key ?? "",
      location,
      damage,
      showComplicationActions: result.complication && !normalized.complicationResolved,
      complicationText: this.getComplicationText({ complication: result.complication, resolution: normalized.complicationResolution }),
      complicationCss: this.getComplicationCss({ complication: result.complication, resolution: normalized.complicationResolution }),
      automaticResult: result.automaticSuccess
        ? "AXIOM.RollCard.AutomaticSuccess"
        : result.automaticFailure ? "AXIOM.RollCard.AutomaticFailure" : ""
    };
  }

  static async createMessage(state, { roll = null, rollMode = "public", speaker = null } = {}) {
    const normalized = this.normalizeState(state);
    const content = await this.render(normalized);
    const messageData = {
      speaker: speaker ?? ChatMessage.getSpeaker(),
      content,
      cssClass: "axiom-roll-message",
      flags: {
        axiom: { roll: normalized }
      }
    };

    if (Array.isArray(roll)) messageData.rolls = roll.filter(Boolean);
    else if (roll) messageData.rolls = [roll];
    this.applyRollMode(messageData, rollMode);
    return ChatMessage.create(messageData);
  }

  static onRenderChatMessageHTML(message, element) {
    this.decorateInitiativeMessage(message, element);

    AxiomCombat.onRenderChatMessageHTML(message, element);

    const card = element.querySelector?.(".axiom-chat-card.roll-card");
    if (!card) return;

    card.querySelector("[data-action='enableRollEdit']")?.addEventListener("click", event => this._onEnableRollEdit(event));

    const rollInput = card.querySelector("[data-action='editRollValue']");
    rollInput?.addEventListener("change", event => this._onEditRollValue(event, message));
    rollInput?.addEventListener("keydown", event => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      event.currentTarget.blur();
    });
    rollInput?.addEventListener("blur", event => {
      event.currentTarget.readOnly = true;
      event.currentTarget.closest(".editable-roll-side")?.classList.remove("editing");
    });

    card.querySelectorAll("[data-action='toggleCardModifier']").forEach(button => {
      button.addEventListener("click", event => this._onToggleModifier(event, message));
    });

    card.querySelector("[data-action='secondWindReroll']")?.addEventListener("click", event => this._onSecondWindReroll(event, message));
    card.querySelector("[data-action='secondWindHit']")?.addEventListener("click", event => this._onSecondWindHit(event, message));
    card.querySelector("[data-action='negateComplication']")?.addEventListener("click", event => this._onNegateComplication(event, message));
    card.querySelector("[data-action='acceptComplication']")?.addEventListener("click", event => this._onAcceptComplication(event, message));
    card.querySelector("[data-action='assignCombatOpponent']")?.addEventListener("click", event => this._onAssignCombatOpponent(event, message));
    card.querySelector("[data-action='combatDodge']")?.addEventListener("click", event => this._onCombatDefense(event, message, "dodge"));
    card.querySelector("[data-action='combatParry']")?.addEventListener("click", event => this._onCombatDefense(event, message, "parry"));
    card.querySelector("[data-action='combatUnopposed']")?.addEventListener("click", event => this._onCombatUnopposed(event, message));
    card.querySelector("[data-action='applyCombatWound']")?.addEventListener("click", event => this._onApplyCombatWound(event, message));

  }

  static decorateInitiativeMessage(message, element) {
    if (!element?.classList || element.classList.contains("axiom-roll-message")) return;

    const isAxiomInitiative = Boolean(message.getFlag?.("axiom", "initiative"));
    const isCoreInitiative = Boolean(message.getFlag?.("core", "initiativeRoll"));
    const flavor = String(message.flavor ?? element.querySelector?.(".flavor-text")?.textContent ?? "");
    const hasDiceRoll = Boolean(element.querySelector?.(".dice-roll"));
    const hasInitiativeFlavor = /initiative/i.test(flavor);

    if (!hasDiceRoll || !(isAxiomInitiative || isCoreInitiative || hasInitiativeFlavor)) return;
    element.classList.add("axiom-initiative-message");
  }

  static _onEnableRollEdit(event) {
    event.preventDefault();
    event.stopPropagation();

    const side = event.currentTarget.closest(".editable-roll-side");
    const input = side?.querySelector("[data-action='editRollValue']");
    if (!input) return;

    side.classList.add("editing");
    input.readOnly = false;
    input.focus();
    input.select();
  }

  static async _onEditRollValue(event, message) {
    event.preventDefault();
    const value = AxiomRoll.normalizeD100(event.currentTarget.value);
    const detailsOpen = Boolean(event.currentTarget.closest(".axiom-chat-card.roll-card")?.querySelector("details.breakdown")?.open);
    await this.updateMessageState(message, { d100: value, detailsOpen, combatResult: null });
  }

  static async _onToggleModifier(event, message) {
    event.preventDefault();
    event.stopPropagation();

    const id = event.currentTarget.dataset.modifierId;
    if (!id) return;

    const detailsOpen = Boolean(event.currentTarget.closest("details.breakdown")?.open);
    const state = this.normalizeState(message.getFlag("axiom", "roll") ?? {});
    state.detailsOpen = detailsOpen;
    state.modifierRows = state.modifierRows.map(row => row.id === id ? { ...row, active: row.active === false } : row);
    state.combatResult = null;
    await this.replaceMessageState(message, state);
  }

  static async _onSecondWindReroll(event, message) {
    event.preventDefault();
    event.stopPropagation();

    // Event.currentTarget is cleared once an async handler yields. Capture DOM
    // state before spending Fate or rolling.
    const card = event.currentTarget?.closest(".axiom-chat-card.roll-card");
    const detailsOpen = Boolean(card?.querySelector("details.breakdown")?.open);

    const state = this.normalizeState(message.getFlag("axiom", "roll") ?? {});
    const actor = this._getActorForState(state);
    if (!await this._spendFate(actor)) return;

    const roll = await new Roll("1d100").evaluate();
    await this._showDiceRoll(roll, message);
    const newD100 = AxiomRoll.normalizeD100(roll.total);

    state.detailsOpen = detailsOpen;
    state.rerollHistory = [...(state.rerollHistory ?? []), state.d100];
    state.d100 = newD100;
    state.fateHitBonus = 0;
    state.fateSpent = Number(state.fateSpent ?? 0) + 1;
    state.combatResult = null;

    await this.replaceMessageState(message, state);
  }

  static async _onSecondWindHit(event, message) {
    event.preventDefault();
    event.stopPropagation();

    // Event.currentTarget is cleared once an async handler yields. Capture DOM
    // state before spending Fate.
    const card = event.currentTarget?.closest(".axiom-chat-card.roll-card");
    const detailsOpen = Boolean(card?.querySelector("details.breakdown")?.open);

    const state = this.normalizeState(message.getFlag("axiom", "roll") ?? {});
    const actor = this._getActorForState(state);
    if (!await this._spendFate(actor)) return;

    state.detailsOpen = detailsOpen;
    state.fateHitBonus = Number(state.fateHitBonus ?? 0) + 1;
    state.fateSpent = Number(state.fateSpent ?? 0) + 1;
    state.combatResult = null;

    await this.replaceMessageState(message, state);
  }

  static async _onNegateComplication(event, message) {
    event.preventDefault();
    event.stopPropagation();

    const card = event.currentTarget?.closest(".axiom-chat-card.roll-card");
    const detailsOpen = Boolean(card?.querySelector("details.breakdown")?.open);
    const state = this.normalizeState(message.getFlag("axiom", "roll") ?? {});
    if (state.complicationResolved) return;

    const actor = this._getActorForState(state);
    if (!await this._spendFate(actor)) return;

    state.detailsOpen = detailsOpen;
    state.complicationResolved = true;
    state.complicationResolution = "negated";
    state.fateSpent = Number(state.fateSpent ?? 0) + 1;

    await this.replaceMessageState(message, state);
  }

  static async _onAcceptComplication(event, message) {
    event.preventDefault();
    event.stopPropagation();

    const card = event.currentTarget?.closest(".axiom-chat-card.roll-card");
    const detailsOpen = Boolean(card?.querySelector("details.breakdown")?.open);
    const state = this.normalizeState(message.getFlag("axiom", "roll") ?? {});
    if (state.complicationResolved) return;

    const actor = this._getActorForState(state);
    if (!await this._gainFate(actor)) return;

    state.detailsOpen = detailsOpen;
    state.complicationResolved = true;
    state.complicationResolution = "accepted";

    await this.replaceMessageState(message, state);
  }

  static async _onCombatDefense(event, message, defenseType) {
    event.preventDefault();
    event.stopPropagation();

    const card = event.currentTarget?.closest(".axiom-chat-card.roll-card");
    const detailsOpen = Boolean(card?.querySelector("details.breakdown")?.open);
    const state = this.normalizeState(message.getFlag("axiom", "roll") ?? {});
    const response = await AxiomCombat.resolveAttackCardDefense(message, defenseType);
    if (!response) return;

    const nextState = this.normalizeState(message.getFlag("axiom", "roll") ?? state);
    nextState.detailsOpen = detailsOpen;
    nextState.combatOppositionCreated = true;
    await this.replaceMessageState(message, nextState, { refreshLinkedResults: false });
  }

  static async _onCombatUnopposed(event, message) {
    event.preventDefault();
    event.stopPropagation();

    await AxiomCombat.resolveAttackCardUnopposed(message);
    const state = this.normalizeState(message.getFlag("axiom", "roll") ?? {});
    state.combatOppositionCreated = true;
    await this.replaceMessageState(message, state);
  }

  static async _onAssignCombatOpponent(event, message) {
    event.preventDefault();
    event.stopPropagation();

    const opposed = await AxiomCombat.createOpposedTestFromTargets(message);
    if (!opposed) return;

    const state = this.normalizeState(message.getFlag("axiom", "roll") ?? {});
    state.combatOppositionCreated = true;
    await this.replaceMessageState(message, state);
  }

  static async _onApplyCombatWound(event, message) {
    event.preventDefault();
    event.stopPropagation();

    const card = event.currentTarget?.closest(".axiom-chat-card.roll-card");
    const detailsOpen = Boolean(card?.querySelector("details.breakdown")?.open);
    const state = this.normalizeState(message.getFlag("axiom", "roll") ?? {});
    if (!state.combatResult?.canApplyWound || state.combatResult?.woundApplied) return;

    const applied = await AxiomCombat.applyWound(state.combatResult);
    if (!applied) return;

    state.detailsOpen = detailsOpen;
    state.combatResult = {
      ...state.combatResult,
      woundApplied: true,
      appliedWound: {
        severity: applied.severity,
        slot: applied.slot,
        label: `AXIOM.Combat.Wounds.${applied.severity}`
      }
    };
    await this.replaceMessageState(message, state);
  }

  static async _showDiceRoll(roll, message) {
    if (!game.dice3d?.showForRoll) return;

    const whisper = Array.isArray(message?.whisper) && message.whisper.length ? message.whisper : null;
    const blind = Boolean(message?.blind);
    try {
      await game.dice3d.showForRoll(roll, game.user, true, whisper, blind);
    } catch (error) {
      console.warn("Axiom | Dice So Nice reroll display failed", error);
    }
  }

  static getComplicationText({ complication, resolution } = {}) {
    if (!complication) return "AXIOM.RollCard.NoComplication";
    if (resolution === "negated") return "AXIOM.RollCard.ComplicationNegated";
    if (resolution === "accepted") return "AXIOM.RollCard.ComplicationAccepted";
    return "AXIOM.RollCard.Complication";
  }

  static getComplicationCss({ complication, resolution } = {}) {
    if (!complication) return "";
    if (resolution === "negated") return "has-complication negated";
    if (resolution === "accepted") return "has-complication accepted";
    return "has-complication";
  }

  static _getActorForState(state) {
    if (!state.actorId) return null;
    return game.actors?.get(state.actorId) ?? null;
  }

  static async _spendFate(actor) {
    const tracker = actor?.system?.trackers?.fate;
    const current = Number(tracker?.current ?? 0);
    const min = Number(tracker?.min ?? 0);

    if (!actor || !tracker) {
      ui.notifications?.warn(game.i18n.localize("AXIOM.RollCard.NoActorForFate"));
      return false;
    }

    if (current <= min) {
      ui.notifications?.warn(game.i18n.format("AXIOM.RollCard.NotEnoughFate", { actor: actor.name ?? game.i18n.localize("AXIOM.RollCard.UnknownActor") }));
      return false;
    }

    await actor.update({ "system.trackers.fate.current": Math.max(min, current - 1) });
    return true;
  }

  static async _gainFate(actor) {
    const tracker = actor?.system?.trackers?.fate;
    const current = Number(tracker?.current ?? 0);
    const max = Number(tracker?.max ?? 3);

    if (!actor || !tracker) {
      ui.notifications?.warn(game.i18n.localize("AXIOM.RollCard.NoActorForFate"));
      return false;
    }

    if (current >= max) {
      ui.notifications?.info(game.i18n.format("AXIOM.RollCard.FateAlreadyFull", { actor: actor.name ?? game.i18n.localize("AXIOM.RollCard.UnknownActor") }));
      return true;
    }

    await actor.update({ "system.trackers.fate.current": Math.min(max, current + 1) });
    return true;
  }

  static async updateMessageState(message, changes = {}) {
    const state = this.normalizeState(message.getFlag("axiom", "roll") ?? {});
    await this.replaceMessageState(message, { ...state, ...changes });
  }

  static async replaceMessageState(message, state, { refreshLinkedResults = true } = {}) {
    const normalized = this.normalizeState(state);
    const content = await this.render(normalized);
    const updated = await message.update({
      content,
      flags: { axiom: { roll: normalized } }
    });
    if (refreshLinkedResults) await AxiomCombat.refreshLinkedCombatResultsForRollMessage(message);
    return updated;
  }

  static applyRollMode(messageData, rollMode) {
    const normalizedMode = this.normalizeRollMode(rollMode);

    if (typeof ChatMessage.applyMode === "function") {
      Object.assign(messageData, ChatMessage.applyMode(messageData, normalizedMode));
      return;
    }

    messageData.whisper = [];
    messageData.blind = false;

    switch (normalizedMode) {
      case "gm":
        messageData.whisper = ChatMessage.getWhisperRecipients("GM").map(user => user.id);
        break;
      case "blind":
        messageData.whisper = ChatMessage.getWhisperRecipients("GM").map(user => user.id);
        messageData.blind = true;
        break;
      case "self":
        messageData.whisper = [game.user.id];
        break;
      case "public":
      default:
        break;
    }
  }

  static normalizeRollMode(rollMode) {
    switch (rollMode) {
      case "gm":
      case "private":
      case "gmroll":
        return "gm";
      case "blind":
      case "blindroll":
        return "blind";
      case "self":
      case "selfroll":
        return "self";
      case "public":
      case "publicroll":
      default:
        return "public";
    }
  }

  static getTestTypeLabel(testType) {
    switch (testType) {
      case "attribute": return "AXIOM.RollCard.TestTypes.Attribute";
      case "weapon": return "AXIOM.RollCard.TestTypes.Weapon";
      case "timeframe": return "AXIOM.RollCard.TestTypes.Timeframe";
      case "skill":
      default: return "AXIOM.RollCard.TestTypes.Skill";
    }
  }
}
