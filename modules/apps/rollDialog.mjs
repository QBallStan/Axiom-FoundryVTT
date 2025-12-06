// systems/axiom/scripts/apps/rollDialog.mjs

import { rollAttributeTest } from "../dice/attribute-roll.mjs";
import { rollSkillCheck } from "../dice/skill-roll.mjs";
import {
  tallyTraitDice,
  evalFateDie,
  applyDifficulty,
  getSuccessTier,
  AxiomDieFate,
  AxiomDieTrait,
} from "../dice/dice.mjs";

const { DialogV2 } = foundry.applications.api;

export default class AxiomRollDialog extends DialogV2 {
  constructor(config = {}) {
    const { actor, type, label, ...opts } = config;

    // DialogV2 requires some buttons up front
    super({
      ...opts,
      content: "<div></div>", // real body comes from _renderHTML
      buttons: [{ action: "roll", label: "Roll", default: true }],
    });

    this.actor = actor ?? null;
    this.type = type ?? "skill";
    this.label = label ?? game.i18n.localize("AXIOM.Roll") ?? "Roll";

    this.rollState = {
      attributeKey: config.attributeKey ?? null,
      attributeValue: Number(config.attributeValue ?? 0) || 0,
      skillValue: Number(config.skillValue ?? 0) || 0,
      primaryValue: Number(config.primaryValue ?? 0) || 0,
      secondaryValue: Number(config.secondaryValue ?? 0) || 0,
      difficulty: Number(config.difficulty ?? 0) || 0,
      modifier: Number(config.modifier ?? 0) || 0,
      itemId: config.itemId ?? null,
      test: config.test ?? null,
      data: config.data ?? {},
    };

    // Bind instance handlers for DOM events
    this._onAttributeSelectChange = this._onAttributeSelectChange.bind(this);
    this._onDifficultySelectChange = this._onDifficultySelectChange.bind(this);
  }

  /* -------------------------------------------- */
  /*  Default Options                             */
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
    position: {
      width: 400,
    },

    form: {
      ...(super.DEFAULT_OPTIONS.form ?? {}),
      closeOnSubmit: false,
    },

