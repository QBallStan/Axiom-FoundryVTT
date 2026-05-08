import AxiomRoll from "../system/rolls/axiom-roll.mjs";
import AxiomChatCard from "../system/rolls/chat-card.mjs";
import AxiomCombat from "../system/combat.mjs";
import { getWeaponCategory, isMeleeWeaponItem, isRangedWeaponItem, isWeaponItem } from "../system/items.mjs";

const { ApplicationV2, DialogV2, HandlebarsApplicationMixin } = foundry.applications.api;
const { mergeObject } = foundry.utils;

const ATTRIBUTE_ORDER = [
  "strength",
  "agility",
  "fortitude",
  "logic",
  "resolve",
  "charisma",
  "instinct",
  "power"
];

const ROLL_MODES = [
  { key: "public", label: "AXIOM.Roll.PublicRoll" },
  { key: "gm", label: "AXIOM.Roll.PrivateGMRoll" },
  { key: "blind", label: "AXIOM.Roll.BlindGMRoll" },
  { key: "self", label: "AXIOM.Roll.SelfRoll" }
];

const TIMEFRAMES = [
  { key: "none", label: "AXIOM.Roll.Timeframes.None", formulaLabel: "", multiplier: 0, unit: "" },
  { key: "seconds", label: "AXIOM.Roll.Timeframes.Seconds", formulaLabel: "1d6 Seconds", multiplier: 1, unit: "AXIOM.Roll.TimeframeUnits.Seconds" },
  { key: "combatRounds", label: "AXIOM.Roll.Timeframes.CombatRounds", formulaLabel: "1d6 Combat Rounds", multiplier: 1, unit: "AXIOM.Roll.TimeframeUnits.CombatRounds" },
  { key: "tenSeconds", label: "AXIOM.Roll.Timeframes.TenSeconds", formulaLabel: "1d6 × 10 Seconds", multiplier: 10, unit: "AXIOM.Roll.TimeframeUnits.Seconds" },
  { key: "minutes", label: "AXIOM.Roll.Timeframes.Minutes", formulaLabel: "1d6 Minutes", multiplier: 1, unit: "AXIOM.Roll.TimeframeUnits.Minutes" },
  { key: "tenMinutes", label: "AXIOM.Roll.Timeframes.TenMinutes", formulaLabel: "1d6 × 10 Minutes", multiplier: 10, unit: "AXIOM.Roll.TimeframeUnits.Minutes" },
  { key: "hours", label: "AXIOM.Roll.Timeframes.Hours", formulaLabel: "1d6 Hours", multiplier: 1, unit: "AXIOM.Roll.TimeframeUnits.Hours" },
  { key: "fourHours", label: "AXIOM.Roll.Timeframes.FourHours", formulaLabel: "1d6 × 4 Hours", multiplier: 4, unit: "AXIOM.Roll.TimeframeUnits.Hours" },
  { key: "tenHours", label: "AXIOM.Roll.Timeframes.TenHours", formulaLabel: "1d6 × 10 Hours", multiplier: 10, unit: "AXIOM.Roll.TimeframeUnits.Hours" },
  { key: "days", label: "AXIOM.Roll.Timeframes.Days", formulaLabel: "1d6 Days", multiplier: 1, unit: "AXIOM.Roll.TimeframeUnits.Days" },
  { key: "weeks", label: "AXIOM.Roll.Timeframes.Weeks", formulaLabel: "1d6 Weeks", multiplier: 1, unit: "AXIOM.Roll.TimeframeUnits.Weeks" }
];

const DIFFICULTIES = [
  { key: "trivial", label: "AXIOM.Roll.Difficulties.Trivial", value: 40 },
  { key: "veryEasy", label: "AXIOM.Roll.Difficulties.VeryEasy", value: 30 },
  { key: "easy", label: "AXIOM.Roll.Difficulties.Easy", value: 20 },
  { key: "simple", label: "AXIOM.Roll.Difficulties.Simple", value: 10 },
  { key: "average", label: "AXIOM.Roll.Difficulties.Average", value: 0 },
  { key: "challenging", label: "AXIOM.Roll.Difficulties.Challenging", value: -10 },
  { key: "hard", label: "AXIOM.Roll.Difficulties.Hard", value: -20 },
  { key: "veryHard", label: "AXIOM.Roll.Difficulties.VeryHard", value: -30 },
  { key: "extreme", label: "AXIOM.Roll.Difficulties.Extreme", value: -40 }
];

const GENERAL_MODIFIERS = [
  { key: "takingCare", label: "AXIOM.Roll.PredefinedModifiers.TakingCare", value: 20 },
  { key: "clearConditions", label: "AXIOM.Roll.PredefinedModifiers.ClearConditions", value: 15 },
  { key: "helpfulTools", label: "AXIOM.Roll.PredefinedModifiers.HelpfulTools", value: 10 },
  { key: "minorAdvantage", label: "AXIOM.Roll.PredefinedModifiers.MinorAdvantage", value: 5 },
  { key: "noisyEnvironment", label: "AXIOM.Roll.PredefinedModifiers.NoisyEnvironment", value: -5 },
  { key: "poorVisibility", label: "AXIOM.Roll.PredefinedModifiers.PoorVisibility", value: -10 },
  { key: "seriousDistraction", label: "AXIOM.Roll.PredefinedModifiers.SeriousDistraction", value: -15 },
  { key: "rushing", label: "AXIOM.Roll.PredefinedModifiers.Rushing", value: -20 },
  { key: "goodVision", label: "AXIOM.Roll.PredefinedModifiers.GoodVision", value: 10 },
  { key: "darkness", label: "AXIOM.Roll.PredefinedModifiers.Darkness", value: -20 },
  { key: "badFooting", label: "AXIOM.Roll.PredefinedModifiers.BadFooting", value: -10 },
  { key: "poorTools", label: "AXIOM.Roll.PredefinedModifiers.PoorTools", value: -10 }
];

