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
  { id: "apMax", label: "AXIOM.Actor.Effects.Builder.Targets.ActionPointsMax", key: "system.trackers.actionPoints.max" }
];

const SUB_ATTRIBUTE_TARGETS = [
  { id: "movement", label: "AXIOM.Actor.Effects.Builder.Targets.Movement", key: "system.subAttributes.movement" },
  { id: "initiative", label: "AXIOM.Actor.Effects.Builder.Targets.Initiative", key: "system.subAttributes.initiative" },
  { id: "size", label: "AXIOM.Actor.Effects.Builder.Targets.Size", key: "system.size" },
  { id: "damageModifier", label: "AXIOM.Actor.Effects.Builder.Targets.DamageModifier", key: "system.subAttributes.damageModifier" },
  { id: "toughness", label: "AXIOM.Actor.Effects.Builder.Targets.Toughness", key: "system.subAttributes.toughness" },
  { id: "corruptionThreshold", label: "AXIOM.Actor.Effects.Builder.Targets.CorruptionThreshold", key: "system.subAttributes.corruptionThreshold" }
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

const TARGET_TYPES = [
  { id: "attribute", label: "AXIOM.Actor.Effects.Builder.TargetTypes.Attribute" },
  { id: "skill", label: "AXIOM.Actor.Effects.Builder.TargetTypes.Skill" },
  { id: "attributeCheck", label: "AXIOM.Actor.Effects.Builder.TargetTypes.AttributeCheck" },
  { id: "subAttribute", label: "AXIOM.Actor.Effects.Builder.TargetTypes.SubAttribute" },
  { id: "resource", label: "AXIOM.Actor.Effects.Builder.TargetTypes.Resource" },
  { id: "wound", label: "AXIOM.Actor.Effects.Builder.TargetTypes.Wound" },
  { id: "custom", label: "AXIOM.Actor.Effects.Builder.TargetTypes.Custom" }
];


function getFilePickerClass() {
  return foundry.applications?.apps?.FilePicker ?? globalThis.FilePicker;
}

function updateEffectIcon(prompt, path) {
  const value = String(path ?? "systems/axiom/assets/icons/effect.svg").trim() || "systems/axiom/assets/icons/effect.svg";
  const input = prompt.querySelector("[name='icon']");
  const image = prompt.querySelector("[data-effect-icon-preview]");
  if (input) input.value = value;
  if (image) image.src = value;
}

function openEffectIconPicker(prompt) {
  const FilePickerClass = getFilePickerClass();
  if (!FilePickerClass) return;

  const current = prompt.querySelector("[name='icon']")?.value || "systems/axiom/assets/icons/effect.svg";
  const picker = new FilePickerClass({
    type: "image",
    current,
    callback: path => updateEffectIcon(prompt, path)
  });

  // Foundry V14 FilePicker is an ApplicationV2 app, while older builds used Application.
  // Support both render signatures so the image browser opens above this non-modal builder.
  try {
    picker.render({ force: true });
  } catch {
    picker.render(true);
  }
}

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

function encodeChange(change) {
  return encodeURIComponent(JSON.stringify(change));
}

function decodeChange(value) {
  try {
    return JSON.parse(decodeURIComponent(value ?? ""));
  } catch {
    return null;
  }
}

function normalizeSkillReference(value) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase(game.i18n.lang)
    .replaceAll(/[^\p{L}\p{N}]+/gu, "");
}

function getSkillNameEffectKey(name) {
  const normalized = normalizeSkillReference(name);
  return normalized ? `flags.axiom.skillNameModifiers.${normalized}` : "";
}

async function getWorldAndCompendiumSkillNames() {
  const names = new Set();

  for (const item of game.items ?? []) {
    if (item?.type === "skill" && item.name) names.add(item.name);
  }

  for (const pack of game.packs ?? []) {
    if (pack.documentName !== "Item") continue;

    try {
      const index = await pack.getIndex({ fields: ["name", "type"] });
      for (const entry of index ?? []) {
        if (entry?.type === "skill" && entry.name) names.add(entry.name);
      }
    } catch (error) {
      console.warn(`Axiom | Could not read skill compendium ${pack.collection}`, error);
    }
  }

  return Array.from(names).sort((a, b) => a.localeCompare(b));
}

