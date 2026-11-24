# Handoff: Realm mentions with hash

Supersedes: none
Workspace: Outlore, `worktree/realm-hash` based on `b97e071e`, targeting `origin/main`.

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Realms are mentioned with `#` instead of `@`, named like Slack channels (lowercase kebab-case), and a realm tied to no folder shows a hash icon in the sidebar.
Done means the owner sees all three in the running desktop app.

## State

- Verified by `bun run typecheck` in the worktree: every workspace passes, service and app included.
- Verified by `bun test packages/contracts/test/realmSlugs.test.ts apps/app/test/ui`: 64 pass, 0 fail.
- Mentions: `#realm:<id>` is written for realms and `@realm:<id>` is still read (`packages/contracts/src/mentions.ts`); the `#` menu, chips, and the service's mention note follow it.
- Names: `realmSlugOf` (`packages/contracts/src/realmSlugs.ts`) is applied on creation, rename, folder names, repositories, and in migration `0076_realm_slug_names` in `packages/service/src/core/recentStoreMigrations.ts`.
- Sidebar: `RealmMark` in `apps/app/src/shell/railQuests.tsx` shows the folder mark for a realm with a folder and the hash for one without.
- Assumed, not run: the migration against a real database, and the appearance of the `#` menu, the chips, and the hash icon in the running desktop app and on a phone.
- The main checkout holds other threads' uncommitted work (providers, dictation, sidebar, menus); it was not part of this change.

## Decisions

- The hash icon replaces only the missing folder mark: a realm with a folder keeps its folder mark (owner's wording: "the one without folder should have a hash icon instead").
- Old `@realm:` words stay readable so earlier messages keep their chips.
- Two realms that read alike after slugging are left alone, since names stay labels (recorded in CHG-0701).

## Next

1. Open the running desktop app: type `#` in a message, pick a realm, and check the chip, the menu, and the sent message.
2. Rename a realm and create one with spaces, capitals, and accents; check the kebab-case result and the hash icon on a realm without a folder.
3. Start the app on a copy of an existing database and check that migration `0076` slugs the old names.

## Open questions

None.

## Sources

- [Release entry](../../documentation/changelog/0.2.5-Pre-Alpha.md) (CHG-0701)
- [Mention tokens](../../packages/contracts/src/mentions.ts)
- [Realm slugs](../../packages/contracts/src/realmSlugs.ts)
- [Realm migration](../../packages/service/src/core/recentStoreMigrations.ts)
- [Realm row mark](../../apps/app/src/shell/railQuests.tsx)
