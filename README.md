# Axiom//Core for FoundryVTT

The official **FoundryVTT V14** system for **Axiom//Core**, a modular universal tabletop roleplaying game built around d100 roll-under tests, Success Targets, Hits, Complications, Momentum, Fate, Action Points, wounds, armor, and tactical combat.

This system is currently in early development. It is usable for testing and early play, but it is not yet feature-complete and breaking changes should be expected.

## Current Version

**v0.0.1**

## Foundry Compatibility

Built for **FoundryVTT V14**.

Older versions of Foundry are not supported.

## Installation

To install the system manually:

1. Download the latest release from the GitHub releases page.
2. Extract the system folder into your FoundryVTT `Data/systems/` directory.
3. Restart FoundryVTT.
4. Create a world using the **Axiom//Core** game system.

Once a manifest URL is available, installation through Foundry’s system installer will be supported.

## Actor Types

The system currently supports:

- **Protagonist**
- **NPC**

Protagonists are intended for player characters and major NPCs. They include Fate, Momentum, Action Points, wounds, attributes, skills, equipment, and combat tools.

NPCs use a simpler sheet for minor characters, enemies, and supporting cast members.

## Item Types

The following item types are currently supported:

- **Skill**
- **Trait**
- **Equipment**
- **Armor**
- **Weapon (Melee)**
- **Weapon (Ranged)**
- **Ammunition**

## Current Features

The system currently includes:

- Protagonist and NPC sheets
- Item sheets
- Core Skill and Expertise Skill support
- Attribute and sub-attribute tracking
- Wound tracking
- Fate tracking
- Momentum tracking
- Action Point tracking
- Currency settings
- Active Effects support
- Basic token HUD/status integration
- Default icons for actors and items
- English localization
- French localization structure

## Roll Automation

The current release includes the first pass of automation for:

- **d100 roll-under tests**
- **Success Targets**
- **Hits**
- **Outcome tiers**
- **Complications**
- **Roll modifiers**
- **Timeframes**
- **Initiative**
- **Action Points**
- **Momentum**
- **Melee attacks**
- **Ranged attacks**
- **Ammunition use**
- **Armor**
- **Toughness**
- **Hit locations**
- **Damage**
- **Wounds**

Combat automation is functional enough for early testing, but still incomplete.

## Repository

GitHub: <https://github.com/QBallStan/Axiom-FoundryVTT>