function getAttributeCheckTargets() {
  return Object.entries(CONFIG.AXIOM?.attributeCheckPresets ?? {}).map(([id, preset]) => ({
    id,
    label: preset.label,
    key: `flags.axiom.attributeCheckModifiers.${id}`
  }));
}

function getEffectBuilderActor(targetDocument) {
  if (!targetDocument) return null;
  if (targetDocument.documentName === "Actor") return targetDocument;
  if (targetDocument.actor?.documentName === "Actor") return targetDocument.actor;
  if (targetDocument.parent?.documentName === "Actor") return targetDocument.parent;
  return null;
}

async function getSkillTargets(actor) {
  const byKey = new Map();

  for (const item of actor?.items ?? []) {
    if (item?.type !== "skill" || !item.name) continue;
    const key = getSkillNameEffectKey(item.name);
    if (key) byKey.set(key, { id: normalizeSkillReference(item.name), label: item.name, key });
  }

  for (const name of await getWorldAndCompendiumSkillNames()) {
    const key = getSkillNameEffectKey(name);
    if (key && !byKey.has(key)) byKey.set(key, { id: normalizeSkillReference(name), label: name, key });
  }

  return Array.from(byKey.values()).sort((a, b) => localize(a.label).localeCompare(localize(b.label)));
}

function getTargets(targetGroups, type) {
  if (type === "attribute") return targetGroups.attribute;
  if (type === "skill") return targetGroups.skill;
  if (type === "attributeCheck") return targetGroups.attributeCheck;
  if (type === "subAttribute") return targetGroups.subAttribute;
  if (type === "resource") return targetGroups.resource;
  if (type === "wound") return targetGroups.wound;
  return [{ id: "custom", label: "AXIOM.Actor.Effects.Builder.Targets.Custom", key: "" }];
}

function renderOptions(options, selectedId = null) {
  if (!options.length) return `
    <option value="" data-key="">${escapeHtml(localize("AXIOM.Actor.Effects.Builder.NoTargetsAvailable"))}</option>
  `;
  return options.map(option => `
    <option value="${escapeHtml(option.id)}" data-key="${escapeHtml(option.key)}" ${selectedId === option.id ? "selected" : ""}>${escapeHtml(localize(option.label))}</option>
  `).join("");
}

