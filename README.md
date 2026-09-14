# World Clock

World Clock is a macOS menu-bar app for comparing time, weather, daylight, and cities around the world.

## Demo

<video controls src="https://raw.githubusercontent.com/willian/world-clock/refs/heads/main/docs/media/demo.mov">A short World Clock demo.</video>

## Requirements

- macOS
- Xcode Command Line Tools (`xcode-select --install`)
- Rust 1.85 or newer, including Cargo
- Node.js 20.19+ or 22.12+
- pnpm 9+

## Build locally

```sh
pnpm install
pnpm tauri build --debug
open "src-tauri/target/debug/bundle/macos/World Clock.app"
```

The app appears in the menu bar and does not use the Dock. Click its icon to open or hide the panel; right-click it to quit.

This project is currently distributed as source for local builds and is not signed or notarized.

## Checks

```sh
pnpm check
pnpm test:time
```

## Build with an agent

Use this prompt with a coding agent:

```text
Set up and build World Clock locally. Before taking any action, including
checking versions or running read-only commands, describe the exact next action
and wait for my explicit approval. Do not treat approval for one action as
approval for later actions.

After I approve, check whether this macOS system has:
- Xcode Command Line Tools
- Rust 1.85+ and Cargo
- Node.js 20.19+ or 22.12+
- pnpm 9+

Report what is missing. For each missing requirement, select an available
manager (`mise`, `asdf`, `nvm`, or Homebrew) and explain the exact install
command. Ask for my approval immediately before every installation; never
install a dependency or package manager without it. If no listed manager is
available, propose an installation method and wait for approval before using it.

Once every requirement is installed, ask for approval before cloning
https://github.com/willian/world-clock.git into a directory I choose. Then ask
for approval before each build command:

pnpm install
pnpm tauri build --debug
open "src-tauri/target/debug/bundle/macos/World Clock.app"

Do not use `sudo`, modify global configuration, commit, or push unless I
explicitly approve that specific action.
```
