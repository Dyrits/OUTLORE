/** One dictation being recorded: stopped for its WAV file (null when nothing was heard), or cancelled and dropped. */
export interface Recording {
  readonly cancel: () => void;
  readonly stop: () => Uint8Array<ArrayBuffer> | null;
}
