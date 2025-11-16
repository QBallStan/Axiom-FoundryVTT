# Changelog
All notable changes to this project will be documented in this file.

The format is based on  
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/)  
and this project adheres to **Semantic Versioning (SemVer)**.

---

## [0.0.2] - 2025-11-16
### Added
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

---

## [0.0.1] - 2025-11-16
### Added
- Initial project setup and directory structure.