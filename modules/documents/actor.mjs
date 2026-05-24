import { getStatusEffectChanges } from "../system/config-axiom.mjs";

const { Actor } = foundry.documents;

const STATUS_ADD_PROMISES = new Map();

export default class AxiomActor extends Actor {
  async _preCreate(data, options, user) {
    await super._preCreate(data, options, user);

    const model = CONFIG.Actor.dataModels?.[this.type];
    const defaultIcon = model?.DEFAULT_ICON;
    const defaultTokenIcon = model?.DEFAULT_TOKEN_ICON ?? defaultIcon;
    const tokenDispositions = globalThis.CONST?.TOKEN_DISPOSITIONS ?? {};
    const displayModes = globalThis.CONST?.TOKEN_DISPLAY_MODES ?? {};
    const defaultToken = game.settings.get("core", "prototypeTokenOverrides")?.[this.type] ?? {};

    if (defaultIcon && (!data.img || data.img === "icons/svg/mystery-man.svg")) {
      this.updateSource({ img: defaultIcon });
    }

    const tokenUpdates = {};
    const hasExplicit = path => foundry.utils.getProperty(data, `prototypeToken.${path}`) !== undefined;
    const getExisting = path => foundry.utils.getProperty(data, `prototypeToken.${path}`)
      ?? foundry.utils.getProperty(this, `prototypeToken.${path}`)
      ?? foundry.utils.getProperty(defaultToken, path);

    const tokenImage = getExisting("texture.src");
    if (defaultTokenIcon && (!tokenImage || tokenImage === "icons/svg/mystery-man.svg")) {
      tokenUpdates["prototypeToken.texture.src"] = defaultTokenIcon;
    }

    if (!hasExplicit("name")) tokenUpdates["prototypeToken.name"] = data.name ?? this.name;
    if (!hasExplicit("lockRotation")) tokenUpdates["prototypeToken.lockRotation"] = true;
    const bar1Attribute = getExisting("bar1.attribute");
    const bar2Attribute = getExisting("bar2.attribute");
    if (!hasExplicit("bar1.attribute") && (!bar1Attribute || (bar1Attribute === "trackers.momentum" && bar2Attribute === "trackers.actionPoints"))) {
      tokenUpdates["prototypeToken.bar1"] = { attribute: "trackers.actionPoints" };
    }
    if (!hasExplicit("bar2.attribute") && (!bar2Attribute || (bar1Attribute === "trackers.momentum" && bar2Attribute === "trackers.actionPoints"))) {
      tokenUpdates["prototypeToken.bar2"] = { attribute: "trackers.momentum" };
    }
    if (!hasExplicit("sight.enabled") && ["protagonist", "npc"].includes(this.type)) tokenUpdates["prototypeToken.sight.enabled"] = true;

    if (!hasExplicit("actorLink")) {
      tokenUpdates["prototypeToken.actorLink"] = this.type === "protagonist";
    }

    if (!hasExplicit("disposition")) {
      if (defaultToken.disposition !== undefined) tokenUpdates["prototypeToken.disposition"] = defaultToken.disposition;
      else if (this.type === "protagonist") tokenUpdates["prototypeToken.disposition"] = tokenDispositions.FRIENDLY ?? 1;
      else if (this.type === "npc") tokenUpdates["prototypeToken.disposition"] = tokenDispositions.HOSTILE ?? -1;
      else tokenUpdates["prototypeToken.disposition"] = tokenDispositions.NEUTRAL ?? 0;
    }

    if (!hasExplicit("displayName")) {
      tokenUpdates["prototypeToken.displayName"] = defaultToken.displayName ?? displayModes.OWNER_HOVER ?? displayModes.HOVER ?? 30;
    }

    if (!hasExplicit("displayBars")) {
      tokenUpdates["prototypeToken.displayBars"] = defaultToken.displayBars ?? displayModes.OWNER_HOVER ?? displayModes.HOVER ?? 30;
    }

    if (Object.keys(tokenUpdates).length) this.updateSource(tokenUpdates);
  }

  async _preUpdate(changed, options, user) {
    this.constructor._syncTrackerResourceBarValues(changed);
    return super._preUpdate(changed, options, user);
  }

