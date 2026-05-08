import AxiomRoll from "../rolls/axiom-roll.mjs";

const { renderTemplate } = foundry.applications.handlebars;

export default class AxiomRollCard {
  static TEMPLATE = "systems/axiom/templates/chat/roll-card.hbs";

  static async create(result, { getTestTypeLabel } = {}) {
    const actor = result.actor;
    const item = result.item;
    const roll = result.roll;
    const state = this._stateFromResult(result, { getTestTypeLabel });
    const card = this._prepareCard(state);
    const content = await renderTemplate(this.TEMPLATE, { card });
    const speaker = ChatMessage.getSpeaker({ actor });

    const messageData = {
      speaker,
      content,
      rolls: [roll],
      cssClass: "axiom-roll-message",
      flags: {
        axiom: {
          roll: state
        }
      }
    };

    this.applyRollMode(messageData, result.rollMode);
    return ChatMessage.create(messageData);
  }

  static applyRollMode(messageData, rollMode) {
    messageData.whisper = [];
    messageData.blind = false;

    switch (this.normalizeRollMode(rollMode)) {
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
      case "gmroll": return "gm";
      case "blind":
      case "blindroll": return "blind";
      case "self":
      case "selfroll": return "self";
      case "public":
      case "publicroll":
      default: return "public";
    }
  }

  static activateListeners(html) {
    const root = html instanceof HTMLElement ? html : html?.[0];
    if (!root) return;

    root.querySelectorAll?.(".axiom-chat-card.roll-card").forEach(card => {
      card.querySelectorAll("[data-action='toggleCardModifier']").forEach(button => {
        button.addEventListener("click", this._onToggleModifier.bind(this));
      });

      card.querySelectorAll("[data-action='editCardRoll']").forEach(input => {
        input.addEventListener("change", this._onEditRoll.bind(this));
        input.addEventListener("keydown", event => {
          if (event.key === "Enter") event.currentTarget.blur();
        });
      });
    });
  }

  static async _onToggleModifier(event) {
    event.preventDefault();
    event.stopPropagation();

    const card = event.currentTarget.closest(".axiom-chat-card.roll-card");
    const message = this._getMessage(card);
    const modifierId = event.currentTarget.dataset.modifierId;
    if (!message || !modifierId) return;

    const state = foundry.utils.deepClone(message.getFlag("axiom", "roll") ?? {});
    const row = state.modifierRows?.find(row => row.id === modifierId);
    if (!row) return;

    row.active = row.active === false;
    await this._updateMessage(message, state);
  }

  static async _onEditRoll(event) {
    event.preventDefault();
    event.stopPropagation();

    const card = event.currentTarget.closest(".axiom-chat-card.roll-card");
    const message = this._getMessage(card);
    if (!message) return;

    const state = foundry.utils.deepClone(message.getFlag("axiom", "roll") ?? {});
    state.d100 = AxiomRoll.normalizeD100(event.currentTarget.value);
    await this._updateMessage(message, state);
  }

  static async _updateMessage(message, state) {
    const recalculated = AxiomRoll.recalculateState(state);
    const card = this._prepareCard(recalculated);
    const content = await renderTemplate(this.TEMPLATE, { card });

    await message.update({
      content,
      "flags.axiom.roll": recalculated
    });
  }

  static _getMessage(card) {
    const messageElement = card?.closest(".chat-message");
    const messageId = messageElement?.dataset?.messageId;
    return messageId ? game.messages?.get(messageId) : null;
  }

  static _stateFromResult(result, { getTestTypeLabel } = {}) {
    return AxiomRoll.recalculateState({
      actorId: result.actor?.id ?? "",
      actorName: result.actor?.name ?? game.i18n.localize("AXIOM.RollCard.UnknownActor"),
      itemId: result.item?.id ?? "",
      title: result.title,
      testType: result.testType,
      testTypeLabel: typeof getTestTypeLabel === "function" ? getTestTypeLabel(result.testType) : this._getTestTypeLabel(result.testType),
      d100: result.d100,
      basePool: result.basePool,
      modifierRows: foundry.utils.deepClone(result.modifierRows ?? []),
      showWeaponSummary: result.isWeaponRoll,
      location: game.i18n.localize("AXIOM.RollCard.Pending"),
      damage: game.i18n.localize("AXIOM.RollCard.Pending")
    });
  }

  static _prepareCard(state) {
    const recalculated = AxiomRoll.recalculateState(state);
    const modifierRows = (recalculated.modifierRows ?? []).map(row => {
      const active = row.active !== false;
      const label = this._localize(row.label);
      return {
        ...row,
        label,
        active,
        cssClass: active ? "active" : "inactive",
        toggleIcon: active ? "fa-solid fa-toggle-on" : "fa-solid fa-toggle-off",
        toggleLabel: active ? "AXIOM.RollCard.DisableModifier" : "AXIOM.RollCard.EnableModifier",
        valueDisplay: AxiomRoll.formatSigned(row.value),
        inactiveLabel: active ? "" : "AXIOM.RollCard.IgnoredModifier"
      };
    });

    return {
      ...recalculated,
      rollId: recalculated.rollId ?? foundry.utils.randomID(),
      testTypeLabel: recalculated.testTypeLabel ?? this._getTestTypeLabel(recalculated.testType),
      rollDisplay: AxiomRoll.formatD100(recalculated.d100),
      rollInputValue: recalculated.d100 === 100 ? 100 : recalculated.d100,
      successTarget: recalculated.successTarget,
      activeModifierTotalDisplay: AxiomRoll.formatSigned(recalculated.activeModifierTotal),
      hitsDisplay: recalculated.hitsDisplay,
      outcomeLabel: recalculated.outcomeLabel,
      outcomeTierLabel: recalculated.outcomeTierLabel,
      outcomeCss: recalculated.outcomeCss,
      complication: recalculated.complication,
      showWeaponSummary: Boolean(recalculated.showWeaponSummary),
      location: recalculated.location ?? game.i18n.localize("AXIOM.RollCard.Pending"),
      damage: recalculated.damage ?? game.i18n.localize("AXIOM.RollCard.Pending"),
      modifierRows,
      hasModifiers: modifierRows.length > 0,
      automaticResult: recalculated.automaticSuccess
        ? "AXIOM.RollCard.AutomaticSuccess"
        : recalculated.automaticFailure ? "AXIOM.RollCard.AutomaticFailure" : ""
    };
  }

  static _localize(value) {
    if (!value) return "";
    return game.i18n.has(value) ? game.i18n.localize(value) : value;
  }

  static _getTestTypeLabel(testType) {
    switch (testType) {
      case "attribute": return "AXIOM.RollCard.TestTypes.Attribute";
      case "weapon": return "AXIOM.RollCard.TestTypes.Weapon";
      case "skill":
      default: return "AXIOM.RollCard.TestTypes.Skill";
    }
  }
}
