import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionResultListLike {
  length: number;
  [index: number]: SpeechRecognitionResultLike;
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionErrorEventLike extends Event {
  error?: string;
  message?: string;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionConstructorLike {
  new (): SpeechRecognitionLike;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructorLike;
    webkitSpeechRecognition?: SpeechRecognitionConstructorLike;
  }
}

interface UseSpeechDictationOptions {
  language?: string;
  onFinalText: (text: string) => void;
}

export function useSpeechDictation({
  language = "en-ZW",
  onFinalText,
}: UseSpeechDictationOptions) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onFinalTextRef = useRef(onFinalText);
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [error, setError] = useState("");

  const Recognition =
    typeof window !== "undefined"
      ? window.SpeechRecognition ?? window.webkitSpeechRecognition
      : undefined;

  const supported = Boolean(Recognition);

  useEffect(() => {
    onFinalTextRef.current = onFinalText;
  }, [onFinalText]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
    setInterimText("");
  }, []);

  const start = useCallback(() => {
    if (!Recognition) {
      setError(
        "Voice dictation is not available in this browser. Use a recent Chrome or Edge browser.",
      );
      return;
    }

    recognitionRef.current?.abort();

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;

    recognition.onresult = (event) => {
      let finalText = "";
      let liveText = "";

      for (
        let index = event.resultIndex;
        index < event.results.length;
        index += 1
      ) {
        const result = event.results[index];
        const transcript = result[0]?.transcript?.trim() ?? "";

        if (!transcript) continue;
        if (result.isFinal) finalText += `${transcript} `;
        else liveText += `${transcript} `;
      }

      setInterimText(liveText.trim());

      const cleanFinal = finalText.trim();
      if (cleanFinal) {
        onFinalTextRef.current(cleanFinal);
      }
    };

    recognition.onerror = (event) => {
      const reason = event.error ?? event.message ?? "unknown error";

      if (reason === "not-allowed" || reason === "service-not-allowed") {
        setError(
          "Microphone access was denied. Allow microphone permission and try again.",
        );
      } else if (reason === "no-speech") {
        setError("No speech was detected. Speak clearly and try again.");
      } else {
        setError(`Voice dictation stopped: ${reason}.`);
      }

      setListening(false);
      setInterimText("");
    };

    recognition.onend = () => {
      setListening(false);
      setInterimText("");
    };

    setError("");
    setInterimText("");
    setListening(true);
    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (startError) {
      setListening(false);
      setError(
        startError instanceof Error
          ? startError.message
          : "Voice dictation could not be started.",
      );
    }
  }, [Recognition, language]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  return {
    supported,
    listening,
    interimText,
    error,
    start,
    stop,
    clearError: () => setError(""),
  };
}
