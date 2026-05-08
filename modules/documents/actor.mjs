const { Actor } = foundry.documents;

export default class AxiomActor extends Actor {
  async _preCreate(data, options, user) {
    await super._preCreate(data, options, user);

    const model = CONFIG.Actor.dataModels?.[this.type];
    const defaultIcon = model?.DEFAULT_ICON;
    const defaultTokenIcon = model?.DEFAULT_TOKEN_ICON ?? defaultIcon;

    if (defaultIcon && (!data.img || data.img === "icons/svg/mystery-man.svg")) {
      this.updateSource({ img: defaultIcon });
    }

    const tokenUpdates = {};
    const tokenImage = foundry.utils.getProperty(data, "prototypeToken.texture.src")
      ?? foundry.utils.getProperty(this, "prototypeToken.texture.src");
    if (defaultTokenIcon && (!tokenImage || tokenImage === "icons/svg/mystery-man.svg")) {
      tokenUpdates["prototypeToken.texture.src"] = defaultTokenIcon;
    }

    const bar1 = foundry.utils.getProperty(data, "prototypeToken.bar1.attribute")
      ?? foundry.utils.getProperty(this, "prototypeToken.bar1.attribute");
    const bar2 = foundry.utils.getProperty(data, "prototypeToken.bar2.attribute")
      ?? foundry.utils.getProperty(this, "prototypeToken.bar2.attribute");
    if (!bar1) tokenUpdates["prototypeToken.bar1.attribute"] = "trackers.momentum";
    if (!bar2) tokenUpdates["prototypeToken.bar2.attribute"] = "trackers.actionPoints";

    if (!Object.hasOwn(tokenUpdates, "prototypeToken.displayBars")) {
      const displayBars = foundry.utils.getProperty(data, "prototypeToken.displayBars")
        ?? foundry.utils.getProperty(this, "prototypeToken.displayBars");
      if (!displayBars && globalThis.CONST?.TOKEN_DISPLAY_MODES) {
        tokenUpdates["prototypeToken.displayBars"] = CONST.TOKEN_DISPLAY_MODES.ALWAYS;
      }
    }

    if (Object.keys(tokenUpdates).length) this.updateSource(tokenUpdates);
  }

  prepareData() {
    super.prepareData();
  }



  getRollData() {
    const data = super.getRollData();
    const system = this.system?.toObject instanceof Function
      ? this.system.toObject(false)
      : foundry.utils.deepClone(this.system ?? {});

    return {
      ...data,
      ...system,
      system
    };
  }

  getInitiativeFormula() {
    return CONFIG.AXIOM?.initiative?.formula ?? "1d10 + @subAttributes.initiative";
  }

  async rollAxiomInitiative({ combat = null, token = null, updateTurn = true } = {}) {
    const encounter = combat ?? game.combat ?? await this._createAxiomCombatEncounter();
    if (!encounter) return null;

    const combatant = await this._getOrCreateAxiomCombatant(encounter, token);
    if (!combatant) return null;

    return encounter.rollInitiative(combatant.id, {
      formula: this.getInitiativeFormula(),
      updateTurn,
      messageOptions: {
        speaker: ChatMessage.getSpeaker({ actor: this, token: combatant.token }),
        flags: {
          axiom: { initiative: true }
        }
      }
    });
  }

  async _createAxiomCombatEncounter() {
    if (!canvas?.scene) {
      ui.notifications?.warn(game.i18n.localize("AXIOM.Combat.Initiative.NoSceneWarning"));
      return null;
    }

    return Combat.create({ scene: canvas.scene.id, active: true });
  }

  async _getOrCreateAxiomCombatant(combat, token = null) {
    const resolvedToken = token ?? this._getAxiomInitiativeToken();
    let combatant = this._findAxiomCombatant(combat, resolvedToken);
    if (combatant) return combatant;

    if (!resolvedToken) {
      ui.notifications?.warn(game.i18n.localize("AXIOM.Combat.Initiative.NoTokenWarning"));
      return null;
    }

    const created = await combat.createEmbeddedDocuments("Combatant", [{
      actorId: this.id,
      tokenId: resolvedToken.id,
      sceneId: resolvedToken.parent?.id ?? canvas.scene?.id,
      hidden: Boolean(resolvedToken.hidden)
    }]);

    return created[0] ?? null;
  }

