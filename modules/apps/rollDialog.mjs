// systems/axiom/scripts/apps/rollDialog.mjs

import { rollAttributeTest } from "../dice/attribute-roll.mjs";
import { rollSkillCheck } from "../dice/skill-roll.mjs";
import { rollItemCheck } from "../dice/item-roll.mjs";
import {
  tallyTraitDice,
  evalFateDie,
  applyDifficulty,
  getSuccessTier,
  AxiomDieTrait,
  AxiomDieFate,
} from "../dice/dice.mjs";

// TODO
// redesign roll window to have the following categories:
// - Base pool. When extended it shows how the base dice pool is built
// - Modifiers. Lists all active modifiers (temporary, situational, etc). They can be toggled on/off. Also has + / - buttons. Have a dropdown menu to add common situational modifiers.
// - Difficulty. Select difficulty level from dropdown
// - Final pool. Shows final dice pool after modifiers
// - Roll button

const { DialogV2 } = foundry.applications.api;

export default class AxiomRollDialog extends DialogV2 {
  constructor(config = {}) {
    const { actor, type, label, ...opts } = config;

    // DialogV2 requires initial buttons
    super({
      ...opts,
      content: "<div></div>",
      buttons: [{ action: "roll", label: "Roll", default: true }],
    });

    this._initializing = true;
    this._previousExpandedBase = false;
    this._previousExpandedMods = false;

    this._justToggledBase = false;
    this._justToggledMods = false;
    this.actor = actor ?? null;
    this.type = type ?? "skill";
    this.label = label ?? game.i18n.localize("AXIOM.Roll");

    // State tracked for this roll
    this.rollState = {
      attributeKey: config.attributeKey ?? null,
      attributeValue: Number(config.attributeValue ?? 0),
      skillValue: Number(config.skillValue ?? 0),
      primaryValue: Number(config.primaryValue ?? 0),
      secondaryValue: Number(config.secondaryValue ?? 0),
      difficulty: Number(config.difficulty ?? 0),
      modifier: Number(config.modifier ?? 0),
      itemId: config.itemId ?? null,
      test: config.test ?? null,
      data: config.data ?? {},
      rollMode:
        config.rollMode ??
        game.settings.get("core", "rollMode") ??
        "publicroll",

      // REQUIRED NEW FIELDS
      appliedModifiers: [],
      commonModifiers: [
        { label: "Cover (-1)", value: -1 },
        { label: "Superior Position (+1)", value: 1 },
        { label: "Blind Fire (-3)", value: -3 },
      ],
      expandedBase: false,
      expandedMods: false,

      ap: config.ap ?? 0,
    };

    this.rollState.primaryKey = config.primaryKey ?? null;
    this.rollState.secondaryKey = config.secondaryKey ?? null;

    // Bind DOM handlers
    this._handleAttributeChange = this._handleAttributeChange.bind(this);
    this._handleDifficultyChange = this._handleDifficultyChange.bind(this);
    this._handleRollModeChange = this._handleRollModeChange.bind(this);
  }

  /* -------------------------------------------- */
  /*  DEFAULT OPTIONS                              */
  /* -------------------------------------------- */

