# Verification: pairing by QR code and link (CHG-0434, CHG-0435)

Branch `worktree/pairing-link` on `main` at `4e940fa`. Run inside Claude Code's sandbox (`CI=1`), XDG_DATA_HOME and pty conditions as for the whole suite.

## Results run on this branch

- `bun run check`: 853 files, no fixes.
- `bun run typecheck`: seven workspaces pass.
- `CI=1 bun run test`: 244 files passed, 4 skipped; 1,982 tests passed, 54 skipped.
- Web export (`expo export --platform web`) builds with `uqr` and `react-native-svg`.
- The QR matrix drawn by `pairingQrOf` for a real web link (65 modules at four pixels each) and for the app link (61 modules) decodes with jsQR 1.4 to exactly the link encoded. This reads the module matrix, not a camera.

## Dependency

`uqr` 0.1.3 (MIT, Anthony Fu and Project Nayuki, no dependencies, 27 KB of code, ESM, typed): returns the module matrix in any runtime, so one drawing (react-native-svg) serves Expo web, the desktop window and native. `qrcode-generator` 2.0.4 (MIT) was the alternative: 555 KB unpacked and untyped matrix access. The lockfile gains one entry (`bun.lock`); `bun add` ran in the sandbox and failed only at the `prepare` git-config step, after saving the lockfile.

## Not checked

- No window opened: the card's QR layout and Copy buttons, Add a host prefilled from a link, the browser's automatic pairing and its confirmation when it has a host, and the fragment leaving the address bar were not seen. The logic behind each is tested (parser, offer rules, queue, matrix); the wiring in `useHostConnection`, `App.tsx` and `AddHostModal` is typechecked, not run.
- No scan with a phone camera; no click on an `outlore://` link in a macOS, Windows or Linux session: `setAsDefaultProtocolClient`, `open-url`, the second-launch arguments, and the installer's scheme registration (`protocols`) ran in no packaged build. An AppImage registers its scheme only when the system integrates it.
- The web link points at the shared relay's web app, which does not yet carry this change; it needs the next web deployment, and the link will open the older web app, which ignores the fragment, until then.
- The mobile app (scheme, link handler, in-app scanner) is not built.
