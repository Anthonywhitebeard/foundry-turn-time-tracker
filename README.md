# Turn Time Tracker

## Example:
<img width="432" height="359" alt="image" src="https://github.com/user-attachments/assets/e477c2b3-227c-4a6d-9c24-ab96f42de966" />


Foundry VTT v14 module for D&D5e combat. It shows two timers beside combatants in the Combat Tracker:

- **Turn**: time spent on the current turn. It resets when the active combatant changes.
- **Total**: total time spent across that combatant's turns in the active combat. It resets when the combat encounter ends.

The module stores timer state on the active Combat document flags, so all connected clients can display the same timers. The GM client is responsible for finalizing elapsed turn time when initiative advances.

## Compatibility

- Foundry VTT: v14
- System: Dungeons & Dragons Fifth Edition (`dnd5e`)

## Install Locally

1. Copy this folder into your Foundry user data folder:

   ```text
   Data/modules/turn-time-tracker
   ```

2. Restart Foundry VTT.
3. Open your world.
4. Go to **Manage Modules** and enable **Combat Turn Timers**.

## Settings

Open **Configure Settings > Module Settings > Turn Time Tracker**:

- **Show NPC timers**: GM-only world setting. Off by default.
- **Players see only owned tokens**: GM-only world setting. On by default.

## GitHub Release URLs

After creating the GitHub repository, update these fields in `module.json` if the repository name or owner changes:

```json
"manifest": "https://github.com/Anthonywhitebeard/turn-time-tracker/releases/latest/download/module.json",
"download": "https://github.com/Anthonywhitebeard/turn-time-tracker/releases/latest/download/turn-time-tracker.zip",
"url": "https://github.com/Anthonywhitebeard/turn-time-tracker"
```

## Create a Release ZIP

From the module folder, zip these files and folders:

- `module.json`
- `scripts/`
- `styles/`
- `lang/`
- `README.md`
- `LICENSE`

Name the archive:

```text
turn-time-tracker.zip
```

Upload both `turn-time-tracker.zip` and `module.json` to the same GitHub Release. Foundry users can install the module with the `module.json` release URL.

## Development Notes

Timers are injected into Combat Tracker rows and refreshed while combat is active.
