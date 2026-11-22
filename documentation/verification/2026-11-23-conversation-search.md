# Find in conversation

The change was checked on `worktree/conversation-search` against `d37d7b77`.

- `CI=1 bun run test apps/app/test/conversation` checks literal, case-insensitive and blank queries, offscreen message indexes, and wraparound. It also covers the existing Chronicle target and feed ordering rules.
- `bun run check` and `bun run typecheck` passed.

## Window and phone acceptance

1. Open a quest with enough messages to scroll. Pick a word that appears in both old and new messages.
2. Press **Find** and type the word with different capitalization. Check that the newest hit is marked, the count is correct, and the search field keeps focus.
3. Use **Next match** until the oldest hit comes into view, then continue to wrap. Use **Previous match** to go back. Check that surrounding messages remain visible.
4. Change the query to a term with no matches. Check the count and marker, close Find, then open it again and check that the query is blank.
5. Open an errand in another pane and repeat. Each pane should search its own conversation. Repeat on a paired phone and check that all controls fit with the keyboard open.

These acceptance steps still need a live run. The implementation uses React Native 0.88's controlled input and the existing FlatList jump. [TextInput](https://reactnative.dev/docs/0.88/textinput) · [FlatList](https://reactnative.dev/docs/0.88/flatlist)