  static DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    id: "axiom-roll-dialog",
    classes: [
      ...(super.DEFAULT_OPTIONS.classes ?? []),
      "axiom",
      "dialog",
      "dice-roll",
      "axiom-roll-dialog",
    ],
    window: {
      ...(super.DEFAULT_OPTIONS.window ?? {}),
      contentTag: "form",
      contentClasses: ["axiom-roll-form"],
    },
    position: { width: 300 },
    form: { ...(super.DEFAULT_OPTIONS.form ?? {}), closeOnSubmit: false },
    actions: {
      modMinus: AxiomRollDialog.#onModMinus,
      modPlus: AxiomRollDialog.#onModPlus,
      toggleBase: AxiomRollDialog.#onToggleBase,
      toggleMods: AxiomRollDialog.#onToggleMods,
      toggleMod: AxiomRollDialog.#onToggleSingleMod,
      addCommonMod: AxiomRollDialog.#onAddCommonMod,
      setAP: AxiomRollDialog.#onSetAP,
    },
  };

  static TEMPLATE = "systems/axiom/templates/apps/roll-dialog.hbs";

  get title() {
    return this._computeTitle();
  }

  _computeTitle() {
    const actor = this.actor;

    // Capitalize first letter of label
    const name = this.label.charAt(0).toUpperCase() + this.label.slice(1);

    // Always "<Name> Test"
    let title = `${name} Test`;

    // Optional actor name
    if (actor) title += `: ${actor.name}`;

    return title;
  }

  /* -------------------------------------------- */
  /*  BUTTON CONFIGURATION                         */
  /* -------------------------------------------- */

  _initializeApplicationOptions(options) {
    options = super._initializeApplicationOptions(options);
    options.buttons = {
      roll: {
        action: "roll",
        label: game.i18n.localize("AXIOM.Roll"),
        icon: "fa-solid fa-dice-d8",
        callback: this._onRoll.bind(this),
      },
    };
    return options;
  }

  /* -------------------------------------------- */
  /*  TEMPLATE LOADING                             */
  /* -------------------------------------------- */

  async _preFirstRender(context, options) {
    await foundry.applications.handlebars.getTemplate(
      this.constructor.TEMPLATE
    );
    await super._preFirstRender(context, options);
  }

  async _renderHTML(context) {
    return foundry.applications.handlebars.renderTemplate(
      this.constructor.TEMPLATE,
      context
    );
  }

  _replaceHTML(result, content) {
    content.innerHTML = result;
  }

  /* -------------------------------------------- */
  /*  AFTER RENDER: WIRE DOM LISTENERS             */
  /* -------------------------------------------- */

  async _onRender(context, options) {
    await super._onRender(context, options);

    const form = this.element.querySelector("form.window-content");
    if (!form) return;

    const attrSelect = form.querySelector('select[name="attribute"]');
    if (attrSelect) {
      attrSelect.removeEventListener("change", this._handleAttributeChange);
      attrSelect.addEventListener("change", this._handleAttributeChange);
    }

    const diffSelect = form.querySelector('select[name="difficulty"]');
    if (diffSelect) {
      diffSelect.removeEventListener("change", this._handleDifficultyChange);
      diffSelect.addEventListener("change", this._handleDifficultyChange);
    }

    const rmSelect = form.querySelector('select[name="rollMode"]');
    if (rmSelect) {
      rmSelect.removeEventListener("change", this._handleRollModeChange);
      rmSelect.addEventListener("change", this._handleRollModeChange);
    }

    const commonSelect = form.querySelector('select[name="addCommonMod"]');
    if (commonSelect) {
      commonSelect.removeEventListener("change", this._handleCommonModChange);
      commonSelect.addEventListener(
        "change",
        this._handleCommonModChange.bind(this)
      );
    }

    // Initialize expand/collapse visual state after render
    const baseSection = form.querySelector(
      '.axiom-section[data-section="base"]'
    );
    if (baseSection) {
      const state = this.rollState.expandedBase;

      const shouldAnimate =
        !this._initializing &&
        !this._justToggledBase &&
        state !== this._previousExpandedBase;

      this._animateSection(baseSection, state, !shouldAnimate);

      this._previousExpandedBase = state;
      this._justToggledBase = false; // clear cooldown
    }

    const modsSection = form.querySelector(
      '.axiom-section[data-section="mods"]'
    );
    if (modsSection) {
      const state = this.rollState.expandedMods;

      const shouldAnimate =
        !this._initializing &&
        !this._justToggledMods &&
        state !== this._previousExpandedMods;

      this._animateSection(modsSection, state, !shouldAnimate);

      this._previousExpandedMods = state;
      this._justToggledMods = false; // clear cooldown
    }

    this._initializing = false;
  }

  /* -------------------------------------------- */
  /*  CONTEXT FOR TEMPLATE                         */
  /* -------------------------------------------- */

  async _prepareContext(options) {
    const base = await super._prepareContext(options);
    const s = this.rollState;

    const attributes = CONFIG.AXIOM.attributes;
    let breakdown = [];

    if (this.type === "attribute-test") {
      const pk = s.primaryKey;
      const sk = s.secondaryKey;

      breakdown = [
        {
          label: attributes?.[pk] ?? pk ?? "Primary",
          value: s.primaryValue,
        },
        {
          label: attributes?.[sk] ?? sk ?? "Secondary",
          value: s.secondaryValue,
        },
      ];
    }

    if (this.type === "skill") {
      breakdown = [
        { label: attributes[s.attributeKey], value: s.attributeValue },
        { label: this.label, value: s.skillValue },
      ];
    }

    if (this.type === "item") {
      breakdown = [
        { label: attributes[s.attributeKey], value: s.attributeValue },
        { label: this.label, value: s.primaryValue },
      ];
    }

    // -------------------------------------------------------
    // AUTO-INJECT DAMAGE PENALTIES INTO appliedModifiers
    // -------------------------------------------------------
    if (this.actor) {
      const p = this.actor.system.penalty ?? {};
      const ignore = p.ignore ?? {};

      // Total raw penalties
      let rawHealth = Number(p.health) || 0;
      let rawStamina = Number(p.stamina) || 0;

      // Apply ignore rules
      rawHealth = Math.max(
        0,
        rawHealth - (ignore.health || 0) - (ignore.all || 0)
      );
      rawStamina = Math.max(
        0,
        rawStamina - (ignore.stamina || 0) - (ignore.all || 0)
      );

      const totalPenalty = rawHealth + rawStamina;

      // Look for existing penalty modifier
      let existing = s.appliedModifiers.find(
        (m) => m.id === "auto-damage-penalty"
      );

      if (totalPenalty > 0) {
        if (existing) {
          // Update value, preserve active state
          existing.value = -totalPenalty;
        } else {
          // Add new one (default active)
          s.appliedModifiers.push({
            id: "auto-damage-penalty",
            label: "Damage Penalty",
            value: -totalPenalty,
            active: true,
            autoPenalty: true,
          });
        }
      } else {
        // Remove if no longer needed
        s.appliedModifiers = s.appliedModifiers.filter(
          (m) => m.id !== "auto-damage-penalty"
        );
      }
    }

    // Compute totals
    const basePool = breakdown.reduce((t, e) => t + e.value, 0);

    const activeMods = s.appliedModifiers
      .filter((m) => m.active)
      .reduce((t, m) => t + m.value, 0);

    const manualMod = s.modifier;

    const finalPool = Math.max(0, basePool + activeMods + manualMod);

    return {
      ...base,
      type: this.type,
      label: this.label,

      // base section
      basePool,
      breakdown,
      expandedBase: s.expandedBase,

      // modifiers section
      activeModifierTotal: activeMods + manualMod,
      appliedModifiers: s.appliedModifiers,
      commonModifiers: s.commonModifiers,
      manualMod,
      expandedMods: s.expandedMods,

      // difficulty
      difficultyOptions: Object.values(CONFIG.AXIOM.difficulties).map((d) => ({
        value: d.value,
        label: `${d.label} (${d.value > 0 ? `+${d.value}` : d.value})`,
      })),

      difficulty: s.difficulty,

      rollMode: s.rollMode,
      rollModes: {
        publicroll: "Public Roll",
        gmroll: "Private GM Roll",
        blindroll: "Blind GM Roll",
        selfroll: "Self Roll",
      },

      // final display
      finalPool,
      ap: this.rollState.ap,
    };
  }

  /* -------------------------------------------- */
  /*  ROLL EXECUTION                               */
  /* -------------------------------------------- */

  async _evaluateRoll() {
    const actor = this.actor;
    const s = this.rollState;

    const data = {
      ...(s.data ?? {}),
      actorId: actor?.id ?? null,
      type: this.type,
      itemId: s.itemId ?? null,
      test: s.test ?? null,
    };

    // Pick roll type
    let roll;

    if (this.type === "attribute-test") {
      roll = await rollAttributeTest({
        primaryValue: s.primaryValue,
        secondaryValue: s.secondaryValue,
        modifier: this._getTotalModifier(),
        difficulty: 0,
        data,
      });
    } else if (this.type === "skill") {
      roll = await rollSkillCheck({
        attributeValue: s.attributeValue,
        skillValue: s.skillValue,
        modifier: this._getTotalModifier(),
        difficulty: 0,
        data,
      });
    } else if (this.type === "item") {
      roll = await rollItemCheck({
        attributeValue: s.attributeValue,
        skillValue: s.primaryValue, // <— item roll uses primary as "skillValue"
        modifier: this._getTotalModifier(),
        difficulty: 0,
        data,
      });
    }

    // Extract raw dice results
    let traits = [];
    let fate = null;

    for (const term of roll.terms) {
      if (term instanceof AxiomDieTrait) {
        traits = term.results.map((r) => r.result);
      }
      if (term instanceof AxiomDieFate) {
        fate = term.results[0]?.result ?? null;
      }
    }

    return { roll, traits, fate };
  }

  async _onRoll(event, button, dialog) {
    const actor = this.actor;
    const s = this.rollState;


    // ACTION POINT CHECK
    const apToSpend = this.rollState.ap ?? 0;

    if (apToSpend > 0) {
      const currentAP = Number(actor?.system?.trackers?.actionPoints?.value ?? 0);

      if (currentAP < apToSpend) {
        ui.notifications.warn(
          `Not enough Action Points. You have ${currentAP}.`
        );
        return; // DO NOT close dialog
      }

      // Deduct AP
      await actor.update({ "system.trackers.actionPoints.value": currentAP - apToSpend });
    }

    // DETERMINE BASE POOL BEFORE MODIFIERS
    let basePool = 0;

    if (this.type === "attribute-test") {
      basePool = s.primaryValue + s.secondaryValue;
    } else if (this.type === "skill") {
      basePool = s.attributeValue + s.skillValue;
    } else if (this.type === "item") {
      // item rolls use attribute + primaryValue (skillValue for items)
      basePool = s.attributeValue + s.primaryValue;
    }

    // SAFETY CHECK: MUST HAVE AT LEAST 1 DIE
    const totalModifier = this._getTotalModifier();
    const finalPool = basePool + totalModifier;

    if (finalPool <= 0) {
      ui.notifications.warn("You do not have enough dice.");
      this.close();
      return;
    }

    // BUILD ROLL METADATA
    const data = {
      ...(s.data ?? {}),
      actorId: actor?.id ?? null,
      type: this.type,
      itemId: s.itemId ?? null,
      test: s.test ?? null,
    };

    // EXECUTE THE ROLL BASED ON TYPE
    let roll;

    if (this.type === "attribute-test") {
      roll = await rollAttributeTest({
        primaryValue: s.primaryValue,
        secondaryValue: s.secondaryValue,
        modifier: this._getTotalModifier(),
        difficulty: 0,
        data,
      });
    } else if (this.type === "skill") {
      roll = await rollSkillCheck({
        attributeValue: s.attributeValue,
        skillValue: s.skillValue,
        modifier: this._getTotalModifier(),
        difficulty: 0,
        data,
      });
    } else if (this.type === "item") {
      roll = await rollItemCheck({
        attributeValue: s.attributeValue,
        skillValue: s.primaryValue, // item’s skill component
        modifier: this._getTotalModifier(),
        difficulty: 0,
        data,
      });
    }

    // EXTRACT TRAIT + FATE DIE RESULTS
    let traits = [];
    let fate = null;

    for (const term of roll.terms) {
      if (term instanceof AxiomDieTrait) {
        traits = term.results.map((r) => r.result);
      }
      if (term instanceof AxiomDieFate) {
        fate = term.results[0]?.result ?? null;
      }
    }

    // COMPUTE RESULT TIER
    const trait = tallyTraitDice(traits);
    const fateData = evalFateDie(fate);

    const rawNet = trait.hits + fateData.hitValue;

    // 👉 Use CONFIG.AXIOM.difficulties here
    const difficultyEntry = Object.values(CONFIG.AXIOM.difficulties).find(
      (d) => d.value === s.difficulty
    );

    const finalNet = applyDifficulty(rawNet, difficultyEntry?.value ?? 0);
    const tier = getSuccessTier(finalNet, fateData.flaw ? "flaw" : null);

    // Build breakdown for chat card
    let breakdown = [];
    const attributes = CONFIG.AXIOM.attributes;

    if (this.type === "attribute-test") {
      breakdown = [
        { label: attributes[s.primaryKey], value: s.primaryValue },
        { label: attributes[s.secondaryKey], value: s.secondaryValue },
      ];
    } else if (this.type === "skill") {
      breakdown = [
        { label: attributes[s.attributeKey], value: s.attributeValue },
        { label: this.label, value: s.skillValue },
      ];
    } else if (this.type === "item") {
      breakdown = [
        { label: attributes[s.attributeKey], value: s.attributeValue },
        { label: this.label, value: s.primaryValue },
      ];
    }

    // Build modifiers list for chat
    let chatModifiers = s.appliedModifiers
      .filter((m) => m.active)
      .map((m) => ({
        label: m.label,
        value: m.value,
      }));

    if (s.modifier !== 0) {
      chatModifiers.push({
        label: "Additional Modifier",
        value: s.modifier,
      });
    }

    const diffVal = difficultyEntry.value;
    const hitWord = Math.abs(diffVal) === 1 ? "Hit" : "Hits";

    const difficultyLabel = `${difficultyEntry.label} (${
      diffVal > 0 ? `+${diffVal}` : diffVal
    } ${hitWord})`;

    // -------------------------
    // CHAT CONTEXT FOR TEMPLATE
    // -------------------------

    const chatContext = {
      label: this.label,
      finalNet,
      tier,
      focus: fateData.focus,
      flaw: fateData.flaw,
      traitDice: traits,
      fateDie: fate,

      basePoolLabel: breakdown.map((b) => `${b.label} ${b.value}`).join(" + "),

      modifiers: chatModifiers.length ? chatModifiers : null,

      difficultyLabel,
    };

    // Render HBS with details
    const html = await foundry.applications.handlebars.renderTemplate(
      "systems/axiom/templates/chat/axiom-roll.hbs",
      chatContext
    );

    // PREPARE CHAT MESSAGE DATA
    let messageData = {
      speaker: ChatMessage.getSpeaker({ actor }),
      content: html,
      rolls: [roll],
      flags: {
        axiom: {
          actorId: actor?.id ?? null,
          label: this.label,
          difficulty: s.difficulty ?? 0,
          traitDice: traits,
          fateDie: fate,
          finalNet,
          focus: fateData.focus,
          flaw: fateData.flaw,
          tier,

          basePool: basePool,
          basePoolLabel: breakdown
            .map((b) => `${b.label} ${b.value}`)
            .join(" + "),

          modifiers: chatModifiers.length
            ? chatModifiers.map((m) => ({ ...m }))
            : [],

          // 🔁 Same difficultyLabel reused for flags
          difficultyLabel,
        },
      },
    };

    // APPLY FOUNDY ROLL MODE BEHAVIOR (PUBLIC, GM, BLIND, SELF)
    ChatMessage.applyRollMode(messageData, this.rollState.rollMode);

    // SEND MESSAGE
    await ChatMessage.create(messageData);

    this.close();
  }

  /* -------------------------------------------- */
  /*  ACTIONS                                     */
  /* -------------------------------------------- */

  static async #onModMinus(event) {
    event.preventDefault();
    this.rollState.modifier--;
    return this.render();
  }

  static async #onModPlus(event) {
    event.preventDefault();
    this.rollState.modifier++;
    return this.render();
  }

  static async #onToggleBase(event, target) {
    event.preventDefault();
    this.rollState.expandedBase = !this.rollState.expandedBase;

    this._justToggledBase = true;

    const section = target.closest('.axiom-section[data-section="base"]');
    if (section) this._animateSection(section, this.rollState.expandedBase);
  }

  static async #onToggleMods(event, target) {
    event.preventDefault();
    this.rollState.expandedMods = !this.rollState.expandedMods;

    this._justToggledMods = true;

    const section = target.closest('.axiom-section[data-section="mods"]');
    if (section) this._animateSection(section, this.rollState.expandedMods);
  }

  static async #onToggleSingleMod(event, target) {
    const id = target.dataset.id;
    const mod = this.rollState.appliedModifiers.find((m) => m.id === id);
    if (mod) mod.active = !mod.active;
    return this.render();
  }

  static async #onAddCommonMod(event, target) {
    const value = Number(target.value);
    if (!value) return;

    this.rollState.appliedModifiers.push({
      id: foundry.utils.randomID(),
      label: target.options[target.selectedIndex].text,
      value,
      active: true,
    });

    target.value = "";
    return this.render();
  }

  static async #onSetAP(event, target) {
    event.preventDefault();

    const value = Number(target.dataset.value);
    if (isNaN(value)) return;

    this.rollState.ap = value;

    return this.render();
  }

  /* -------------------------------------------- */
  /*  SELECT CHANGE HANDLERS                       */
  /* -------------------------------------------- */

  _handleAttributeChange(event) {
    const key = event.currentTarget.value;
    this.rollState.attributeKey = key;

    const attrs = this.actor?.system?.attributes ?? {};
    this.rollState.attributeValue = Number(attrs[key]?.value ?? 0);

    this.render();
  }

  _handleDifficultyChange(event) {
    const val = Number(event.currentTarget.value);
    this.rollState.difficulty = val;
    this.rollState.difficultyKey = Object.values(
      CONFIG.AXIOM.difficulties
    ).find((d) => d.value === val)?.key;

    this.render();
  }

  _handleRollModeChange(event) {
    this.rollState.rollMode = event.currentTarget.value;
    this.render();
  }

  _handleCommonModChange(event) {
    const select = event.currentTarget;
    const value = Number(select.value);

    if (!value) return; // blank selection

    const label = select.options[select.selectedIndex].text;

    this.rollState.appliedModifiers.push({
      id: foundry.utils.randomID(),
      label,
      value,
      active: true,
    });

    // reset dropdown
    select.value = "";

    this.render();
  }

  _getTotalModifier() {
    const s = this.rollState;

    const activeMods = s.appliedModifiers
      .filter((m) => m.active)
      .reduce((total, m) => total + m.value, 0);

    return activeMods + s.modifier; // manual modifier included
  }

  /**
   * Animate expand/collapse of a section body.
   * @param {HTMLElement} section   .axiom-section element
   * @param {boolean} expand        true = open, false = close
   */
  _animateSection(section, expand, skipAnimation = false) {
    const body = section.querySelector(".section-expand[data-expand-body]");
    if (!body) return;

    if (skipAnimation) {
      // Instantly apply the state with NO transition
      body.style.transition = "none";
      body.style.maxHeight = expand ? body.scrollHeight + "px" : "0px";
      body.style.opacity = expand ? "1" : "0";
      body.offsetHeight; // force reflow
      return;
    }

    // NORMAL ANIMATION FROM HERE ↓
    body.style.transition = "none";

    if (expand) {
      body.style.maxHeight = "0px";
      body.style.opacity = "0";
      body.style.display = "block";

      const fullHeight = body.scrollHeight;
      void body.offsetHeight;

      body.style.transition = "max-height 0.2s ease, opacity 0.2s ease";
      body.style.maxHeight = fullHeight + "px";
      body.style.opacity = "1";
    } else {
      const fullHeight = body.scrollHeight;
      body.style.maxHeight = fullHeight + "px";
      body.style.opacity = "1";

      void body.offsetHeight;

      body.style.transition = "max-height 0.2s ease, opacity 0.2s ease";
      body.style.maxHeight = "0px";
      body.style.opacity = "0";
    }
  }
}