  _findAxiomCombatant(combat, token = null) {
    if (!combat) return null;
    if (token) {
      const match = combat.combatants.find(combatant => combatant.tokenId === token.id && combatant.actor?.id === this.id);
      if (match) return match;
    }

    return combat.combatants.find(combatant => combatant.actor?.id === this.id) ?? null;
  }

  _getAxiomInitiativeToken() {
    const controlled = canvas?.tokens?.controlled?.find(token => token.actor?.id === this.id);
    if (controlled) return controlled.document;

    const active = this.getActiveTokens?.(true, true)?.[0];
    return active?.document ?? null;
  }

  /**
   * Keep Axiom statuses stack-aware while still using Foundry's native
   * status-effect creation path. The important part is that creating and
   * removing the embedded ActiveEffect goes through Actor#toggleStatusEffect,
   * because that creates the effect in the shape Token#drawEffects expects.
   */
  async toggleStatusEffect(statusId, { active, overlay = false } = {}) {
    const status = CONFIG.AXIOM?.statuses?.[statusId];
    if (!status) return super.toggleStatusEffect(statusId, { active, overlay });

    if (!status.numbered) {
      const result = await super.toggleStatusEffect(statusId, { active, overlay: status.overlay ?? overlay });
      await this._syncStatusValueFromEffect(statusId);
      await this._drawActiveTokenStatusIcons();
      return result;
    }

    const existing = this.getAxiomStatusEffect(statusId);

    // Foundry passes active=false when the caller explicitly wants the status
    // removed. For stackable conditions we treat that as clearing the stack.
    if (active === false) return this.clearStatus(statusId);

    // If active=true and the effect already exists, this is a forced-on call.
    // Do not toggle it off. Just report the existing effect.
    if (active === true && existing) {
      await this._drawActiveTokenStatusIcons();
      return existing;
    }

    return this.addStatus(statusId, 1);
  }

  getAxiomStatusEffect(statusId) {
    return this.effects.find(effect => this._effectHasStatus(effect, statusId));
  }

  getAxiomStatusValue(statusId) {
    const status = CONFIG.AXIOM?.statuses?.[statusId];
    if (!status) return 0;

    const effect = this.getAxiomStatusEffect(statusId);
    if (!effect) return 0;

    if (!status.numbered) return 1;
    return Number(foundry.utils.getProperty(effect, "flags.axiom.value") ?? foundry.utils.getProperty(effect, "system.condition.value") ?? 1);
  }

  async addStatus(statusId, value = 1) {
    if (!Number.isFinite(Number(value)) || Number(value) <= 0) return null;
    const status = CONFIG.AXIOM?.statuses?.[statusId];
    if (!status) return null;

    let effect = this.getAxiomStatusEffect(statusId);
    const wasCreated = !effect;

    await this._clearExclusiveStatusGroup(statusId, status);

    if (!effect) {
      const result = await super.toggleStatusEffect(statusId, { active: true, overlay: status.overlay ?? false });
      effect = result?.documentName === "ActiveEffect" ? result : this.getAxiomStatusEffect(statusId);
    }

    if (!effect) return null;

    const next = status.numbered
      ? this._clampStatusValue(status, wasCreated ? Number(value) : this.getAxiomStatusValue(statusId) + Number(value))
      : 1;

    await this._updateAxiomStatusEffect(effect, status, next);
    await this.update({ [`system.statuses.${statusId}`]: next }, { render: false });
    await this._drawActiveTokenStatusIcons();
    return effect;
  }

  async removeStatus(statusId, value = 1) {
    if (Number(value) <= 0) return null;
    const status = CONFIG.AXIOM?.statuses?.[statusId];
    if (!status) return null;

    const effect = this.getAxiomStatusEffect(statusId);
    if (!effect) {
      await this.update({ [`system.statuses.${statusId}`]: 0 }, { render: false });
      await this._drawActiveTokenStatusIcons();
      return null;
    }

    if (!status.numbered) return this.clearStatus(statusId);

    const next = Math.max(0, this.getAxiomStatusValue(statusId) - Number(value));
    if (next <= 0) return this.clearStatus(statusId);

    await this._updateAxiomStatusEffect(effect, status, next);
    await this.update({ [`system.statuses.${statusId}`]: next }, { render: false });
    await this._drawActiveTokenStatusIcons();
    return effect;
  }