  static _syncTrackerResourceBarValues(changed) {
    for (const tracker of ["fate", "actionPoints", "momentum"]) {
      const currentPath = `system.trackers.${tracker}.current`;
      const valuePath = `system.trackers.${tracker}.value`;
      const current = foundry.utils.getProperty(changed, currentPath);
      const value = foundry.utils.getProperty(changed, valuePath);

      if (current !== undefined && value === undefined) {
        foundry.utils.setProperty(changed, valuePath, current);
      } else if (value !== undefined && current === undefined) {
        foundry.utils.setProperty(changed, currentPath, value);
      }
    }
  }

  prepareData() {
    super.prepareData();

    // Derived sub-attributes are formulas, so native Active Effects applied earlier
    // can be overwritten by the calculation pass. Re-run only that calculation
    // after Foundry has finished applying actor and transferred item effects.
    this.system?.computeDerivedSubAttributes?.();
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
    return this.getAxiomStatusEffects(statusId)[0] ?? null;
  }

  getAxiomStatusEffects(statusId) {
    return Array.from(this.effects ?? []).filter(effect => this._effectHasStatus(effect, statusId));
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
    const lockKey = `${this.uuid ?? this.id ?? this.name}:${statusId}`;
    const existingPromise = STATUS_ADD_PROMISES.get(lockKey);
    if (existingPromise) return existingPromise;

    const promise = this._addStatusUnlocked(statusId, value).finally(() => {
      if (STATUS_ADD_PROMISES.get(lockKey) === promise) STATUS_ADD_PROMISES.delete(lockKey);
    });
    STATUS_ADD_PROMISES.set(lockKey, promise);
    return promise;
  }

  async _addStatusUnlocked(statusId, value = 1) {
    if (!Number.isFinite(Number(value)) || Number(value) <= 0) return null;
    const status = CONFIG.AXIOM?.statuses?.[statusId];
    if (!status) return null;

    await this._clearExclusiveStatusGroup(statusId, status);

    let effects = this.getAxiomStatusEffects(statusId);
    let effect = effects[0] ?? null;
    const wasCreated = !effect;

    if (effect && !status.numbered) {
      await this._dedupeAxiomStatusEffects(statusId, effect);
      await this.update({ [`system.statuses.${statusId}`]: 1 }, { render: false });
      await this._drawActiveTokenStatusIcons();
      return effect;
    }

    if (!effect) {
      const result = await super.toggleStatusEffect(statusId, { active: true, overlay: status.overlay ?? false });
      effect = result?.documentName === "ActiveEffect" ? result : this.getAxiomStatusEffect(statusId);
    }

    if (!effect) return null;

    const next = status.numbered
      ? this._clampStatusValue(status, wasCreated ? Number(value) : this.getAxiomStatusValue(statusId) + Number(value))
      : 1;

    await this._dedupeAxiomStatusEffects(statusId, effect);
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

    // Delete matching ActiveEffects directly instead of routing the final stack
    // removal through Foundry's toggleStatusEffect. Direct deletion avoids a
    // second toggle/update when native Token HUD listeners are also involved,
    // and it clears any duplicate effects left by older builds or async races.
    for (const effect of this.getAxiomStatusEffects(statusId)) {
      try { await effect.delete(); }
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

  async _dedupeAxiomStatusEffects(statusId, keep = null) {
    const effects = this.getAxiomStatusEffects(statusId);
    if (effects.length <= 1) return keep ?? effects[0] ?? null;

    const kept = keep && effects.includes(keep) ? keep : effects[0];
    for (const effect of effects) {
      if (effect.id === kept.id) continue;
      try { await effect.delete(); }
      catch (error) {
        if (!String(error?.message ?? "").includes("does not exist")) throw error;
      }
    }
    return kept;
  }

  async _updateAxiomStatusEffect(effect, status, value) {
    const update = {
      name: game.i18n.localize(status.label),
      description: game.i18n.localize(status.description),
      img: status.img,
      statuses: [status.id],
      changes: getStatusEffectChanges(status, value),
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