function getTargetLabel(targetGroups, targetType, targetId, customKey = "") {
  if (targetType === "custom") return customKey || localize("AXIOM.Actor.Effects.Builder.Targets.Custom");
  const target = getTargets(targetGroups, targetType).find(entry => entry.id === targetId);
  return target ? localize(target.label) : localize("AXIOM.Actor.Effects.Builder.NoKeySelected");
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

function buildDefaultName({ changes }) {
  const validChanges = Array.isArray(changes) ? changes.filter(change => change?.key) : [];
  if (!validChanges.length) return localize("AXIOM.Actor.Effects.Builder.DefaultName");

  const first = validChanges[0];
  const base = `${first.label ?? first.key} ${modeLabel(first.mode)} ${formatSigned(first.value)}`.trim();
  if (validChanges.length === 1) return base;

  return `${base} ${localize("AXIOM.Actor.Effects.Builder.AndMore").replace("{count}", String(validChanges.length - 1))}`;
}

function buildModeOptions(selected = CHANGE_TYPES.ADD) {
  return CHANGE_MODES.map(mode => `
    <option value="${escapeHtml(mode.value)}" ${selected === mode.value ? "selected" : ""}>${escapeHtml(localize(mode.label))}</option>
  `).join("");
}

function renderTargetTypeOptions(selected = "attribute") {
  return TARGET_TYPES.map(type => `
    <option value="${escapeHtml(type.id)}" ${selected === type.id ? "selected" : ""}>${escapeHtml(localize(type.label))}</option>
  `).join("");
}

function getComposerElements(prompt) {
  return {
    targetType: prompt.querySelector("[name='composerTargetType']"),
    target: prompt.querySelector("[name='composerTarget']"),
    customKey: prompt.querySelector("[name='composerCustomKey']"),
    mode: prompt.querySelector("[name='composerMode']"),
    value: prompt.querySelector("[name='composerValue']"),
    keyPreview: prompt.querySelector("[data-effect-key-preview]"),
    addButton: prompt.querySelector("[data-action='queueEffectChange']"),
    updateButton: prompt.querySelector("[data-action='updateEffectChange']"),
    clearButton: prompt.querySelector("[data-action='clearEffectComposer']")
  };
}

function updateComposerTargetOptions(prompt, targetGroups, { preserveTarget = false } = {}) {
  const { targetType, target } = getComposerElements(prompt);
  if (!targetType || !target) return;
  const selected = preserveTarget ? target.value : null;
  target.innerHTML = renderOptions(getTargets(targetGroups, targetType.value), selected);
}

function readComposer(prompt, targetGroups) {
  const fields = getComposerElements(prompt);
  const targetType = fields.targetType?.value ?? "attribute";
  const targetId = fields.target?.value ?? "custom";
  const customKey = String(fields.customKey?.value ?? "").trim();
  const selected = fields.target?.selectedOptions?.[0];
  const key = targetType === "custom" ? customKey : selected?.dataset.key ?? "";
  const mode = String(fields.mode?.value || CHANGE_TYPES.ADD);
  const value = Number(fields.value?.value ?? 0);
  const label = getTargetLabel(targetGroups, targetType, targetId, customKey);

  return { targetType, targetId, customKey, key, mode, value, label };
}

function writeComposer(prompt, targetGroups, change = null) {
  const fields = getComposerElements(prompt);
  const targetType = change?.targetType ?? "attribute";

  if (fields.targetType) fields.targetType.value = targetType;
  updateComposerTargetOptions(prompt, targetGroups);
  if (fields.target && change?.targetId) fields.target.value = change.targetId;
  if (fields.customKey) fields.customKey.value = change?.customKey ?? (targetType === "custom" ? change?.key ?? "" : "");
  if (fields.mode) fields.mode.value = change?.mode ?? CHANGE_TYPES.ADD;
  if (fields.value) fields.value.value = Number.isFinite(Number(change?.value)) ? Number(change.value) : 5;
  updateComposerPreview(prompt, targetGroups);
}

function updateComposerPreview(prompt, targetGroups) {
  const fields = getComposerElements(prompt);
  const targetType = fields.targetType?.value ?? "attribute";
  const change = readComposer(prompt, targetGroups);
  const customGroup = fields.customKey?.closest(".form-group");
  const targetGroup = fields.target?.closest(".form-group");

  if (customGroup) customGroup.hidden = targetType !== "custom";
  if (targetGroup) targetGroup.hidden = targetType === "custom";
  if (fields.keyPreview) fields.keyPreview.textContent = change.key || localize("AXIOM.Actor.Effects.Builder.NoKeySelected");
}

function renderQueuedModifier(change, index, { selected = false } = {}) {
  const subtitle = `${modeLabel(change.mode)} ${formatSigned(change.value)}`;
  return `
    <li class="effect-builder-queued-change ${selected ? "selected" : ""}" data-change-index="${Number(index) || 0}" data-change="${escapeHtml(encodeChange(change))}">
      <button type="button" class="effect-builder-queued-main" data-action="selectQueuedEffectChange">
        <span class="effect-builder-queued-label">${escapeHtml(change.label ?? change.key)}</span>
        <span class="effect-builder-queued-subtitle">${escapeHtml(subtitle)}</span>
      </button>
      <button type="button" class="effect-builder-queued-remove" data-action="removeQueuedEffectChange" title="${escapeHtml(localize("AXIOM.Actor.Effects.Builder.RemoveModifier"))}">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </li>
  `;
}

function getQueuedChanges(prompt) {
  return Array.from(prompt.querySelectorAll(".effect-builder-queued-change"))
    .map(row => decodeChange(row.dataset.change))
    .filter(Boolean);
}

function setQueuedChanges(prompt, changes, { selectedIndex = -1 } = {}) {
  const list = prompt.querySelector("[data-effect-change-list]");
  const empty = prompt.querySelector("[data-effect-empty-state]");
  const count = prompt.querySelector("[data-effect-change-count]");
  const selectedInput = prompt.querySelector("[name='selectedChangeIndex']");

  if (list) {
    list.innerHTML = changes.map((change, index) => renderQueuedModifier(change, index, { selected: index === selectedIndex })).join("");
  }
  if (empty) empty.hidden = changes.length > 0;
  if (count) count.textContent = String(changes.length);
  if (selectedInput) selectedInput.value = String(selectedIndex);
}

function selectQueuedChange(prompt, targetGroups, index) {
  const changes = getQueuedChanges(prompt);
  const change = changes[index];
  if (!change) return;
  setQueuedChanges(prompt, changes, { selectedIndex: index });
  writeComposer(prompt, targetGroups, change);
  const { addButton, updateButton, clearButton } = getComposerElements(prompt);
  if (addButton) addButton.hidden = true;
  if (updateButton) updateButton.hidden = false;
  if (clearButton) clearButton.hidden = false;
}

function clearComposerSelection(prompt, targetGroups) {
  const changes = getQueuedChanges(prompt);
  setQueuedChanges(prompt, changes, { selectedIndex: -1 });
  writeComposer(prompt, targetGroups);
  const { addButton, updateButton, clearButton } = getComposerElements(prompt);
  if (addButton) addButton.hidden = false;
  if (updateButton) updateButton.hidden = true;
  if (clearButton) clearButton.hidden = true;
}

export default class AxiomEffectBuilder {
  static async prompt(targetDocument) {
    if (!targetDocument?.createEmbeddedDocuments) return null;

    const actor = getEffectBuilderActor(targetDocument);
    const targetGroups = {
      attribute: ATTRIBUTE_TARGETS,
      skill: await getSkillTargets(actor),
      attributeCheck: getAttributeCheckTargets(),
      subAttribute: SUB_ATTRIBUTE_TARGETS,
      resource: RESOURCE_TARGETS,
      wound: WOUND_TARGETS
    };

    const onPromptChange = event => {
      const prompt = event.target.closest?.(".axiom-effect-builder");
      if (!prompt) return;

      if (event.target.matches?.("[name='composerTargetType']")) updateComposerTargetOptions(prompt, targetGroups);
      if (event.target.closest?.("[data-effect-composer]")) updateComposerPreview(prompt, targetGroups);
    };

    const onPromptClick = event => {
      const prompt = event.target.closest?.(".axiom-effect-builder");
      if (!prompt) return;

      const action = event.target.closest?.("[data-action]")?.dataset?.action;
      if (!action) return;

      if (action === "selectEffectIcon") {
        event.preventDefault();
        openEffectIconPicker(prompt);
        return;
      }

      if (action === "queueEffectChange") {
        event.preventDefault();
        const change = readComposer(prompt, targetGroups);
        const changes = getQueuedChanges(prompt);
        changes.push(change);
        setQueuedChanges(prompt, changes, { selectedIndex: -1 });
        return;
      }

      if (action === "selectQueuedEffectChange") {
        event.preventDefault();
        const index = Number(event.target.closest(".effect-builder-queued-change")?.dataset?.changeIndex ?? -1);
        selectQueuedChange(prompt, targetGroups, index);
        return;
      }

      if (action === "removeQueuedEffectChange") {
        event.preventDefault();
        const index = Number(event.target.closest(".effect-builder-queued-change")?.dataset?.changeIndex ?? -1);
        const changes = getQueuedChanges(prompt);
        changes.splice(index, 1);
        setQueuedChanges(prompt, changes, { selectedIndex: -1 });
        clearComposerSelection(prompt, targetGroups);
        return;
      }

      if (action === "updateEffectChange") {
        event.preventDefault();
        const selectedIndex = Number(prompt.querySelector("[name='selectedChangeIndex']")?.value ?? -1);
        const changes = getQueuedChanges(prompt);
        if (selectedIndex < 0 || selectedIndex >= changes.length) return;
        changes[selectedIndex] = readComposer(prompt, targetGroups);
        setQueuedChanges(prompt, changes, { selectedIndex });
        return;
      }

      if (action === "clearEffectComposer") {
        event.preventDefault();
        clearComposerSelection(prompt, targetGroups);
      }
    };

    globalThis.document.addEventListener("change", onPromptChange);
    globalThis.document.addEventListener("input", onPromptChange);
    globalThis.document.addEventListener("click", onPromptClick);

    let result;
    try {
      result = await DialogV2.prompt({
        window: { title: localize("AXIOM.Actor.Effects.Builder.Title") },
        classes: ["axiom", "effect-builder-dialog"],
        position: { width: 760, height: "auto" },
        modal: false,
        content: `
          <div class="axiom-effect-builder">
            <section class="effect-builder-meta-panel">
              <div class="effect-builder-portrait-field">
                <img
                  class="effect-builder-portrait-image item-image"
                  data-action="selectEffectIcon"
                  data-effect-icon-preview
                  src="systems/axiom/assets/icons/effect.svg"
                  alt="${escapeHtml(localize("AXIOM.Actor.Effects.Builder.Icon"))}"
                  data-tooltip="${escapeHtml(localize("AXIOM.Actor.Effects.Builder.Icon"))}"
                >
                <input type="hidden" name="icon" value="systems/axiom/assets/icons/effect.svg">
              </div>

              <div class="form-group">
                <label>${escapeHtml(localize("AXIOM.Actor.Effects.Builder.Name"))}</label>
                <input type="text" name="name" placeholder="${escapeHtml(localize("AXIOM.Actor.Effects.Builder.NamePlaceholder"))}">
              </div>

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
            </section>

            <section class="effect-builder-workspace">
              <aside class="effect-builder-queue-panel">
                <header class="effect-builder-list-header">
                  <span>${escapeHtml(localize("AXIOM.Actor.Effects.Builder.ModifierQueue"))}</span>
                  <strong data-effect-change-count>0</strong>
                </header>
                <p class="effect-builder-empty" data-effect-empty-state>${escapeHtml(localize("AXIOM.Actor.Effects.Builder.EmptyQueue"))}</p>
                <ol class="effect-builder-queued-list" data-effect-change-list></ol>
              </aside>

              <section class="effect-builder-composer-panel" data-effect-composer>
                <header class="effect-builder-list-header">
                  <span>${escapeHtml(localize("AXIOM.Actor.Effects.Builder.ModifierComposer"))}</span>
                </header>
                <input type="hidden" name="selectedChangeIndex" value="-1">

                <div class="effect-builder-grid two-columns">
                  <div class="form-group">
                    <label>${escapeHtml(localize("AXIOM.Actor.Effects.Builder.TargetType"))}</label>
                    <select name="composerTargetType">${renderTargetTypeOptions("attribute")}</select>
                  </div>
                  <div class="form-group">
                    <label>${escapeHtml(localize("AXIOM.Actor.Effects.Builder.Target"))}</label>
                    <select name="composerTarget">${renderOptions(targetGroups.attribute)}</select>
                  </div>
                </div>

                <div class="form-group" hidden>
                  <label>${escapeHtml(localize("AXIOM.Actor.Effects.Builder.CustomKey"))}</label>
                  <input type="text" name="composerCustomKey" placeholder="system.attributes.strength.mod">
                </div>

                <div class="effect-builder-grid two-columns">
                  <div class="form-group">
                    <label>${escapeHtml(localize("AXIOM.Actor.Effects.Builder.Mode"))}</label>
                    <select name="composerMode">${buildModeOptions(CHANGE_TYPES.ADD)}</select>
                  </div>
                  <div class="form-group">
                    <label>${escapeHtml(localize("AXIOM.Actor.Effects.Builder.Value"))}</label>
                    <input type="number" name="composerValue" step="1" value="5" required>
                  </div>
                </div>

                <div class="effect-key-preview compact">
                  <span>${escapeHtml(localize("AXIOM.Actor.Effects.Builder.KeyPreview"))}</span>
                  <code data-effect-key-preview>${escapeHtml(targetGroups.attribute[0]?.key ?? "")}</code>
                </div>

                <footer class="effect-builder-composer-actions">
                  <button type="button" data-action="queueEffectChange">
                    <i class="fa-solid fa-plus"></i>
                    ${escapeHtml(localize("AXIOM.Actor.Effects.Builder.QueueModifier"))}
                  </button>
                  <button type="button" data-action="updateEffectChange" hidden>
                    <i class="fa-solid fa-floppy-disk"></i>
                    ${escapeHtml(localize("AXIOM.Actor.Effects.Builder.UpdateModifier"))}
                  </button>
                  <button type="button" data-action="clearEffectComposer" hidden>
                    <i class="fa-solid fa-xmark"></i>
                    ${escapeHtml(localize("AXIOM.Actor.Effects.Builder.CancelEdit"))}
                  </button>
                </footer>
              </section>
            </section>

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
          </div>
        `,
        ok: {
          label: localize("AXIOM.Actor.Effects.Builder.Create"),
          callback: (event, button) => {
            const form = button.form;
            const root = form.querySelector(".axiom-effect-builder") ?? form;
            const changes = getQueuedChanges(root);
            const durationType = form.elements.durationType.value;
            const durationValue = Math.max(0, Number(form.elements.durationValue.value ?? 0));
            const name = String(form.elements.name.value ?? "").trim() || buildDefaultName({ changes });
            const icon = String(form.elements.icon.value ?? "").trim() || "systems/axiom/assets/icons/effect.svg";
            const disabled = Boolean(form.elements.disabled.checked);
            const conditional = Boolean(form.elements.conditional.checked);
            return { changes, durationType, durationValue, name, icon, disabled, conditional };
          }
        },
        rejectClose: false
      });
    } catch {
      return null;
    } finally {
      globalThis.document.removeEventListener("change", onPromptChange);
      globalThis.document.removeEventListener("input", onPromptChange);
      globalThis.document.removeEventListener("click", onPromptClick);
    }

    if (!result) return null;

    const validChanges = result.changes.filter(change => change?.key);
    if (!validChanges.length) {
      ui.notifications?.warn(localize("AXIOM.Actor.Effects.Builder.InvalidKey"));
      return null;
    }
    if (validChanges.some(change => !Number.isFinite(change.value))) {
      ui.notifications?.warn(localize("AXIOM.Actor.Effects.Builder.InvalidValue"));
      return null;
    }

    const duration = {};
    if (result.durationType === "rounds" && result.durationValue > 0) duration.rounds = result.durationValue;
    if (result.durationType === "seconds" && result.durationValue > 0) duration.seconds = result.durationValue;

    const effectData = {
      name: result.name,
      img: result.icon,
      disabled: result.disabled,
      duration,
      changes: validChanges.map(change => ({
        key: change.key,
        type: change.mode,
        value: String(change.value),
        priority: CHANGE_TYPE_PRIORITIES[change.mode] ?? 20
      })),
      flags: {
        axiom: {
          builder: true,
          targetType: validChanges[0]?.targetType,
          targetId: validChanges[0]?.targetId,
          targets: validChanges.map(change => ({
            targetType: change.targetType,
            targetId: change.targetId,
            key: change.key
          })),
          conditional: Boolean(result.conditional)
        }
      }
    };

    if (targetDocument.documentName === "Item") effectData.transfer = true;

    const [effect] = await targetDocument.createEmbeddedDocuments("ActiveEffect", [effectData]);

    return effect;
  }
}
