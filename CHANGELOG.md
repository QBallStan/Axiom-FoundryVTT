# Changelog
All notable changes to this project will be documented in this file.

The format is based on  
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/)  
and this project adheres to **Semantic Versioning (SemVer)**.

---

## **[0.0.3] – 2025-11-29**
### Added

- Implemented full AppV2 **PARTS** structure for actors & items  
- Added new AppV2-compatible **Item Sheets** for:
  - Skill items
  - Weapon items
  - Armor items  
    (early WIP but functional structure and navigation)
    
### Changed

- Fully migrated the Character sheet to **ApplicationV2 + Handlebars**, replacing all legacy template logic.
- Rebuilt `sidebar.hbs`, `tabs.hbs`, and all actor tab templates to follow the AppV2 architecture.
- Standardized tab navigation across Actor and Item sheets (consistent Handlebars loops, data-group / data-tab usage).

---

## [0.0.2] - 2025-11-17
### Added
- Completed initial sidebar layout for the Character sheet.
- Implemented editable Health and Stamina trackers with +/– controls.
- Added Toughness, Movement, Corruption, Focus Points, and Action Points display grid.
- Added full attribute block using 2×4 grid layout.
- Integrated sidebar tab system (Attribute Tests & Physical Limits).
- Implemented partials for attribute tests and physical limits.
- Improved portrait behavior: clickable image with hover cursor.
- Added optional rounded corners for portrait.
- Added typography options (Vollkorn & Poltawski Nowy) for character name display.
- Added main/sidebar tab initialization in `axiomCharacterSheet.js`.

### Changed
- Refactored `sidebar.hbs` to use partials.
- Updated tab initialization code to match new HTML structure.
- Cleaned HTML structure for trackers and attributes.
- Updated stats grid to include Action Points.

### Fixed
- Fixed overflow issues on number inputs.
- Ensured sidebar portrait is now editable as intended.

---

## [0.0.1] - 2025-11-16
### Added
- Initial project setup and directory structure.
- Registered the Character sheet using `ActorSheetV2` (appV2).
- Unregistered Foundry's default core actor sheets.
- Populated `template.json` with:
  - Base **Character** type.
  - Core attributes (Strength, Agility, Fortitude, Logic, Resolve, Charisma, Instinct, Power).
  - Basic trackers (Health, Stamina, Toughness, Movement, Corruption, Focus).
- Created temporary Handlebars files for the new sheet:
  - `sidebar.hbs`
  - `trackers.hbs`
  - `main.hbs`
  - Partial tabs and sidebar subcomponents.