const WEAPON_MODIFIERS = [
  { key: "higherGround", label: "AXIOM.Roll.PredefinedModifiers.HigherGround", value: 5 },
  { key: "flanking", label: "AXIOM.Roll.PredefinedModifiers.Flanking", value: 10 },
  { key: "attackingFromBehind", label: "AXIOM.Roll.PredefinedModifiers.AttackingFromBehind", value: 15 },
  { key: "rangedBehind", label: "AXIOM.Roll.PredefinedModifiers.RangedBehind", value: 20 },
  { key: "charge", label: "AXIOM.Roll.PredefinedModifiers.Charge", value: 10 },
  { key: "proneTarget", label: "AXIOM.Roll.PredefinedModifiers.ProneTarget", value: 10 },
  { key: "attackerProne", label: "AXIOM.Roll.PredefinedModifiers.AttackerProne", value: -10 },
  { key: "pointBlank", label: "AXIOM.Roll.PredefinedModifiers.PointBlank", value: -20 },
  { key: "unstableShooting", label: "AXIOM.Roll.PredefinedModifiers.UnstableShooting", value: -10 },
  { key: "offHand", label: "AXIOM.Roll.PredefinedModifiers.OffHand", value: -20 },
  { key: "improvisedWeapon", label: "AXIOM.Roll.PredefinedModifiers.ImprovisedWeapon", value: -10 },
  { key: "sneakAttack", label: "AXIOM.Roll.PredefinedModifiers.SneakAttack", value: 20 }
];

const CALLED_SHOTS = [
  { key: "hands", label: "AXIOM.Roll.CalledShots.Hands", value: -20, effect: "AXIOM.Roll.CalledShotEffects.Hands" },
  { key: "headVitals", label: "AXIOM.Roll.CalledShots.HeadVitals", value: -20, effect: "AXIOM.Roll.CalledShotEffects.HeadVitals" },
  { key: "arms", label: "AXIOM.Roll.CalledShots.Arms", value: -10, effect: "AXIOM.Roll.CalledShotEffects.Arms" },
  { key: "legs", label: "AXIOM.Roll.CalledShots.Legs", value: -10, effect: "AXIOM.Roll.CalledShotEffects.Legs" },
  { key: "heldItem", label: "AXIOM.Roll.CalledShots.HeldItem", value: -20, effect: "AXIOM.Roll.CalledShotEffects.HeldItem" }
];

/**
 * Roll setup dialog. It gathers roll inputs, delegates d100 resolution to
 * AxiomRoll, then renders the result as a chat card.
 */
