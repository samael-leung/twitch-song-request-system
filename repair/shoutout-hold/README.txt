SO Clip Hold Fix

The log "Queued ... held" means the active dashboard mode is holding clips.
For immediate playback on your current version, switch to a mode without
Hold clips, such as Talking, or uncheck Hold clips and reselect that mode.

This repair makes editing Hold clips on the active mode take effect immediately.
It preserves intentional holds and does not change scenes, audio or chat messages.

For a ZIP installation (no Git required):
1. Stop the song-request app (Ctrl+C in its npm start window).
2. Extract SO-Clip-Hold-Fix.zip into a temporary folder.
3. Open a terminal in your song-request project folder (the one with package.json).
4. Run: node "FULL-PATH-TO-EXTRACTED-FOLDER\SO-Clip-Hold-Fix\install.js" .
5. Run npm start again, then in Modes uncheck Hold clips on the active mode.

The installer only updates server/modes.js and saves its exact previous bytes
in server/modes.js.before-so-fix-....bak. It accepts the known 2026.11-1 version
(LF or CRLF) and refuses other customized versions without changing anything.
Running it again after a successful repair is harmless.
To undo: stop the app, restore that backup as server/modes.js, and restart.
No .env, credentials, settings, saved modes, song links or dependencies are changed.

Clip playback requires an OBS Browser Source or browser tab at:
http://localhost:3000/clip-player/index.html

Twitch refusing its own Shoutout while offline, or when shouting yourself out,
does not prevent this app from finding and playing a clip.
