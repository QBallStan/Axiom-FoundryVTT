const { DialogV2 } = foundry.applications.api;

const ATTRIBUTE_TARGETS = [
  { id: "strength", label: "AXIOM.Attributes.Strength", key: "system.attributes.strength.mod" },
  { id: "agility", label: "AXIOM.Attributes.Agility", key: "system.attributes.agility.mod" },
  { id: "fortitude", label: "AXIOM.Attributes.Fortitude", key: "system.attributes.fortitude.mod" },
  { id: "logic", label: "AXIOM.Attributes.Logic", key: "system.attributes.logic.mod" },
  { id: "resolve", label: "AXIOM.Attributes.Resolve", key: "system.attributes.resolve.mod" },
  { id: "charisma", label: "AXIOM.Attributes.Charisma", key: "system.attributes.charisma.mod" },
  { id: "instinct", label: "AXIOM.Attributes.Instinct", key: "system.attributes.instinct.mod" },
  { id: "power", label: "AXIOM.Attributes.Power", key: "system.attributes.power.mod" }
];

const RESOURCE_TARGETS = [
  { id: "fateCurrent", label: "AXIOM.Actor.Effects.Builder.Targets.FateCurrent", key: "system.trackers.fate.current" },
  { id: "fateMax", label: "AXIOM.Actor.Effects.Builder.Targets.FateMax", key: "system.trackers.fate.max" },
  { id: "apCurrent", label: "AXIOM.Actor.Effects.Builder.Targets.ActionPointsCurrent", key: "system.trackers.actionPoints.current" },
  { id: "apMax", label: "AXIOM.Actor.Effects.Builder.Targets.ActionPointsMax", key: "system.trackers.actionPoints.max" },
  { id: "momentumCurrent", label: "AXIOM.Actor.Effects.Builder.Targets.MomentumCurrent", key: "system.trackers.momentum.current" },
  { id: "momentumMax", label: "AXIOM.Actor.Effects.Builder.Targets.MomentumMax", key: "system.trackers.momentum.max" },
  { id: "size", label: "AXIOM.Actor.Effects.Builder.Targets.Size", key: "system.size" }
];

const WOUND_TARGETS = [
  { id: "grazingMax", label: "AXIOM.Actor.Effects.Builder.Targets.GrazingWoundsMax", key: "system.wounds.grazing.max" },
  { id: "minorMax", label: "AXIOM.Actor.Effects.Builder.Targets.MinorWoundsMax", key: "system.wounds.minor.max" },
  { id: "majorMax", label: "AXIOM.Actor.Effects.Builder.Targets.MajorWoundsMax", key: "system.wounds.major.max" },
  { id: "criticalMax", label: "AXIOM.Actor.Effects.Builder.Targets.CriticalWoundsMax", key: "system.wounds.critical.max" },
  { id: "grazingCurrent", label: "AXIOM.Actor.Effects.Builder.Targets.GrazingWoundsCurrent", key: "system.wounds.grazing.current" },
  { id: "minorCurrent", label: "AXIOM.Actor.Effects.Builder.Targets.MinorWoundsCurrent", key: "system.wounds.minor.current" },
  { id: "majorCurrent", label: "AXIOM.Actor.Effects.Builder.Targets.MajorWoundsCurrent", key: "system.wounds.major.current" },
  { id: "criticalCurrent", label: "AXIOM.Actor.Effects.Builder.Targets.CriticalWoundsCurrent", key: "system.wounds.critical.current" }
];

const CHANGE_TYPES = Object.freeze({
  ADD: "add",
  MULTIPLY: "multiply",
  OVERRIDE: "override",
  UPGRADE: "upgrade",
  DOWNGRADE: "downgrade"
});

const CHANGE_TYPE_PRIORITIES = Object.freeze({
  add: 20,
  multiply: 10,
  override: 50,
  upgrade: 40,
  downgrade: 30
});

const CHANGE_MODES = [
  { id: "ADD", label: "AXIOM.Actor.Effects.Builder.Modes.Add", value: CHANGE_TYPES.ADD },
  { id: "MULTIPLY", label: "AXIOM.Actor.Effects.Builder.Modes.Multiply", value: CHANGE_TYPES.MULTIPLY },
  { id: "OVERRIDE", label: "AXIOM.Actor.Effects.Builder.Modes.Override", value: CHANGE_TYPES.OVERRIDE },
  { id: "UPGRADE", label: "AXIOM.Actor.Effects.Builder.Modes.Upgrade", value: CHANGE_TYPES.UPGRADE },
  { id: "DOWNGRADE", label: "AXIOM.Actor.Effects.Builder.Modes.Downgrade", value: CHANGE_TYPES.DOWNGRADE }
];

