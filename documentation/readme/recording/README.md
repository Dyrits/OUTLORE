# Recording the README media

The GIFs and screenshots in `documentation/readme/` come from the real desktop app at version 0.1.1-Prototype (commit `ae217e40`) on isolated data, driven by Playwright over the Chrome DevTools Protocol.
The agents' replies are scripted: a temporary patch lets the echo harness answer from `demo.base.json` and run thread tools (side-quest reports, mentions, Outlore suggestions, a failed turn for the backup).
The patch is for recording only; never commit it.

To reproduce the original recording, check out `ae217e40` in a separate worktree and follow the copy of this guide at that revision.
Use the patch, environment variable names, and script paths from that same revision.

The kit needs Bun, Python 3 with `playwright`, `ffmpeg`, and the dependencies of that revision.
Its results go to `/tmp/iskios-demo/out/`.
