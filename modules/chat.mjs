import AxiomRoll from "./dice/axiom-roll.mjs";
import {
  applyDifficulty,
  getSuccessTier,
  AxiomDieTrait,
  AxiomDieFate,
} from "./dice/dice.mjs";

export default class AxiomChat {
  static init() {
    Hooks.on("renderChatMessageHTML", (message, html) => {
      const card = html.querySelector(".axiom-chat-card");
      if (!card) return;

      const flags = message.flags?.axiom ?? {};

      /* -------------------------------------------- */
      /*  RENDER DICE                                  */
      /* -------------------------------------------- */
      const diceContainer = card.querySelector(".axiom-dice-container");
      if (diceContainer) AxiomChat.renderDice(diceContainer, flags);

      /* -------------------------------------------- */
      /*  HEADER TOGGLE                                */
      /* -------------------------------------------- */
      const header = card.querySelector("[data-action='toggle-details']");
      const wrapper = card.querySelector(".axiom-roll-details-wrapper");
      if (header && wrapper) {
        header.addEventListener("click", () => {
          const isOpen = wrapper.classList.contains("expanded");
          const icon = card.querySelector(".axiom-collapse-icon i");

          if (!isOpen) {
            wrapper.style.maxHeight = wrapper.scrollHeight + "px";
            wrapper.classList.add("expanded");
            if (icon) icon.classList.add("rotated");
          } else {
            wrapper.style.maxHeight = 0;
            wrapper.classList.remove("expanded");
            if (icon) icon.classList.remove("rotated");
          }
        });
      }

      /* -------------------------------------------- */
      /*  EDIT NET HITS                                */
      /* -------------------------------------------- */
      const editBtn = card.querySelector(".axiom-edit-toggle");
      if (editBtn) {
        editBtn.addEventListener("click", () => {
          const display = card.querySelector(".axiom-hit-display");
          const editor = card.querySelector(".axiom-hit-edit");

          if (display.style.display !== "none") {
            display.style.display = "none";
            editor.style.display = "";
            editor.querySelector("input").focus();
          } else {
            display.style.display = "";
            editor.style.display = "none";
          }
        });
      }

      const hitInput = card.querySelector(".axiom-hit-input");
      if (hitInput) {
        hitInput.addEventListener("change", async () => {
          const newVal = Number(hitInput.value);
          if (isNaN(newVal)) return;

          const display = card.querySelector(".axiom-hit-display");
          display.textContent = `${newVal} Hits`;

          await message.update({ "flags.axiom.finalNet": newVal });

          display.style.display = "";
          card.querySelector(".axiom-hit-edit").style.display = "none";
        });
      }

      /* -------------------------------------------- */
      /*  FOOTER BUTTONS                                */
      /* -------------------------------------------- */
      card
        .querySelectorAll("[data-action]:not([data-action='toggle-details'])")
        .forEach((btn) => {
          btn.addEventListener("click", (ev) => {
            ev.stopPropagation();
            AxiomChat._handleAction(btn.dataset.action, message, card);
          });
        });
    });
  }

  /* -------------------------------------------- */
  /*  RENDER DICE                                  */
  /* -------------------------------------------- */
  static renderDice(container, data) {
    container.innerHTML = "";

    const traits = data.traitDice ?? [];
    const fate = data.fateDie;

    // Trait dice
    for (const val of traits) {
      container.appendChild(
        this._makeDie({
          face: val,
          type: "trait",
          state: val >= 7 ? "hit" : "neutral",
        })
      );
    }

    // Fate die
    if (fate != null) {
      const sep = document.createElement("span");
      sep.classList.add("axiom-die-separator");
      sep.textContent = "|";
      container.appendChild(sep);

      container.appendChild(
        this._makeDie({
          face: fate,
          type: "fate",
          state: this._fateState(fate),
        })
      );
    }
  }

  static _makeDie({ face, type, state }) {
    const el = document.createElement("span");
    el.classList.add("axiom-die", type, state);

    const f = document.createElement("span");
    f.classList.add("face");
    f.textContent = face;
    el.appendChild(f);

    return el;
  }

  static _fateState(v) {
    if (v === 5) return "flaw";
    if (v === 6) return "focus";
    if (v >= 7) return "hit";
    return "miss";
  }