function localize(key) {
  return game.i18n.has(key) ? game.i18n.localize(key) : key;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getSkillTargets(actor) {
  return actor.items
    .filter(item => item.type === "skill")
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(item => ({
      id: item.id,
      label: item.name,
      key: `flags.axiom.skillModifiers.${item.id}`
    }));
}

function getTargets(actor, type) {
  if (type === "attribute") return ATTRIBUTE_TARGETS;
  if (type === "skill") return getSkillTargets(actor);
  if (type === "resource") return RESOURCE_TARGETS;
  if (type === "wound") return WOUND_TARGETS;
  return [{ id: "custom", label: "AXIOM.Actor.Effects.Builder.Targets.Custom", key: "" }];
}

function renderOptions(options) {
  return options.map(option => `
    <option value="${escapeHtml(option.id)}" data-key="${escapeHtml(option.key)}">${escapeHtml(localize(option.label))}</option>
  `).join("");
}

function findTarget(actor, type, id) {
  return getTargets(actor, type).find(target => target.id === id) ?? getTargets(actor, type)[0];
}

function modeLabel(modeValue) {
  const normalized = String(modeValue ?? CHANGE_TYPES.ADD);
  const mode = CHANGE_MODES.find(entry => entry.value === normalized || entry.id.toLowerCase() === normalized);
  return mode ? localize(mode.label) : localize("AXIOM.Actor.Effects.Builder.Modes.Add");
}

function formatSigned(value) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number)) return String(value ?? "");
  return number > 0 ? `+${number}` : String(number);
}

function buildDefaultName({ target, mode, value }) {
  const targetLabel = localize(target?.label ?? "");
  const modeText = modeLabel(mode);
  return `${targetLabel} ${modeText} ${formatSigned(value)}`.trim();
}

