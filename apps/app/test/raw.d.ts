/** Vite's `?raw` import of a Markdown file: its text, which a test can check without Node's file system. */
declare module "*.md?raw" {
  const text: string;
  export default text;
}

/** Vite's `import.meta.glob`, as a source guard uses it: every matching file's text, loaded eagerly. */
interface ImportMeta {
  glob(
    patterns: ReadonlyArray<string>,
    options: { readonly eager: true; readonly import: "default"; readonly query: "?raw" },
  ): Record<string, string>;
}

/** Source-only rendering guards, loaded by Vite without importing native UI modules. */
declare module "*.tsx?raw" {
  const text: string;
  export default text;
}