  /* -------------------------------------------- */
  /*  ACTION HANDLER                               */
  /* -------------------------------------------- */
  static _handleAction(action, message, card) {
    const flags = message.flags.axiom ?? {};

    switch (action) {
      case "edit":
        return this._editResult(message, flags, card);
      case "second-wind":
        return this._secondWind(message, flags);
      default:
        return;
    }
  }

  /* -------------------------------------------- */
  /*  SECOND WIND                                  */
  /* -------------------------------------------- */
  static async _secondWind(message, data) {
    /* Actor resolution */
    const speaker = message.speaker ?? {};
    let actor = null;

    if (speaker.scene && speaker.token) {
      const scene = game.scenes.get(speaker.scene);
      actor = scene?.tokens.get(speaker.token)?.actor ?? null;
    }
    if (!actor && speaker.actor) actor = game.actors.get(speaker.actor);
    if (!actor && data.actorId) actor = game.actors.get(data.actorId);

    if (!actor) {
      ui.notifications.warn("No actor linked to this roll.");
      return;
    }

    /* Focus check */
    const focusPath = "system.trackers.focus.value";
    const current = foundry.utils.getProperty(actor, focusPath) ?? 0;

    if (current < 1) {
      ui.notifications.warn("Not enough Focus.");
      return;
    }
    await actor.update({ [focusPath]: current - 1 });

    /* Determine rerolled dice */
    const oldTraits = data.traitDice ?? [];
    const rerollIdx = oldTraits
      .map((v, i) => (v < 7 ? i : null))
      .filter((i) => i !== null);

    const roll = AxiomRoll.create({
      traitDice: rerollIdx.length,
      includeFateDie: true,
      data: { actorId: actor.id },
    });

    await roll.evaluate();
    if (game.dice3d) game.dice3d.showForRoll(roll, game.user, true);

    /* Extract new results */
    let newTraitsRoll = [];
    let newFate = data.fateDie;

    for (const term of roll.terms) {
      if (term instanceof AxiomDieTrait)
        newTraitsRoll = term.results.map((r) => r.result);
      if (term instanceof AxiomDieFate)
        newFate = term.results[0].result;
    }

    const newTraits = [...oldTraits];
    rerollIdx.forEach((i, n) => (newTraits[i] = newTraitsRoll[n]));

    /* Compute final net result */
    const hits = newTraits.filter((v) => v >= 7).length;

    let fateVal = 0;
    if (newFate === 1) fateVal = -2;
    else if (newFate <= 4) fateVal = -1;
    else if (newFate === 7) fateVal = 1;
    else if (newFate === 8) fateVal = 2;

    const rawNet = hits + fateVal;
    const finalNet = applyDifficulty(rawNet, data.difficulty ?? 0);
    const newTier = getSuccessTier(finalNet, newFate === 5 ? "flaw" : null);

    /* Re-render chat card (details will collapse normally) */
    const html = await foundry.applications.handlebars.renderTemplate(
      "systems/axiom/templates/chat/axiom-roll.hbs",
      {
        label: data.label,
        finalNet,
        tier: newTier,
        focus: false,
        flaw: newFate === 5,
        traitDice: newTraits,
        fateDie: newFate,
        basePoolLabel: data.basePoolLabel,
        modifiers: data.modifiers?.length ? data.modifiers : null,
        difficultyLabel: data.difficultyLabel,
      }
    );

    await message.update({
      content: html,
      "flags.axiom.traitDice": newTraits,
      "flags.axiom.fateDie": newFate,
      "flags.axiom.finalNet": finalNet,
      "flags.axiom.tier": newTier,
    });

    ui.chat.updateMessage(message);
  }

  /* -------------------------------------------- */
  /*  EDIT INLINE RESULT                           */
  /* -------------------------------------------- */
  static async _editResult(message, data, card) {
    const display = card.querySelector(".axiom-hit-display");
    const editor = card.querySelector(".axiom-hit-edit");
    const input = editor.querySelector("input");

    display.style.display = "none";
    editor.style.display = "";
    input.focus();
    input.select();

    const commit = async () => {
      const val = Number(input.value);
      if (!isNaN(val)) {
        display.textContent = `${val} Hits`;
        await message.update({
          "flags.axiom.finalNet": val,
        });
      }

      display.style.display = "";
      editor.style.display = "none";
    };

    input.addEventListener("blur", commit, { once: true });
    input.addEventListener(
      "keydown",
      (ev) => {
        if (ev.key === "Enter") {
          ev.preventDefault();
          input.blur();
        }
      },
      { once: true }
    );
  }
}