    // Only button-style actions live here; selects use explicit listeners
    actions: {
      modMinus: AxiomRollDialog.#onModMinus,
      modPlus: AxiomRollDialog.#onModPlus,
    },
  };

  static TEMPLATE = "systems/axiom/templates/apps/roll-dialog.hbs";

  /* -------------------------------------------- */
  /*  Initialize Application Options (buttons)    */
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
  /*  Template loading & rendering                */
  /* -------------------------------------------- */

  async _preFirstRender(context, options) {
    await foundry.applications.handlebars.getTemplate(
      this.constructor.TEMPLATE
    );
    await super._preFirstRender(context, options);
  }

  async _renderHTML(context, _options) {
    return foundry.applications.handlebars.renderTemplate(
      this.constructor.TEMPLATE,
      context
    );
  }

  _replaceHTML(result, content, _options) {
    content.innerHTML = result;
  }

  /* -------------------------------------------- */
  /*  Hook after render: attach DOM listeners     */
  /* -------------------------------------------- */

  async _onRender(context, options) {
    await super._onRender(context, options);

    const form = this.element.querySelector("form.window-content");
    if (!form) return;

    // Attribute select (skills/specs/items only)
    const attrSelect = form.querySelector('select[name="attribute"]');
    if (attrSelect) {
      attrSelect.removeEventListener("change", this._onAttributeSelectChange);
      attrSelect.addEventListener("change", this._onAttributeSelectChange);
    }

    // Difficulty select
    const diffSelect = form.querySelector('select[name="difficulty"]');
    if (diffSelect) {
      diffSelect.removeEventListener("change", this._onDifficultySelectChange);
      diffSelect.addEventListener("change", this._onDifficultySelectChange);
    }
  }

  /* -------------------------------------------- */
  /*  Title                                       */
  /* -------------------------------------------- */

  get title() {
    return this.label ?? super.title;
  }

  /* -------------------------------------------- */
  /*  Context                                      */
  /* -------------------------------------------- */

  async _prepareContext(options) {
    const base = await super._prepareContext(options);
    const actor = this.actor;
    const state = this.rollState;

    const config = CONFIG.AXIOM ?? {};
    const attributesConfig = config.attributes ?? {};

    const isAttributeTest = this.type === "attribute-test";

    let pool = 0;
    if (isAttributeTest) {
      pool = state.primaryValue + state.secondaryValue + state.modifier;
    } else {
      pool = state.attributeValue + state.skillValue + state.modifier;
    }

    pool = Math.max(0, pool);

    const difficultyOptions = [
      { value: 1, label: "Easy (+1)" },
      { value: 0, label: "Average (+0)" },
      { value: -1, label: "Hard (–1)" },
      { value: -2, label: "Very Hard (–2)" },
      { value: -3, label: "Extreme (–3)" },
      { value: -4, label: "Impossible (–4)" },
    ];

    return {
      ...base,
      actor,
      type: this.type,
      label: this.label,

      attributes: attributesConfig,
      selectedAttributeKey: state.attributeKey,
      isAttributeTest,

      difficultyOptions,
      difficulty: state.difficulty,
      modifier: state.modifier,

      pool,
    };
  }

  /* -------------------------------------------- */
  /*  Roll callback (Dialog button)               */
  /* -------------------------------------------- */

  async _onRoll(_event, _button, _dialog) {
    const actor = this.actor;
    const s = this.rollState;

    let roll;

    const data = {
      ...(s.data ?? {}),
      actorId: actor?.id ?? null,
      type: this.type,
      itemId: s.itemId ?? null,
      test: s.test ?? null,
    };

    if (this.type === "attribute-test") {
      roll = await rollAttributeTest({
        primaryValue: s.primaryValue,
        secondaryValue: s.secondaryValue,
        modifier: s.modifier,
        difficulty: 0,
        data,
      });
    } else {
      roll = await rollSkillCheck({
        attributeValue: s.attributeValue,
        skillValue: s.skillValue,
        modifier: s.modifier,
        difficulty: 0,
        data,
      });
    }

    let traitDiceResults = [];
    let fateDieResult = null;

    for (const term of roll.terms) {
      if (term instanceof AxiomDieTrait) {
        traitDiceResults = term.results.map((r) => r.result);
      }

      if (term instanceof AxiomDieFate) {
        fateDieResult = term.results[0]?.result ?? null;
      }
    }

    const trait = tallyTraitDice(traitDiceResults);
    const fate = evalFateDie(fateDieResult);

    // Correct hit math (negative allowed)
    const rawNet = trait.hits + fate.hitValue;
    const finalNet = applyDifficulty(rawNet, s.difficulty);

    // Correct tier logic: failure + flaw → Major Failure
    const fateTierFlag = fate.flaw ? "flaw" : null;
    const tier = getSuccessTier(finalNet, fateTierFlag);

    const html = await foundry.applications.handlebars.renderTemplate(
      "systems/axiom/templates/chat/axiom-roll.hbs",
      {
        label: this.label,
        finalNet,
        tier,
        focus: fate.focus,
        flaw: fate.flaw,
        traitDice: traitDiceResults,
        fateDie: fateDieResult,
      }
    );

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: html,
      rolls: [roll],
      sound: CONFIG.sounds.dice,
    });

    this.close();
  }

  /* -------------------------------------------- */
  /*  Actions for +/-                             */
  /* -------------------------------------------- */

  static async #onModMinus(event, target) {
    event?.preventDefault();
    this.rollState.modifier = (this.rollState.modifier ?? 0) - 1;
    return this.render();
  }

  static async #onModPlus(event, target) {
    event?.preventDefault();
    this.rollState.modifier = (this.rollState.modifier ?? 0) + 1;
    return this.render();
  }

  /* -------------------------------------------- */
  /*  DOM change handlers (attribute/difficulty)  */
  /* -------------------------------------------- */

  _onAttributeSelectChange(event) {
    const select = event.currentTarget;
    const key = select.value;

    this.rollState.attributeKey = key;

    const attrs = this.actor?.system?.attributes ?? {};
    const value = Number(attrs[key]?.value ?? 0) || 0;

    this.rollState.attributeValue = value;

    // Recompute pool
    this.render();
  }

  _onDifficultySelectChange(event) {
    const select = event.currentTarget;
    this.rollState.difficulty = Number(select.value) || 0;
    this.render();
  }
}
