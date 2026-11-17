import { useState } from "react";

/** Copies text to the clipboard and remembers which one was copied last, so its button can say "Copied". */
export function useCopiedText() {
  const [copied, setCopied] = useState<string | null>(null);
  return {
    copied,
    copy: (key: string, text: string) =>
      navigator.clipboard?.writeText(text).then(
        () => setCopied(key),
        () => setCopied(null),
      ),
  };
}