  async clearStatus(statusId) {
    const status = CONFIG.AXIOM?.statuses?.[statusId];
    if (!status) return null;

    // Delete the matching ActiveEffect directly instead of routing the final
    // stack removal through Foundry's toggleStatusEffect. The Token HUD also
    // has native right-click delete handling, and using the native toggle here
    // can cause a second delete/update attempt if a default listener slips
    // through. Direct deletion is enough: the effect already has the proper
    // statuses Set and Token#drawEffects responds to the embedded document
    // change normally.
    const existing = this.getAxiomStatusEffect(statusId);
    if (existing) {
      try { await existing.delete(); }
      catch (error) {
        // Ignore stale embedded-document delete races. These can happen when
        // an older HUD listener already removed the same ActiveEffect.
        if (!String(error?.message ?? "").includes("does not exist")) throw error;
      }
    }

    // Clean up any legacy duplicates from earlier builds which may not have a
    // real statuses Set and therefore are invisible to Foundry's native status
    // pipeline.
    const legacy = this.getAxiomStatusEffect(statusId);
    if (legacy && legacy.id !== existing?.id) {
      try { await legacy.delete(); }
      catch (error) {
        if (!String(error?.message ?? "").includes("does not exist")) throw error;
      }
    }

    await this.update({ [`system.statuses.${statusId}`]: 0 }, { render: false });
    await this._drawActiveTokenStatusIcons();
    return null;
  }

  async setStatus(statusId, value) {
    const status = CONFIG.AXIOM?.statuses?.[statusId];
    if (!status) return null;

    const numericValue = Math.max(0, Number(value) || 0);
    if (numericValue <= 0) return this.clearStatus(statusId);

    if (!status.numbered) return this.addStatus(statusId, 1);

    let effect = this.getAxiomStatusEffect(statusId);
    if (!effect) {
      const result = await super.toggleStatusEffect(statusId, { active: true, overlay: false });
      effect = result?.documentName === "ActiveEffect" ? result : this.getAxiomStatusEffect(statusId);
    }

    if (!effect) return null;

    const next = this._clampStatusValue(status, numericValue);
    await this._updateAxiomStatusEffect(effect, status, next);
    await this.update({ [`system.statuses.${statusId}`]: next }, { render: false });
    await this._drawActiveTokenStatusIcons();
    return effect;
  }

  _clampStatusValue(status, value) {
    const max = status.max === null ? Number.POSITIVE_INFINITY : Number(status.max);
    return Math.min(max, Math.max(0, Number(value) || 0));
  }

  async _clearExclusiveStatusGroup(statusId, status) {
    if (!status?.group) return;

    const groupStatuses = Object.values(CONFIG.AXIOM?.statuses ?? {})
      .filter(other => other.group === status.group && other.id !== statusId);

    for (const other of groupStatuses) {
      if (!this.getAxiomStatusEffect(other.id) && !this.system.statuses?.[other.id]) continue;
      await this.clearStatus(other.id);
    }
  }

  async _updateAxiomStatusEffect(effect, status, value) {
    const update = {
      name: game.i18n.localize(status.label),
      description: game.i18n.localize(status.description),
      img: status.img,
      statuses: [status.id],
      "flags.axiom.status": true,
      "flags.axiom.id": status.id,
      "flags.axiom.category": status.category,
      "flags.axiom.value": status.numbered ? value : null,
      "flags.axiom.max": status.max,
      "flags.axiom.numbered": status.numbered,
      "system.condition.value": status.numbered ? value : null,
      "system.condition.numbered": status.numbered
    };

    await effect.update(update);
  }

  async _syncStatusValueFromEffect(statusId) {
    const status = CONFIG.AXIOM?.statuses?.[statusId];
    if (!status) return;
    await this.update({ [`system.statuses.${statusId}`]: this.getAxiomStatusValue(statusId) }, { render: false });
  }

  async _drawActiveTokenStatusIcons() {
    for (const token of this.getActiveTokens?.(false, true) ?? []) {
      await token.drawEffects?.();
    }
  }

  _refreshActiveTokenStatusIcons() {
    return this._drawActiveTokenStatusIcons();
  }

  _effectHasStatus(effect, statusId) {
    const statuses = effect.statuses instanceof Set
      ? Array.from(effect.statuses)
      : Array.from(effect.statuses ?? foundry.utils.getProperty(effect, "statuses") ?? []);

    return statuses.includes(statusId) || foundry.utils.getProperty(effect, "flags.axiom.id") === statusId;
  }
}
