import { useEffect, useRef, useState } from "react";
import { base64Of } from "../attachments/attachments";
import { messageOf, type ServiceClient } from "../foundation/client";
import { type DictationPhase, microphoneRefusalOf, transcriptOutcomeOf } from "./dictation";
import { isRecordingSupported, startRecording } from "./recorder";
import type { Recording } from "./recorderTypes";

/**
 * One message box's dictation (voice-input): a press asks the host whether it can transcribe, then listens; a second
 * press stops and sends the recording to the host, and the words it heard go to `onWords`. Nothing is sent as a
 * message: the owner reads the words in the box and sends them as typed text. A null client offers no dictation.
 */
export function useDictation(client: ServiceClient | null, onWords: (words: string) => void) {
  const [phase, setPhase] = useState<DictationPhase>("Idle");
  const [error, setError] = useState<string | null>(null);
  const recording = useRef<Recording | null>(null);
  // Bumped by a cancel and when the box closes, so an answer that arrives afterwards changes nothing.
  const generation = useRef(0);
  const words = useRef(onWords);
  words.current = onWords;

  useEffect(
    () => () => {
      generation.current += 1;
      recording.current?.cancel();
      recording.current = null;
    },
    [],
  );

  const finish = async (service: ServiceClient) => {
    const current = recording.current;
    if (current === null) return;
    recording.current = null;
    const started = generation.current;
    const wav = current.stop();
    if (wav === null) {
      setPhase("Idle");
      return setError("No words were heard.");
    }
    setPhase("Transcribing");
    try {
      const heard = await service.request({ _tag: "TranscribeDictation", data: await base64Of(new Blob([wav])) });
      if (generation.current !== started) return;
      const outcome = transcriptOutcomeOf(heard.text);
      setError(outcome.reason);
      if (outcome.text !== null) words.current(outcome.text);
    } catch (reason) {
      if (generation.current === started) setError(messageOf(reason));
    } finally {
      if (generation.current === started) setPhase("Idle");
    }
  };

  const begin = async (service: ServiceClient) => {
    const started = generation.current;
    setPhase("Checking");
    setError(null);
    try {
      const status = await service.request({ _tag: "ReadDictation" });
      if (generation.current !== started) return;
      if (status.unavailableReason !== null) {
        setError(status.unavailableReason);
        return setPhase("Idle");
      }
      const opened = await startRecording(() => void finish(service)).catch((reason: Error) => {
        throw new Error(microphoneRefusalOf(reason.name));
      });
      if (generation.current !== started) return opened.cancel();
      recording.current = opened;
      setPhase("Listening");
    } catch (reason) {
      if (generation.current !== started) return;
      setError(messageOf(reason));
      setPhase("Idle");
    }
  };

  /** The microphone button: starts listening when idle, stops and transcribes while listening. */
  const press = () => {
    if (client === null) return;
    if (phase === "Idle") void begin(client);
    else if (phase === "Listening") void finish(client);
  };

  /** Drops what is being dictated or transcribed; the text already in the box stays as it was. */
  const cancel = () => {
    generation.current += 1;
    recording.current?.cancel();
    recording.current = null;
    setPhase("Idle");
  };

  return { cancel, error, isAvailable: client !== null && isRecordingSupported, phase, press };
}
