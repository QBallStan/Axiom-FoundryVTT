import AxiomRollDialog from "../apps/rollDialog.mjs";

const { api, sheets } = foundry.applications;

/**
 * Axiom Character sheet (ActorSheetV2 + Handlebars).
 */
export default class axiomCharacterSheet extends api.HandlebarsApplicationMixin(
  sheets.ActorSheetV2
) {
  /* -------------------------------------------- */
  /*  Default Options                             */
  /* -------------------------------------------- */

  static DEFAULT_OPTIONS = {
    classes: ["axiom", "actor", "character"],
    tag: "form",
    position: {
      width: 800,
      height: 900,
    },
    form: {
      submitOnChange: true,
      closeOnSubmit: false,
    },
    actor: {
      type: "character",
    },
    actions: {
      itemDelete: axiomCharacterSheet.#onItemDelete,
      itemEdit: axiomCharacterSheet.#onItemEdit,
      itemEquip: axiomCharacterSheet.#onItemEquip,
      healthIncrease: axiomCharacterSheet.#onHealthIncrease,
      healthDecrease: axiomCharacterSheet.#onHealthDecrease,
      staminaIncrease: axiomCharacterSheet.#onStaminaIncrease,
      staminaDecrease: axiomCharacterSheet.#onStaminaDecrease,
      skillInc: axiomCharacterSheet.#onSkillIncrease,
      skillDec: axiomCharacterSheet.#onSkillDecrease,
      rollAttributeTest: axiomCharacterSheet.#onAttributeTest,
      rollSkill: axiomCharacterSheet.#onSkillRoll,
      rollSpec: axiomCharacterSheet.#onSpecRoll,
      rollItem: axiomCharacterSheet.#onItemRoll,
    },
  };

  /* -------------------------------------------- */
  /*  Sheet Parts                                 */
  /* -------------------------------------------- */

  static PARTS = {
    // Sidebar column (portrait, trackers, mini-tabs header)
    sidebar: {
      id: "sidebar",
      template: "systems/axiom/templates/actor/sidebar.hbs",
    },

    // Main tabs header / container
    tabs: {
      id: "tabs",
      template: "systems/axiom/templates/actor/tabs.hbs",
    },

    // Sidebar mini-tabs (attribute tests / physical limits)
    "attribute-tests": {
      id: "attribute-tests",
      template: "systems/axiom/templates/actor/mini-tabs/attribute-tests.hbs",
    },
    "physical-limits": {
      id: "physical-limits",
      template: "systems/axiom/templates/actor/mini-tabs/physical-limits.hbs",
    },

    // Main tabs
    skills: {
      id: "skills",
      template: "systems/axiom/templates/actor/tabs/skills.hbs",
    },
    combat: {
      id: "combat",
      template: "systems/axiom/templates/actor/tabs/combat.hbs",
    },
    inventory: {
      id: "inventory",
      template: "systems/axiom/templates/actor/tabs/inventory.hbs",
    },
    details: {
      id: "details",
      template: "systems/axiom/templates/actor/tabs/details.hbs",
    },
  };

  /* -------------------------------------------- */
  /*  Tab Definitions                             */
  /* -------------------------------------------- */

  static TABS = {
    sheet: [
      {
        id: "skills",
        group: "sheet",
        label: "AXIOM.Skills",
        icon: "fas fa-graduation-cap",
      },
      {
        id: "combat",
        group: "sheet",
        label: "AXIOM.Combat",
        icon: "fas fa-fist-raised",
      },
      {
        id: "inventory",
        group: "sheet",
        label: "AXIOM.Inventory",
        icon: "fas fa-box-open",
      },
      {
        id: "details",
        group: "sheet",
        label: "AXIOM.Details",
        icon: "fas fa-info-circle",
      },
    ],
    sidebar: [
      {
        id: "attribute-tests",
        group: "sidebar",
        label: "AXIOM.AttributeTests",
      },
      {
        id: "physical-limits",
        group: "sidebar",
        label: "AXIOM.PhysicalLimits",
      },
    ],
  };

  /**
   * Default active tab for each group.
   */
  tabGroups = {
    sheet: "skills",
    sidebar: "attribute-tests",
  };

  /* -------------------------------------------- */
  /*  Basic getters                               */
  /* -------------------------------------------- */

  get title() {
    return this.document?.name ?? game.i18n.localize("AXIOM.Actor.Character");
  }

  /* -------------------------------------------- */
  /*  Render options                              */
  /* -------------------------------------------- */

  _configureRenderOptions(options) {
    super._configureRenderOptions(options);
    // If you ever want limited users to see fewer parts, do it here by
    // filtering options.parts.
  }

  /* -------------------------------------------- */
  /*  Context preparation                         */
  /* -------------------------------------------- */

  async _prepareContext(options) {
    const base = await super._prepareContext(options);
    const actor = base.document;
    const system = actor.system ?? {};

    const tabs = this._getTabs();

    return {
      actor,
      system,
      items: actor.items,
      owner: actor.isOwner,
      editable: base.editable,
      isGM: base.user.isGM,
      effects: actor.effects,
      config: CONFIG.AXIOM,

      // Tabs
      tabGroups: this.tabGroups,
      tabs,
    };
  }

  /**
   * Per-part context hook. Left very light for now.
   * You can extend this later if some parts need extra prep.
   */
  async _preparePartContext(partId, context) {
    const items = context.actor.items;

    switch (partId) {
      case "skills":
        context.skills = items.filter(
          (i) => i.type === "skill" && !i.system.isExpertise
        );
        context.expertise = items.filter(
          (i) => i.type === "skill" && i.system.isExpertise
        );
        break;

      case "combat":
        // Example: prepare derived combat values here.
        break;

      case "inventory":
        const skills = items.filter((i) => i.type === "skill");

        function computeDicePool(item) {
          const skillName = item.system.skill;
          if (!skillName) return null;

          const skill = skills.find((s) => s.name === skillName);
          if (!skill) return null;

          const attrKey = skill.system.attribute;
          const attrValue =
            context.actor.system.attributes[attrKey]?.value ?? 0;
          const skillLevel = skill.system.level?.value ?? 0;

          return attrValue + skillLevel;
        }

        // Group items & attach dice pools
        function mapWithPools(list) {
          return list.map((i) => {
            i.dicePool = computeDicePool(i);
            return i;
          });
        }

        context.inventory = {
          melee: mapWithPools(
            items.filter(
              (i) => i.type === "weapon" && i.system.category === "melee"
            )
          ),
          ranged: mapWithPools(
            items.filter(
              (i) => i.type === "weapon" && i.system.category === "ranged"
            )
          ),
          ammo: items.filter((i) => i.type === "ammunition"),
          armor: items.filter((i) => i.type === "armor"),
          equipment: items.filter((i) => i.type === "equipment"),
        };
        break;

      case "details":
        // Example: enrich any long text fields here.
        break;

      case "attribute-tests":
      case "physical-limits":
        // Sidebar mini-tabs can already use actor/system directly.
        break;
    }

    return context;
  }

  /* -------------------------------------------- */
  /*  Tabs helper                                 */
  /* -------------------------------------------- */

  /**
   * Build the tab data structure from the static TABS config,
   * marking which tab is currently active for each group.
   */
  _getTabs() {
    const tabs = {};

    for (const [groupId, config] of Object.entries(this.constructor.TABS)) {
      const group = {};
      for (const t of config) {
        const active = this.tabGroups[t.group] === t.id;
        group[t.id] = Object.assign(
          {
            active,
            cssClass: active ? "active" : "",
          },
          t
        );
      }
      tabs[groupId] = group;
    }

    return tabs;
  }

  /* -------------------------------------------- */
  /*  Action Event Handlers                       */
  /* -------------------------------------------- */

  /**
   * @this {axiomCharacterSheet}
   * @param {PointerEvent} event
   * @returns {Promise<void>}
   */
  static async #onItemDelete(event, target) {
    const item = this.#getEventItem(event, target);
    if (!item) return;
    await item.deleteDialog();
  }

  /**
   * Edit an embedded item sheet.
   * @this {axiomCharacterSheet}
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   */
  static async #onItemEdit(_event, target) {
    const item = this.#getEventItem(_event, target);
    if (!item) return;

    await item.sheet.render(true); // force: true
  }

  /**
   * Toggle an item's equipped state.
   * @this {axiomCharacterSheet}
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   */
  static async #onItemEquip(event, target) {
    const item = this.#getEventItem(event, target);
    if (!item) return;

    const newState = !item.system.isEquipped;

    // Update item
    await item.update({ "system.isEquipped": newState });

    // Force actor to recompute derived armor
    item.actor.prepareData();

    // Re-render sheet so sidebar updates
    item.actor.render();
  }

  /**
   * Increase Health by 1 (up to max)
   * @this {axiomCharacterSheet}
   */
  static async #onHealthIncrease(event) {
    const actor = this.actor;
    const current = actor.system.trackers.health.value;
    const max = actor.system.trackers.health.max;

    const newValue = Math.min(max, current + 1);
    return actor.update({ "system.trackers.health.value": newValue });
  }

  /**
   * Decrease Health by 1 (can go below 0)
   * @this {axiomCharacterSheet}
   */
  static async #onHealthDecrease(event) {
    const actor = this.actor;
    const current = actor.system.trackers.health.value;

    const newValue = current - 1; // health allowed below zero
    return actor.update({ "system.trackers.health.value": newValue });
  }

  /**
   * Increase Stamina by 1 (clamped 0..max)
   * @this {axiomCharacterSheet}
   */
  static async #onStaminaIncrease(event) {
    const actor = this.actor;
    const current = actor.system.trackers.stamina.value;
    const max = actor.system.trackers.stamina.max;

    const newValue = Math.min(max, current + 1);
    return actor.update({ "system.trackers.stamina.value": newValue });
  }

  /**
   * Decrease Stamina by 1 (min 0)
   * @this {axiomCharacterSheet}
   */
  static async #onStaminaDecrease(event) {
    const actor = this.actor;
    const current = actor.system.trackers.stamina.value;

    const newValue = Math.max(0, current - 1);
    return actor.update({ "system.trackers.stamina.value": newValue });
  }

  /**
   * Increase skill level
   * @this {axiomCharacterSheet}
   */
  static async #onSkillIncrease(event, target) {
    const row = target.closest(".skill-row, .expertise-row");
    if (!row) return;
    const itemId = row.dataset.itemId;
    const item = this.actor.items.get(itemId);

    if (!item) return;

    const cur = item.system.level.value ?? 0;
    const newVal = cur + 1;

    await item.update({ "system.level.value": newVal });
  }

  /**
   * Decrease skill level
   */
  static async #onSkillDecrease(event, target) {
    const row = target.closest(".skill-row, .expertise-row");
    if (!row) return;
    const itemId = row.dataset.itemId;
    const item = this.actor.items.get(itemId);

    if (!item) return;

    const cur = item.system.level.value ?? 0;
    const newVal = Math.max(0, cur - 1);

    await item.update({ "system.level.value": newVal });
  }

  /**
   * Get the Item document associated with an action event.
   * Mirrors CrucibleBaseActorSheet.#getEventItem.
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   * @returns {Item|null}
   */
  #getEventItem(_event, target) {
    const row = target.closest("[data-item-id]");
    const itemId = row?.dataset.itemId;
    if (!itemId) return null;
    return this.actor.items.get(itemId);
  }

  /**
   * Handle an Attribute Test roll (via Roll Dialog).
   * @this {axiomCharacterSheet}
   */
  static async #onAttributeTest(event, target) {
    const actor = this.actor;
    const test = target.dataset.test;

    const attrs = actor.system.attributes;

    // Keys for each test
    const map = {
      insight: { pk: "logic", sk: "instinct" },
      perception: { pk: "resolve", sk: "instinct" },
      memory: { pk: "resolve", sk: "logic" },
      composure: { pk: "charisma", sk: "resolve" },
      lifting: { pk: "strength", sk: "fortitude" },
    };

    if (!map[test]) return;

    const pk = map[test].pk;
    const sk = map[test].sk;

    const primaryValue = attrs[pk].value;
    const secondaryValue = attrs[sk].value;

    // Capitalized label for window title
    const label = test.charAt(0).toUpperCase() + test.slice(1);

    const dialog = new AxiomRollDialog({
      actor,
      type: "attribute-test",
      label, // "Insight", "Memory", etc.
      primaryKey: pk, // "logic"
      secondaryKey: sk, // "instinct"
      primaryValue,
      secondaryValue,
      difficulty: 0,
      modifier: 0,
      test,
      data: { actorId: actor.id, type: "attribute", test },
    });

    return dialog.render({ force: true });
  }

  /**
   * Handle a skill roll from the skill tab (opens Roll Dialog).
   * @this {axiomCharacterSheet}
   */
  static async #onSkillRoll(event, target) {
    event?.preventDefault();
    const actor = this.actor;

    const itemId = target.closest("[data-item-id]")?.dataset.itemId;
    if (!itemId) return;

    const skill = actor.items.get(itemId);
    if (!skill) return;

    const attributeKey = skill.system.attribute;
    const attributeValue = actor.system.attributes[attributeKey]?.value || 0;
    const skillValue = skill.system.level.value || 0;

    const dlg = new AxiomRollDialog({
      actor,
      type: "skill",
      label: `${skill.name}`,
      attributeKey,
      attributeValue,
      skillValue,
      difficulty: 0,
      modifier: 0,
      itemId,
      data: { actorId: actor.id, type: "skill", skillId: itemId },
    });

    return dlg.render({ force: true });
  }

  /**
   * Roll a specialization (same attribute, spec.level instead of skill.level).
   * Uses the Roll Dialog.
   * @this {axiomCharacterSheet}
   */
  static async #onSpecRoll(event, target) {
    const actor = this.actor;

    const row = target.closest(".spec-row");
    if (!row) return;

    const itemId = row.dataset.itemId;
    const specIndex = target.dataset.index;

    const item = actor.items.get(itemId);
    if (!item) return;

    const spec = item.system.spec?.[specIndex];
    if (!spec) return;

    const attributeKey = item.system.attribute;
    const attributeValue = actor.system.attributes[attributeKey]?.value ?? 0;
    const skillValue = spec.level?.value ?? 0;

    const labelName = spec.name ?? spec.label ?? item.name;

    const dialog = new AxiomRollDialog({
      actor,
      type: "spec",
      label: `Specialization: ${labelName}`,
      attributeKey,
      attributeValue,
      skillValue,
      difficulty: 0,
      modifier: 0,
      data: {
        actorId: actor.id,
        type: "spec",
        skillId: item.id,
        specIndex,
      },
    });

    return dialog.render({ force: true });
  }

  /**
   * Roll an item attack (melee or ranged) using the weapon's skill via Roll Dialog.
   * @this {axiomCharacterSheet}
   */
  static async #onItemRoll(event, target) {
    const actor = this.actor;
    const item = this.#getEventItem(event, target);
    if (!item) return;

    const skillName = item.system.skill;
    if (!skillName) {
      ui.notifications.warn(`${item.name} has no linked skill.`);
      return;
    }

    const skill = actor.items.find(
      (i) => i.type === "skill" && i.name === skillName
    );
    if (!skill) {
      ui.notifications.warn(`Skill "${skillName}" not found on actor.`);
      return;
    }

    const attributeKey = skill.system.attribute;
    const attrValue = actor.system.attributes[attributeKey]?.value ?? 0;
    const skillValue = skill.system.level?.value ?? 0;

    const dialog = new AxiomRollDialog({
      actor,
      type: "item",
      label: `Attack: ${item.name}`,
      attributeKey,
      attributeValue: attrValue,
      skillValue,
      difficulty: 0,
      modifier: 0,
      itemId: item.id,
      data: {
        actorId: actor.id,
        type: "weapon",
        itemId: item.id,
        skillId: skill.id,
      },
    });

    return dialog.render({ force: true });
  }

  /* -------------------------------------------- */
  /* Listeners (ActorSheetV2 uses _onRender)      */
  /* -------------------------------------------- */

  /** @override */
  async _onRender(context, options) {
    await super._onRender(context, options);

    const root = this.element;
    const trackers = this.actor.system.trackers;

    const buildTrackerIcons = (trackerKey) => {
      const container = root.querySelector(
        `.resource-icons[data-tracker="${trackerKey}"]`
      );
      if (!container) return;

      const t = trackers[trackerKey] ?? {};
      const value = Number(t.value ?? 0);
      const max = Number(t.max ?? 0);

      // Clear and rebuild icons
      container.innerHTML = "";

      for (let i = 0; i < max; i++) {
        const icon = document.createElement("i");
        icon.classList.add(
          "fa-solid",
          trackerKey === "focus" ? "fa-clover" : "fa-bolt-lightning"
        );

        if (i < value) icon.classList.add("active");
        else icon.classList.add("inactive");

        container.appendChild(icon);
      }

      // Block browser context menu on the whole row
      container.addEventListener("contextmenu", (evt) => evt.preventDefault());

      // Left click: decrease
      container.addEventListener("click", (evt) => {
        evt.preventDefault();
        this._adjustTracker(trackerKey, -1);
      });

      // Right click: increase
      container.addEventListener("mousedown", (evt) => {
        if (evt.button === 2) {
          evt.preventDefault();
          this._adjustTracker(trackerKey, +1);
        }
      });
    };

    buildTrackerIcons("focus");
    buildTrackerIcons("actionPoints");
  }

  _adjustTracker(trackerKey, delta) {
    const t = this.actor.system.trackers[trackerKey];
    if (!t) return;

    const max = Number(t.max ?? 0);
    const cur = Number(t.value ?? 0);

    // Focus & AP are 0..max
    const newValue = Math.max(0, Math.min(cur + delta, max));

    return this.actor.update({
      [`system.trackers.${trackerKey}.value`]: newValue,
    });
  }
}