export default class AxiomEffectBuilder {
  static async prompt(actor) {
    if (!actor) return null;

    const targetTypeOptions = [
      { id: "attribute", label: "AXIOM.Actor.Effects.Builder.TargetTypes.Attribute" },
      { id: "skill", label: "AXIOM.Actor.Effects.Builder.TargetTypes.Skill" },
      { id: "resource", label: "AXIOM.Actor.Effects.Builder.TargetTypes.Resource" },
      { id: "wound", label: "AXIOM.Actor.Effects.Builder.TargetTypes.Wound" },
      { id: "custom", label: "AXIOM.Actor.Effects.Builder.TargetTypes.Custom" }
    ];

    const initialTargets = getTargets(actor, "attribute");
    const modeOptions = CHANGE_MODES.map(mode => `
      <option value="${escapeHtml(mode.value)}">${escapeHtml(localize(mode.label))}</option>
    `).join("");

    const onPromptChange = event => {
      const prompt = event.target.closest?.(".axiom-effect-builder");
      if (!prompt) return;

      const targetType = event.target.matches?.("[name='targetType']") ? event.target.value : prompt.querySelector("[name='targetType']")?.value ?? "attribute";
      const targetSelect = prompt.querySelector("[name='target']");
      const customKey = prompt.querySelector("[name='customKey']");
      const keyPreview = prompt.querySelector("[data-effect-key-preview]");

      if (event.target.matches?.("[name='targetType']") && targetSelect) {
        const targets = getTargets(actor, targetType);
        targetSelect.innerHTML = renderOptions(targets);
      }

      const selected = targetSelect?.selectedOptions?.[0];
      const key = targetType === "custom" ? customKey?.value ?? "" : selected?.dataset.key ?? "";
      if (customKey) customKey.closest(".form-group").hidden = targetType !== "custom";
      if (targetSelect) targetSelect.closest(".form-group").hidden = targetType === "custom";
      if (keyPreview) keyPreview.textContent = key || localize("AXIOM.Actor.Effects.Builder.NoKeySelected");
    };

    document.addEventListener("change", onPromptChange);
    document.addEventListener("input", onPromptChange);

    let result;
    try {
      result = await DialogV2.prompt({
        window: { title: localize("AXIOM.Actor.Effects.Builder.Title") },
        classes: ["axiom", "effect-builder-dialog"],
        position: { width: 430, height: "auto" },
        modal: true,
        content: `
          <div class="axiom-effect-builder">
            <div class="form-group">
              <label>${escapeHtml(localize("AXIOM.Actor.Effects.Builder.Name"))}</label>
              <input type="text" name="name" placeholder="${escapeHtml(localize("AXIOM.Actor.Effects.Builder.NamePlaceholder"))}">
            </div>

            <div class="form-group">
              <label>${escapeHtml(localize("AXIOM.Actor.Effects.Builder.Icon"))}</label>
              <input type="text" name="icon" value="icons/svg/aura.svg">
            </div>

            <div class="effect-builder-grid two-columns">
              <div class="form-group">
                <label>${escapeHtml(localize("AXIOM.Actor.Effects.Builder.TargetType"))}</label>
                <select name="targetType">
                  ${targetTypeOptions.map(type => `<option value="${escapeHtml(type.id)}">${escapeHtml(localize(type.label))}</option>`).join("")}
                </select>
              </div>
              <div class="form-group">
                <label>${escapeHtml(localize("AXIOM.Actor.Effects.Builder.Target"))}</label>
                <select name="target">${renderOptions(initialTargets)}</select>
              </div>
            </div>

            <div class="form-group" hidden>
              <label>${escapeHtml(localize("AXIOM.Actor.Effects.Builder.CustomKey"))}</label>
              <input type="text" name="customKey" placeholder="system.attributes.strength.mod">
            </div>

            <div class="effect-builder-grid two-columns">
              <div class="form-group">
                <label>${escapeHtml(localize("AXIOM.Actor.Effects.Builder.Mode"))}</label>
                <select name="mode">${modeOptions}</select>
              </div>
              <div class="form-group">
                <label>${escapeHtml(localize("AXIOM.Actor.Effects.Builder.Value"))}</label>
                <input type="number" name="value" step="1" value="0" required>
              </div>
            </div>

            <div class="effect-builder-grid two-columns">
              <div class="form-group">
                <label>${escapeHtml(localize("AXIOM.Actor.Effects.Builder.DurationType"))}</label>
                <select name="durationType">
                  <option value="passive">${escapeHtml(localize("AXIOM.Actor.Effects.Builder.DurationPassive"))}</option>
                  <option value="rounds">${escapeHtml(localize("AXIOM.Actor.Effects.Builder.DurationRounds"))}</option>
                  <option value="seconds">${escapeHtml(localize("AXIOM.Actor.Effects.Builder.DurationSeconds"))}</option>
                </select>
              </div>
              <div class="form-group">
                <label>${escapeHtml(localize("AXIOM.Actor.Effects.Builder.DurationValue"))}</label>
                <input type="number" name="durationValue" step="1" min="0" value="0">
              </div>
            </div>

            <div class="effect-builder-checkboxes">
              <label class="effect-builder-checkbox">
                <input type="checkbox" name="disabled">
                <span>${escapeHtml(localize("AXIOM.Actor.Effects.Builder.StartDisabled"))}</span>
              </label>
              <label class="effect-builder-checkbox">
                <input type="checkbox" name="conditional">
                <span>${escapeHtml(localize("AXIOM.Actor.Effects.Builder.Conditional"))}</span>
              </label>
            </div>
            <p class="effect-builder-hint">${escapeHtml(localize("AXIOM.Actor.Effects.Builder.ConditionalHint"))}</p>

            <div class="effect-key-preview">
              <span>${escapeHtml(localize("AXIOM.Actor.Effects.Builder.KeyPreview"))}</span>
              <code data-effect-key-preview>${escapeHtml(initialTargets[0]?.key ?? "")}</code>
            </div>
          </div>
        `,
        ok: {
          label: localize("AXIOM.Actor.Effects.Builder.Create"),
          callback: (event, button) => {
            const form = button.form;
            const targetType = form.elements.targetType.value;
            const targetId = form.elements.target?.value ?? "custom";
            const target = findTarget(actor, targetType, targetId);
            const key = targetType === "custom" ? String(form.elements.customKey.value ?? "").trim() : target?.key;
            const mode = String(form.elements.mode.value || CHANGE_TYPES.ADD);
            const value = Number(form.elements.value.value ?? 0);
            const durationType = form.elements.durationType.value;
            const durationValue = Math.max(0, Number(form.elements.durationValue.value ?? 0));
            const name = String(form.elements.name.value ?? "").trim() || buildDefaultName({ target: targetType === "custom" ? { label: key } : target, mode, value });
            const icon = String(form.elements.icon.value ?? "").trim() || "icons/svg/aura.svg";
            const disabled = Boolean(form.elements.disabled.checked);
            const conditional = Boolean(form.elements.conditional.checked);
            return { targetType, targetId, key, mode, value, durationType, durationValue, name, icon, disabled, conditional };
          }
        },
        rejectClose: false
      });
    } catch {
      return null;
    } finally {
      document.removeEventListener("change", onPromptChange);
      document.removeEventListener("input", onPromptChange);
    }

    if (!result) return null;
    if (!result.key) {
      ui.notifications?.warn(localize("AXIOM.Actor.Effects.Builder.InvalidKey"));
      return null;
    }
    if (!Number.isFinite(result.value)) {
      ui.notifications?.warn(localize("AXIOM.Actor.Effects.Builder.InvalidValue"));
      return null;
    }

    const duration = {};
    if (result.durationType === "rounds" && result.durationValue > 0) duration.rounds = result.durationValue;
    if (result.durationType === "seconds" && result.durationValue > 0) duration.seconds = result.durationValue;

    const [effect] = await actor.createEmbeddedDocuments("ActiveEffect", [{
      name: result.name,
      img: result.icon,
      disabled: result.disabled,
      duration,
      changes: [{
        key: result.key,
        type: result.mode,
        value: String(result.value),
        priority: CHANGE_TYPE_PRIORITIES[result.mode] ?? 20
      }],
      flags: {
        axiom: {
          builder: true,
          targetType: result.targetType,
          targetId: result.targetId,
          conditional: Boolean(result.conditional)
        }
      }
    }]);

    return effect;
  }
}