export default class AxiomRollWindow extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = mergeObject(super.DEFAULT_OPTIONS, {
    classes: ["axiom", "roll-window-app"],
    tag: "section",
    position: {
      width: 600,
      height: "auto"
    },
    window: {
      title: "AXIOM.Roll.WindowTitle",
      resizable: false
    }
  }, { inplace: false });

  static PARTS = {
    form: {
      template: "systems/axiom/templates/apps/roll-window.hbs"
    }
  };

  constructor(options = {}) {
    super(options);
    this.rollData = foundry.utils.deepClone(options.rollData ?? {});
    this._applyDefaultActionPointCost();
    this.poolEditorOpen = false;
    this._syncAutomaticModifiers();
  }

  get title() {
    const title = this.rollData.title ?? "AXIOM.Roll.WindowTitle";
    return game.i18n.has(title) ? game.i18n.localize(title) : title;
  }

  _applyDefaultActionPointCost() {
    if (this.rollData.actionPoints !== undefined && this.rollData.actionPoints !== null) return;
    this.rollData.actionPoints = this._getDefaultActionPointCost();
  }

  _getDefaultActionPointCost() {
    if (!this._actorIsInCombat()) return 0;

    const item = this.rollData.item;
    const testType = this.rollData.testType ?? "skill";
    const sourceType = this.rollData.sourceType ?? "";

    if (sourceType === "item" || testType === "item" || testType === "weapon") return 2;
    if (item && item.type !== "skill") return 2;
    if (testType === "skill" || item?.type === "skill") return 1;

    return 0;
  }

  _actorIsInCombat(actor = this.rollData.actor) {
    if (!actor || !game.combat) return false;

    for (const combatant of game.combat.combatants ?? []) {
      const combatantActor = combatant.actor ?? combatant.token?.actor;
      if (combatantActor?.id === actor.id || combatant.actorId === actor.id) return true;
    }

    return false;
  }

  _getActionPointTracker(actor = this.rollData.actor) {
    return actor?.system?.trackers?.actionPoints ?? null;
  }

  _getAvailableActionPoints(actor = this.rollData.actor) {
    const tracker = this._getActionPointTracker(actor);
    return Number(tracker?.current ?? 0);
  }

  _getMinimumActionPoints(actor = this.rollData.actor) {
    const tracker = this._getActionPointTracker(actor);
    return Number(tracker?.min ?? 0);
  }

  _getSelectedActionPointCost() {
    return Math.max(0, Number(this.rollData.actionPoints ?? 0));
  }

  _validateActionPointCost() {
    const actor = this.rollData.actor;
    const cost = this._getSelectedActionPointCost();
    if (!actor || cost <= 0) return true;

    const current = this._getAvailableActionPoints(actor);
    if (current >= cost) return true;

    ui.notifications?.warn(game.i18n.format("AXIOM.Roll.InsufficientActionPoints", {
      actor: actor.name ?? game.i18n.localize("AXIOM.RollCard.UnknownActor"),
      current,
      cost
    }));
    return false;
  }

  async _spendActionPoints() {
    const actor = this.rollData.actor;
    const cost = this._getSelectedActionPointCost();
    if (!actor || cost <= 0) return;

    const current = this._getAvailableActionPoints(actor);
    const min = this._getMinimumActionPoints(actor);
    await actor.update({ "system.trackers.actionPoints.current": Math.max(min, current - cost) });
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    this._syncAutomaticModifiers();
    const actor = this.rollData.actor;

    const attributeOne = this.rollData.attributeOne ?? "strength";
    const attributeTwo = this.rollData.attributeTwo ?? attributeOne;
    const skillValue = Number(this.rollData.skillValue ?? 30);
    const basePool = AxiomRoll.calculateBasePool(actor, attributeOne, attributeTwo, skillValue);
    const selectedTimeframe = this.rollData.timeframe ?? "none";
    const timeframeResult = this._getStoredTimeframeResult(selectedTimeframe);
    const selectedDifficulty = this.rollData.difficulty ?? "average";
    const difficulty = this._getDifficultyValue(selectedDifficulty);
    const modifiers = this._getModifierTotal();
    const successTarget = Math.min(120, Math.max(5, basePool + difficulty + modifiers));

    context.roll = {
      title: this.rollData.title ?? game.i18n.localize("AXIOM.Roll.SkillTest"),
      timeframes: TIMEFRAMES.map(timeframe => ({
        ...timeframe,
        selected: timeframe.key === selectedTimeframe
      })),
      hasTimeframe: selectedTimeframe !== "none",
      timeframeRolled: Boolean(timeframeResult),
      timeframeResultDisplay: timeframeResult?.display ?? "",
      difficulties: DIFFICULTIES.map(difficulty => ({
        ...difficulty,
        selected: difficulty.key === selectedDifficulty
      })),
      basePool,
      difficulty,
      difficultyDisplay: this._formatModifier(difficulty),
      modifiers,
      modifiersDisplay: this._formatModifier(modifiers),
      successTarget,
      attributeOneOptions: this._prepareAttributeOptions(actor, attributeOne),
      attributeTwoOptions: this._prepareAttributeOptions(actor, attributeTwo),
      skillValue,
      poolEditorOpen: this.poolEditorOpen,
      hasModifierRows: Boolean(this.rollData.modifierRows?.length),
      modifierRows: this.rollData.modifierRows ?? [],
      isWeaponRoll: this._isWeaponRoll(),
      rollModes: ROLL_MODES.map(mode => ({
        ...mode,
        selected: mode.key === (this.rollData.rollMode ?? "public")
      })),
      ap0: Number(this.rollData.actionPoints ?? 0) === 0,
      ap1: Number(this.rollData.actionPoints ?? 0) === 1,
      ap2: Number(this.rollData.actionPoints ?? 0) === 2,
      ap3: Number(this.rollData.actionPoints ?? 0) === 3
    };

    return context;
  }

  _onRender(context, options) {
    super._onRender(context, options);

    this.element.querySelector("[data-action='toggleBasePool']")?.addEventListener("click", this._onToggleBasePool.bind(this));
    this.element.querySelector("[data-action='rollD100']")?.addEventListener("click", this._onRollD100.bind(this));
    this.element.querySelector("[data-action='rollTimeframe']")?.addEventListener("click", this._onRollTimeframe.bind(this));
    this.element.querySelector("[data-action='addModifier']")?.addEventListener("click", this._onAddModifier.bind(this));
    this.element.querySelector("[data-action='addCalledShot']")?.addEventListener("click", this._onAddCalledShot.bind(this));

    this.element.querySelectorAll("[data-action='removeModifier']").forEach(element => {
      element.addEventListener("click", this._onRemoveModifier.bind(this));
    });

    this.element.querySelectorAll("[data-action='toggleModifierLock']").forEach(element => {
      element.addEventListener("click", this._onToggleModifierLock.bind(this));
    });

    this.element.querySelectorAll("[data-action='toggleConditionalEffect']").forEach(element => {
      element.addEventListener("change", this._onToggleConditionalEffect.bind(this));
    });

    this.element.querySelectorAll("[data-roll-field]").forEach(element => {
      element.addEventListener("change", this._onRollFieldChange.bind(this));
      element.addEventListener("input", this._onRollFieldInput.bind(this));
    });

    this.element.querySelectorAll("[data-modifier-value]").forEach(element => {
      element.addEventListener("change", this._onModifierValueChange.bind(this));
      element.addEventListener("input", this._onModifierValueInput.bind(this));
    });

    this._refreshPreview();

    this.element.querySelectorAll("[data-action='selectActionPoints']").forEach(element => {
      element.addEventListener("click", this._onSelectActionPoints.bind(this));
    });
  }


  async _onAddModifier(event) {
    event.preventDefault();
    event.stopPropagation();

    const onPromptClick = event => {
      const stepButton = event.target.closest?.("[data-action='modifierPromptStep']");
      const presetButton = event.target.closest?.("[data-action='selectPredefinedModifier']");
      if (!stepButton && !presetButton) return;

      event.preventDefault();
      const prompt = (stepButton ?? presetButton).closest(".modifier-prompt");
      const valueInput = prompt?.querySelector("[name='value']");
      const reasonInput = prompt?.querySelector("[name='reason']");
      if (!valueInput) return;

      if (stepButton) {
        const step = Number(stepButton.dataset.step ?? 0);
        const current = Number(valueInput.value || 0);
        valueInput.value = current + step;
      }

      if (presetButton) {
        valueInput.value = Number(presetButton.dataset.value ?? 0);
        if (reasonInput) reasonInput.value = presetButton.dataset.label ?? "";
      }

      valueInput.dispatchEvent(new Event("input", { bubbles: true }));
      valueInput.dispatchEvent(new Event("change", { bubbles: true }));
      reasonInput?.dispatchEvent(new Event("input", { bubbles: true }));
      reasonInput?.dispatchEvent(new Event("change", { bubbles: true }));
    };

    document.addEventListener("click", onPromptClick);

    let modifier;
    try {
      modifier = await DialogV2.prompt({
        window: { title: game.i18n.localize("AXIOM.Roll.ModifierPromptTitle") },
        classes: ["axiom", "modifier-dialog"],
        position: { width: 360, height: "auto" },
        modal: true,
        content: `
          <div class="axiom modifier-prompt">
            <div class="modifier-prompt-top">
              <div class="form-group modifier-value-group">
                <label>${game.i18n.localize("AXIOM.Roll.ModifierValue")}</label>
                <div class="modifier-stepper">
                  <button type="button" class="modifier-step" data-action="modifierPromptStep" data-step="-5" aria-label="${game.i18n.localize("AXIOM.Roll.DecreaseModifier")}">−</button>
                  <input name="value" type="number" step="5" value="0" autofocus required>
                  <button type="button" class="modifier-step" data-action="modifierPromptStep" data-step="5" aria-label="${game.i18n.localize("AXIOM.Roll.IncreaseModifier")}">+</button>
                </div>
              </div>
              <div class="form-group">
                <label>${game.i18n.localize("AXIOM.Roll.ModifierReason")}</label>
                <input name="reason" type="text" placeholder="${game.i18n.localize("AXIOM.Roll.ModifierReasonPlaceholder")}">
              </div>
            </div>
            <div class="predefined-modifiers">
              <label>${game.i18n.localize("AXIOM.Roll.CommonModifiers")}</label>
              <div class="predefined-modifier-grid">
                ${this._getPredefinedModifierButtonsHtml()}
              </div>
            </div>
          </div>
        `,
        ok: {
          label: game.i18n.localize("AXIOM.Roll.AddModifier"),
          callback: (event, button) => {
            const form = button.form;
            const value = Number(form.elements.value.value ?? 0);
            const reason = String(form.elements.reason.value ?? "").trim();
            return { value, reason };
          }
        },
        rejectClose: false
      });
    } catch {
      return;
    } finally {
      document.removeEventListener("click", onPromptClick);
    }

    if (!modifier) return;

    const value = Number(modifier.value);
    const reason = String(modifier.reason ?? "").trim();
    if (!Number.isFinite(value)) {
      ui.notifications?.warn(game.i18n.localize("AXIOM.Roll.ModifierInvalid"));
      return;
    }

    const rows = Array.isArray(this.rollData.modifierRows) ? [...this.rollData.modifierRows] : [];
    rows.push({
      id: foundry.utils.randomID(),
      label: reason || game.i18n.localize("AXIOM.Roll.ModifierSources.Custom"),
      value,
      automatic: false,
      locked: false
    });
    this.rollData.modifierRows = rows;

    this.render({ parts: ["form"] });
  }


  _isWeaponRoll() {
    const item = this.rollData.item;
    const testType = this.rollData.testType ?? "";
    const sourceType = this.rollData.sourceType ?? "";
    return isWeaponItem(item) || testType === "weapon" || sourceType === "weapon";
  }

  _getPredefinedModifiers() {
    return this._isWeaponRoll() ? WEAPON_MODIFIERS : GENERAL_MODIFIERS;
  }

  _getLocalizedText(key) {
    return game.i18n.has(key) ? game.i18n.localize(key) : key;
  }

  _getPredefinedModifierButtonsHtml() {
    const escape = foundry.utils.escapeHTML ?? (value => String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;"));

    return this._getPredefinedModifiers().map(modifier => {
      const label = game.i18n.localize(modifier.label);
      const value = Number(modifier.value ?? 0);
      const valueDisplay = this._formatModifier(value);

      return `
        <button type="button" class="predefined-modifier" data-action="selectPredefinedModifier" data-value="${value}" data-label="${escape(label)}">
          <span>${escape(label)}</span>
          <strong>${escape(valueDisplay)}</strong>
        </button>
      `;
    }).join("");
  }


  async _onAddCalledShot(event) {
    event.preventDefault();
    event.stopPropagation();

    if (!this._isWeaponRoll()) return;

    const escape = foundry.utils.escapeHTML ?? (value => String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;"));

    const findShot = key => CALLED_SHOTS.find(shot => shot.key === key) ?? CALLED_SHOTS[0];
    const buttons = CALLED_SHOTS.map(shot => `
      <button type="button" class="predefined-modifier called-shot-choice" data-action="selectCalledShot" data-key="${escape(shot.key)}">
        <span>${escape(game.i18n.localize(shot.label))}</span>
        <strong>${escape(this._formatModifier(shot.value))}</strong>
      </button>
    `).join("");

    const onPromptClick = event => {
      const button = event.target.closest?.("[data-action='selectCalledShot']");
      if (!button) return;

      event.preventDefault();
      const shot = findShot(button.dataset.key);
      const prompt = button.closest(".called-shot-prompt");
      const input = prompt?.querySelector("[name='calledShot']");
      const effect = prompt?.querySelector("[data-called-shot-effect]");
      const value = prompt?.querySelector("[data-called-shot-value]");
      const target = prompt?.querySelector("[data-called-shot-target]");

      if (input) input.value = shot.key;
      if (effect) effect.textContent = game.i18n.localize(shot.effect);
      if (value) value.textContent = this._formatModifier(shot.value);
      if (target) target.textContent = game.i18n.localize(shot.label);

      prompt?.querySelectorAll(".called-shot-choice").forEach(choice => {
        choice.classList.toggle("active", choice.dataset.key === shot.key);
      });
    };

    document.addEventListener("click", onPromptClick);

    let selection;
    try {
      selection = await DialogV2.prompt({
        window: { title: game.i18n.localize("AXIOM.Roll.CalledShotPromptTitle") },
        classes: ["axiom", "modifier-dialog", "called-shot-dialog"],
        position: { width: 380, height: "auto" },
        modal: true,
        content: `
          <div class="axiom modifier-prompt called-shot-prompt">
            <input type="hidden" name="calledShot" value="${escape(CALLED_SHOTS[0].key)}">
            <div class="modifier-prompt-top called-shot-summary">
              <div class="form-group modifier-value-group">
                <label>${game.i18n.localize("AXIOM.Roll.ModifierValue")}</label>
                <div class="called-shot-value" data-called-shot-value>${escape(this._formatModifier(CALLED_SHOTS[0].value))}</div>
              </div>
              <div class="form-group">
                <label>${game.i18n.localize("AXIOM.Roll.CalledShotTarget")}</label>
                <div class="called-shot-target" data-called-shot-target>${escape(game.i18n.localize(CALLED_SHOTS[0].label))}</div>
              </div>
            </div>
            <div class="predefined-modifiers called-shot-options">
              <label>${game.i18n.localize("AXIOM.Roll.CalledShotTarget")}</label>
              <div class="predefined-modifier-grid">${buttons}</div>
            </div>
            <p class="called-shot-effect" data-called-shot-effect>${game.i18n.localize(CALLED_SHOTS[0].effect)}</p>
          </div>
        `,
        ok: {
          label: game.i18n.localize("AXIOM.Roll.AddCalledShot"),
          callback: (event, button) => ({ key: button.form.elements.calledShot.value })
        },
        rejectClose: false
      });
    } catch {
      return;
    } finally {
      document.removeEventListener("click", onPromptClick);
    }

    const shot = findShot(selection?.key);
    if (!shot) return;

    const rows = Array.isArray(this.rollData.modifierRows) ? [...this.rollData.modifierRows] : [];
    rows.push({
      id: `called-shot-${foundry.utils.randomID()}`,
      label: game.i18n.format("AXIOM.Roll.CalledShotModifierLabel", { target: game.i18n.localize(shot.label) }),
      value: Number(shot.value ?? 0),
      automatic: false,
      locked: false,
      calledShot: {
        key: shot.key,
        label: shot.label,
        effect: shot.effect
      }
    });
    this.rollData.modifierRows = rows;

    this.render({ parts: ["form"] });
  }

  _onRemoveModifier(event) {
    event.preventDefault();
    event.stopPropagation();

    const id = event.currentTarget.dataset.modifierId;
    const index = Number(event.currentTarget.dataset.modifierIndex ?? -1);
    const rows = Array.isArray(this.rollData.modifierRows) ? [...this.rollData.modifierRows] : [];

    this.rollData.modifierRows = id
      ? rows.filter(row => row.id !== id)
      : rows.filter((row, rowIndex) => rowIndex !== index);

    this.render({ parts: ["form"] });
  }


  _onToggleModifierLock(event) {
    event.preventDefault();
    event.stopPropagation();

    const id = event.currentTarget.dataset.modifierId;
    if (!id) return;

    const rows = Array.isArray(this.rollData.modifierRows) ? [...this.rollData.modifierRows] : [];
    const row = rows.find(row => row.id === id);
    if (!row || !row.automatic) return;

    row.locked = !row.locked;
    if (row.locked) row.value = this._getAutomaticModifierValue(row.id);

    this.rollData.modifierRows = rows;
    this.render({ parts: ["form"] });
  }

  _onToggleConditionalEffect(event) {
    event.preventDefault();
    event.stopPropagation();

    const id = event.currentTarget.dataset.modifierId;
    const rows = Array.isArray(this.rollData.modifierRows) ? [...this.rollData.modifierRows] : [];
    const row = rows.find(row => row.id === id);
    if (!row?.conditional) return;

    row.active = event.currentTarget.checked;
    this.rollData.modifierRows = rows;
    this._refreshPreview();
  }

  _onToggleBasePool(event) {
    event.preventDefault();
    this.poolEditorOpen = !this.poolEditorOpen;
    this.render({ parts: ["form"] });
  }

  _onRollFieldInput(event) {
    this._updateRollField(event.currentTarget);
    this._refreshPreview();
    this._refreshTimeframeControl();
  }

  _onRollFieldChange(event) {
    this._updateRollField(event.currentTarget);
    this._refreshPreview();
    this._refreshTimeframeControl();
  }

  _updateRollField(element) {
    const field = element?.dataset?.rollField;
    if (!field) return;

    const value = element.type === "number"
      ? Number(element.value ?? 0)
      : element.value;

    const previous = this.rollData[field];
    this.rollData[field] = value;

    if (field === "timeframe" && previous !== value) this.rollData.timeframeResult = null;
  }

  _onModifierValueInput(event) {
    this._updateModifierRowsFromDom();
    this._refreshPreview();
  }

  _onModifierValueChange(event) {
    this._updateModifierRowsFromDom();
    this._refreshPreview();
  }

  _onSelectActionPoints(event) {
    event.preventDefault();
    const ap = Number(event.currentTarget.dataset.ap ?? 0);
    this.rollData.actionPoints = ap;

    this.element.querySelectorAll(".ap-button").forEach(button => button.classList.toggle("active", Number(button.dataset.ap ?? 0) === ap));
  }

  _updateModifierRowsFromDom() {
    const rows = this.rollData.modifierRows ?? [];
    this.element.querySelectorAll("[data-modifier-value]").forEach((input, index) => {
      const id = input.dataset.modifierId;
      const row = id ? rows.find(row => row.id === id) : rows[index];
      if (!row || row.locked) return;
      row.value = Number(input.value ?? 0);
    });
    this.rollData.modifierRows = rows;
  }

  _getCurrentPreview() {
    const actor = this.rollData.actor;
    const attributeOne = this.rollData.attributeOne ?? "strength";
    const attributeTwo = this.rollData.attributeTwo ?? attributeOne;
    const skillValue = Number(this.rollData.skillValue ?? 0);
    const basePool = AxiomRoll.calculateBasePool(actor, attributeOne, attributeTwo, skillValue);
    const difficulty = this._getDifficultyValue(this.rollData.difficulty ?? "average");
    const modifiers = this._getModifierTotal();
    const successTarget = Math.min(120, Math.max(5, basePool + difficulty + modifiers));

    return { basePool, difficulty, modifiers, successTarget };
  }

  _refreshPreview() {
    if (!this.element) return;

    const preview = this._getCurrentPreview();
    const setText = (key, value) => {
      const element = this.element.querySelector(`[data-preview='${key}']`);
      if (element) element.textContent = String(value);
    };

    setText("basePool", preview.basePool);
    setText("difficulty", preview.difficulty);
    setText("modifiers", this._formatModifier(preview.modifiers));
    setText("successTarget", preview.successTarget);
  }

  _refreshTimeframeControl() {
    if (!this.element) return;

    const key = this.rollData.timeframe ?? "none";
    const button = this.element.querySelector("[data-action='rollTimeframe']");
    if (!button) return;

    const result = this._getStoredTimeframeResult(key);
    const hasTimeframe = key !== "none";
    button.disabled = !hasTimeframe;
    button.classList.toggle("rolled", Boolean(result));
    button.title = result?.display ?? game.i18n.localize("AXIOM.Roll.RollTimeframe");
  }

  _getTimeframeDefinition(key = this.rollData.timeframe ?? "none") {
    return TIMEFRAMES.find(timeframe => timeframe.key === key) ?? TIMEFRAMES[0];
  }

  _getStoredTimeframeResult(key = this.rollData.timeframe ?? "none") {
    const result = this.rollData.timeframeResult;
    if (!result || result.key !== key || key === "none") return null;
    return result;
  }

  async _rollTimeframeResult(key = this.rollData.timeframe ?? "none") {
    const timeframe = this._getTimeframeDefinition(key);
    if (timeframe.key === "none") return null;

    const roll = await new Roll("1d6").evaluate();
    const die = Number(roll.total ?? 0);
    const multiplier = Number(timeframe.multiplier ?? 1);
    const total = die * multiplier;
    const unitLabel = game.i18n.localize(timeframe.unit);

    return {
      key: timeframe.key,
      label: timeframe.label,
      formulaLabel: timeframe.formulaLabel,
      multiplier,
      unit: timeframe.unit,
      die,
      total,
      display: `${total} ${unitLabel}`,
      roll
    };
  }

  async _onRollTimeframe(event) {
    event.preventDefault();
    event.stopPropagation();

    this.element.querySelectorAll("[data-roll-field]").forEach(element => this._updateRollField(element));
    const timeframeKey = this.rollData.timeframe ?? "none";

    if (timeframeKey === "none") {
      ui.notifications?.warn(game.i18n.localize("AXIOM.Roll.NoTimeframeSelected"));
      return;
    }

    const timeframeResult = await this._rollTimeframeResult(timeframeKey);
    if (!timeframeResult) return;

    this.rollData.timeframeResult = timeframeResult;
    this.rollData.rollMode = this.element.querySelector("[data-roll-field='rollMode']")?.value ?? this.rollData.rollMode ?? "public";

    await this._createTimeframeChatCard(timeframeResult);
    this.render({ parts: ["form"] });
  }

  async _onRollD100(event) {
    event.preventDefault();
    event.stopPropagation();

    this.element.querySelectorAll("[data-roll-field]").forEach(element => this._updateRollField(element));
    this._updateModifierRowsFromDom();

    const rollMode = this.element.querySelector("[data-roll-field='rollMode']")?.value ?? this.rollData.rollMode ?? "public";
    this.rollData.rollMode = rollMode;

    if (!this._validateActionPointCost()) return;
    if (!this._validateAmmunition()) return;
    const difficultyKey = this.rollData.difficulty ?? "average";
    const timeframeKey = this.rollData.timeframe ?? "none";
    let timeframeResult = this._getStoredTimeframeResult(timeframeKey);
    let timeframeRolledNow = false;
    if (!timeframeResult && timeframeKey !== "none") {
      timeframeResult = await this._rollTimeframeResult(timeframeKey);
      timeframeRolledNow = Boolean(timeframeResult);
      this.rollData.timeframeResult = timeframeResult;
    }

    const result = await AxiomRoll.test({
      actor: this.rollData.actor,
      item: this.rollData.item,
      title: this.rollData.testName ?? this.rollData.title ?? game.i18n.localize("AXIOM.Roll.SkillTest"),
      testType: this.rollData.testType ?? "skill",
      attributeOne: this.rollData.attributeOne ?? "strength",
      attributeTwo: this.rollData.attributeTwo ?? this.rollData.attributeOne ?? "strength",
      skillValue: Number(this.rollData.skillValue ?? 0),
      difficulty: this._getDifficultyValue(difficultyKey),
      modifiers: this._getModifierTotal(),
      rollMode
    });
    result.timeframe = timeframeResult;
    result.timeframeRolledNow = timeframeRolledNow;

    const message = await this._createChatCard(result);
    await this._spendAmmunition();
    await this._spendActionPoints();

    if (this.rollData.combatDefense) {
      await AxiomCombat.waitForDiceAnimation(message);
      await AxiomCombat.createCombatResultFromDefenseMessage(message);
    }

    this.close();
  }

  async _createChatCard(result) {
    const actor = result.actor;
    const item = result.item;
    const state = {
      rollId: foundry.utils.randomID(),
      actorId: actor?.id ?? "",
      actorName: actor?.name ?? game.i18n.localize("AXIOM.RollCard.UnknownActor"),
      itemId: item?.id ?? "",
      title: result.title,
      testType: result.testType,
      testTypeLabel: AxiomChatCard.getTestTypeLabel(result.testType),
      d100: result.d100,
      basePool: result.basePool,
      difficulty: result.difficulty,
      modifierRows: (this.rollData.modifierRows ?? []).map(row => ({
        id: row.id ?? foundry.utils.randomID(),
        label: row.label,
        value: Number(row.value ?? 0),
        active: row.active !== false,
        automatic: Boolean(row.automatic),
        locked: Boolean(row.locked),
        calledShot: row.calledShot ?? null
      })),
      isWeaponRoll: result.isWeaponRoll,
      isMeleeWeaponRoll: isMeleeWeaponItem(item),
      weaponInfo: isWeaponItem(item) ? {
        category: getWeaponCategory(item),
        damage: Number(item.system?.damage ?? 0),
        armorPenetration: Number(item.system?.armorPenetration ?? 0),
        damageModifier: isMeleeWeaponItem(item) ? Number(actor?.system?.subAttributes?.damageModifier ?? 0) : 0,
        delivery: item.system?.delivery ?? "",
        range: Number(item.system?.range ?? 0),
        ammo: Number(item.system?.ammo ?? 0),
        ammoContainer: Number(item.system?.ammoContainer ?? 0)
      } : null,
      combatTarget: result.isWeaponRoll ? AxiomCombat.getInitialCombatTargetData() : null,
      combatDefense: this.rollData.combatDefense ?? null,
      location: "",
      damage: "",
      timeframe: result.timeframe ? this._serializeTimeframeResult(result.timeframe) : null
    };

    return AxiomChatCard.createMessage(state, {
      roll: result.timeframeRolledNow && result.timeframe?.roll ? [result.roll, result.timeframe.roll] : result.roll,
      rollMode: result.rollMode,
      speaker: ChatMessage.getSpeaker({ actor })
    });
  }



  _isRangedWeaponRoll() {
    const item = this.rollData.item;
    return isRangedWeaponItem(item);
  }

  _validateAmmunition() {
    if (!this._isRangedWeaponRoll()) return true;

    const weapon = this.rollData.item;
    const maxAmmo = Number(weapon.system?.ammoContainer ?? 0);
    if (maxAmmo <= 0) return true;

    const currentAmmo = Number(weapon.system?.ammo ?? 0);
    if (currentAmmo > 0) return true;

    ui.notifications?.warn(game.i18n.format("AXIOM.Combat.OutOfAmmo", { weapon: weapon.name }));
    return false;
  }

  async _spendAmmunition() {
    if (!this._isRangedWeaponRoll()) return;

    const weapon = this.rollData.item;
    const maxAmmo = Number(weapon.system?.ammoContainer ?? 0);
    if (maxAmmo <= 0) return;

    const currentAmmo = Number(weapon.system?.ammo ?? 0);
    await weapon.update({ "system.ammo": Math.max(0, currentAmmo - 1) });
  }

  _serializeTimeframeResult(timeframeResult) {
    if (!timeframeResult) return null;
    return {
      key: timeframeResult.key,
      label: timeframeResult.label,
      formulaLabel: timeframeResult.formulaLabel,
      multiplier: Number(timeframeResult.multiplier ?? 1),
      unit: timeframeResult.unit,
      die: Number(timeframeResult.die ?? 0),
      total: Number(timeframeResult.total ?? 0),
      display: timeframeResult.display
    };
  }

  async _createTimeframeChatCard(timeframeResult) {
    const actor = this.rollData.actor;
    const state = {
      rollId: foundry.utils.randomID(),
      actorId: actor?.id ?? "",
      actorName: actor?.name ?? game.i18n.localize("AXIOM.RollCard.UnknownActor"),
      title: game.i18n.localize("AXIOM.RollCard.TimeframeTitle"),
      testType: "timeframe",
      testTypeLabel: AxiomChatCard.getTestTypeLabel("timeframe"),
      timeframeOnly: true,
      timeframe: this._serializeTimeframeResult(timeframeResult)
    };

    return AxiomChatCard.createMessage(state, {
      roll: timeframeResult.roll,
      rollMode: this.rollData.rollMode ?? "public",
      speaker: ChatMessage.getSpeaker({ actor })
    });
  }

  _getDifficultyValue(key) {
    return Number(DIFFICULTIES.find(difficulty => difficulty.key === key)?.value ?? 0);
  }

  _getModifierTotal() {
    this._syncAutomaticModifiers();
    return (this.rollData.modifierRows ?? []).reduce((sum, row) => {
      if (row.active === false) return sum;
      return sum + Number(row.value ?? 0);
    }, 0);
  }

  _syncAutomaticModifiers() {
    const rows = Array.isArray(this.rollData.modifierRows) ? [...this.rollData.modifierRows] : [];
    const automaticRows = this._getAutomaticModifierRows();

    const automaticIds = new Set(automaticRows.map(row => row.id));

    for (let index = rows.length - 1; index >= 0; index -= 1) {
      const row = rows[index];
      if (row?.automatic && String(row.id ?? "").startsWith("effect-") && !automaticIds.has(row.id)) rows.splice(index, 1);
    }

    for (const automaticRow of automaticRows) {
      const existing = rows.find(row => row.id === automaticRow.id);

      if (!existing) {
        if (automaticRow.value !== 0) rows.push(automaticRow);
        continue;
      }

      existing.automatic = true;
      existing.label = automaticRow.label;
      existing.locked = existing.locked !== false;

      if (existing.locked) existing.value = automaticRow.value;

      if (automaticRow.value === 0 && existing.locked) {
        const index = rows.indexOf(existing);
        if (index >= 0) rows.splice(index, 1);
      }
    }

    this.rollData.modifierRows = rows.map(row => ({
      ...row,
      value: Number(row.value ?? 0),
      active: row.active !== false,
      locked: Boolean(row.locked),
      automatic: Boolean(row.automatic),
      conditional: Boolean(row.conditional),
      lockIcon: row.locked ? "fa-solid fa-lock" : "fa-solid fa-lock-open",
      lockLabel: row.locked ? "AXIOM.Roll.UnlockModifier" : "AXIOM.Roll.LockModifier"
    }));
  }

  _getAutomaticModifierRows() {
    return [
      {
        id: "auto-wounds",
        label: "AXIOM.Roll.ModifierSources.WoundPenalty",
        value: this._getWoundPenalty(),
        automatic: true,
        locked: true
      },
      {
        id: "auto-momentum",
        label: "AXIOM.Roll.ModifierSources.Momentum",
        value: this._getMomentumModifier(),
        automatic: true,
        locked: true
      },
      {
        id: "auto-equipment",
        label: "AXIOM.Roll.ModifierSources.Equipment",
        value: this._getEquipmentModifier(),
        automatic: true,
        locked: true
      },
      {
        id: "auto-statuses",
        label: "AXIOM.Roll.ModifierSources.StatusPenalty",
        value: this._getStatusPenalty(),
        automatic: true,
        locked: true
      },
      ...this._getCombatAutomaticModifierRows(),
      ...this._getEffectModifierRows()
    ];
  }

  _getAutomaticModifierValue(id) {
    switch (id) {
      case "auto-wounds": return this._getWoundPenalty();
      case "auto-momentum": return this._getMomentumModifier();
      case "auto-equipment": return this._getEquipmentModifier();
      case "auto-statuses": return this._getStatusPenalty();
      case "auto-range": return this._getRangeModifierValue();
      case "auto-target-size": return this._getTargetSizeModifier();
      case "auto-cover": return AxiomCombat.getCoverBonus(this.rollData.actor);
      default:
        if (String(id ?? "").startsWith("effect-")) {
          return Number(this._getEffectModifierRows().find(row => row.id === id)?.value ?? 0);
        }
        return 0;
    }
  }


  _getEffectModifierRows() {
    const actor = this.rollData.actor;
    if (!actor) return [];

    return Array.from(actor.effects ?? [])
      .filter(effect => !effect.disabled)
      .filter(effect => !foundry.utils.getProperty(effect, "flags.axiom.status"))
      .flatMap(effect => this._getRowsForEffect(effect));
  }

  _getRowsForEffect(effect) {
    const rows = [];
    const conditional = Boolean(effect.getFlag?.("axiom", "conditional"));

    for (const change of effect.changes ?? []) {
      const value = this._getRollModifierFromEffectChange(change, { conditional });
      if (value === null || value === 0) continue;

      const safeKey = foundry.utils.hash?.(change.key) ?? change.key.replaceAll(/[^a-z0-9]/gi, "");
      const id = `effect-${effect.id}-${safeKey}`;
      const existing = (this.rollData.modifierRows ?? []).find(row => row.id === id);
      rows.push({
        id,
        label: effect.name ?? (conditional ? "AXIOM.Roll.ModifierSources.ConditionalEffect" : "AXIOM.Roll.ModifierSources.ActiveEffect"),
        value,
        active: conditional ? existing?.active === true : true,
        automatic: true,
        locked: true,
        conditional,
        effectId: effect.id
      });
    }
    return rows;
  }

  _getRollModifierFromEffectChange(change, { conditional = false } = {}) {
    const key = String(change?.key ?? "");
    const rawValue = Number(change?.value ?? 0);
    if (!key || !Number.isFinite(rawValue)) return null;

    const legacyModeTypes = {
      0: "custom",
      1: "multiply",
      2: "add",
      3: "downgrade",
      4: "upgrade",
      5: "override",
      custom: "custom",
      multiply: "multiply",
      add: "add",
      subtract: "subtract",
      downgrade: "downgrade",
      upgrade: "upgrade",
      override: "override"
    };
    const mode = legacyModeTypes[String(change?.type ?? change?.mode ?? "add").toLowerCase()] ?? "add";
    const isSubtract = mode === "subtract";
    const isAdd = mode === "add";
    if (!isAdd && !isSubtract) return null;

    const signedValue = isSubtract ? -rawValue : rawValue;

    // Persistent attribute effects are already included in the base pool by
    // Foundry's Active Effect application. Conditional attribute effects are
    // skipped by AxiomActiveEffect.apply() and can be opted into here.
    if (this._effectKeyMatchesCurrentAttributes(key)) return conditional ? signedValue : null;
    if (this._effectKeyMatchesCurrentSkill(key)) return signedValue;
    return null;
  }

  _effectKeyMatchesCurrentAttributes(key) {
    const attributeOne = this.rollData.attributeOne ?? "strength";
    const attributeTwo = this.rollData.attributeTwo ?? attributeOne;
    return [attributeOne, attributeTwo].some(attribute => [
      `system.attributes.${attribute}.mod`,
      `system.attributes.${attribute}.value`,
      `system.attributes.${attribute}.base`,
      `system.attributes.${attribute}.adv`
    ].includes(key));
  }

  _effectKeyMatchesCurrentSkill(key) {
    const skill = this.rollData.skillItem ?? (this.rollData.item?.type === "skill" ? this.rollData.item : null);
    if (!skill) return false;
    return key === `flags.axiom.skillModifiers.${skill.id}`;
  }

  _getWoundPenalty() {
    const wounds = this.rollData.actor?.system?.wounds;
    const storedPenalty = Number(wounds?.penalties?.total ?? NaN);
    if (Number.isFinite(storedPenalty)) return storedPenalty;

    const minor = Number(wounds?.minor?.current ?? Object.values(wounds?.minor?.slots ?? {}).filter(slot => slot?.taken).length ?? 0);
    const major = Number(wounds?.major?.current ?? Object.values(wounds?.major?.slots ?? {}).filter(slot => slot?.taken).length ?? 0);
    return (minor * -5) + (major * -10);
  }

  _getMomentumModifier() {
    const momentum = Number(this.rollData.actor?.system?.trackers?.momentum?.current ?? 0);
    return momentum * 5;
  }

  _getEquipmentModifier() {
    return Number(this.rollData.equipmentModifier ?? 0);
  }

  _getStatusPenalty() {
    return AxiomCombat.getStatusTestPenalty(this.rollData.actor);
  }

  _getCombatAutomaticModifierRows() {
    if (!this._isWeaponRoll()) return [];

    const rows = [];
    const range = this._getRangeModifier();
    if (range && range.modifier !== 0) {
      rows.push({
        id: "auto-range",
        label: range.label,
        value: range.modifier,
        automatic: true,
        locked: true
      });
    }

    const sizeModifier = this._getTargetSizeModifier();
    if (sizeModifier !== 0) {
      rows.push({
        id: "auto-target-size",
        label: "AXIOM.Combat.TargetSize",
        value: sizeModifier,
        automatic: true,
        locked: true
      });
    }

    return rows;
  }

  _getRangeModifier() {
    const target = Array.from(game.user?.targets ?? [])[0] ?? null;
    return AxiomCombat.getRangeModifier({
      attackerActor: this.rollData.actor,
      weapon: this.rollData.item,
      targetToken: target
    });
  }

  _getRangeModifierValue() {
    return Number(this._getRangeModifier()?.modifier ?? 0);
  }

  _getTargetSizeModifier() {
    if (!this._isWeaponRoll()) return 0;
    const target = Array.from(game.user?.targets ?? [])[0] ?? null;
    const size = Number(target?.actor?.system?.size ?? 0);
    return Number.isFinite(size) ? size * 5 : 0;
  }

  _getAttributeLabel(key) {
    return CONFIG.AXIOM?.attributes?.[key] ?? key;
  }

  _formatModifier(value) {
    return AxiomRoll.formatSigned(value);
  }

  _prepareAttributeOptions(actor, selectedKey) {
    return ATTRIBUTE_ORDER.map(key => ({
      key,
      label: this._getAttributeLabel(key),
      value: AxiomRoll.getAttributeValue(actor, key),
      selected: key === selectedKey
    }));
  }

}
