# Masha & Bear Forest Adventure

A browser-based cartoon adventure game built with HTML5, CSS3, and JavaScript.

## Run locally in VS Code

1. Open this folder in VS Code.
2. Open a terminal in the project folder.
3. Run:
   ```bash
   python -m http.server 8000
   ```
4. Open http://localhost:8000 in your browser.

## GitHub Pages

The project uses relative paths only and works without a backend. Upload the project folder to GitHub Pages or publish the root folder as a static site.

## Notes

- The game uses Canvas for the playable level.
- No external API keys or backend are required.
- Original fallback character art is drawn in code, so no image download is required.
- Keyboard controls are ←/→ or A/D to move, Space to jump, E for Bear's ability, and P to pause. The on-screen controls also work with a mouse, touchscreen, or keyboard focus.
- To use licensed character art, put transparent PNG files in `assets/characters/` and set the `masha` and `bear` entries in `CHARACTER_ASSET_PATHS` near the top of `game.js` to relative paths such as `./assets/characters/masha.png`. If either image is missing, the original fallback drawing remains available.
- The other `assets/` folders are reserved for optional licensed art and audio. No asset is required for the game to run.
- The characters currently use original placeholder illustrations; official Masha and Bear artwork must be supplied by you with appropriate rights.
