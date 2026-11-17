/** Vite's `?raw` import of a Markdown file: its text, which a test can check without Node's file system. */
declare module "*.md?raw" {
  const text: string;
  export default text;
}

/** Source-only rendering guards, loaded by Vite without importing native UI modules. */
declare module "*.tsx?raw" {
  const text: string;
  export default text;
}
