# World Clock

World Clock is a macOS menu-bar app for comparing time, weather, daylight, and cities around the world.

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
