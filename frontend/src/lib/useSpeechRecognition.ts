"use client";
import { useCallback, useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface UseSpeechRecognition {
  isSupported: boolean;
  isListening: boolean;
  interim: string;
  error: string | null;
  start: (onFinal: (text: string) => void) => void;
  stop: () => void;
}

export function useSpeechRecognition(): UseSpeechRecognition {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const onFinalRef = useRef<((text: string) => void) | null>(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setIsSupported(false);
      return;
    }
    setIsSupported(true);
    const recog = new SR();
    recog.continuous = true;
    recog.interimResults = true;
    recog.lang = "zh-CN";
    recog.maxAlternatives = 1;

    recog.onresult = (event: any) => {
      let interimText = "";
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const transcript = res[0]?.transcript ?? "";
        if (res.isFinal) finalText += transcript;
        else interimText += transcript;
      }
      if (finalText) onFinalRef.current?.(finalText);
      setInterim(interimText);
    };
    recog.onerror = (e: any) => {
      if (e?.error === "no-speech" || e?.error === "aborted") {
        setIsListening(false);
        setInterim("");
        return;
      }
      setError(e?.error ?? "unknown");
      setIsListening(false);
      setInterim("");
    };
    recog.onend = () => {
      setIsListening(false);
      setInterim("");
    };
    recognitionRef.current = recog;
    return () => {
      try {
        recog.stop();
      } catch (_) {
        /* noop */
      }
    };
  }, []);

  const start = useCallback(
    (onFinal: (text: string) => void) => {
      if (!recognitionRef.current || isListening) return;
      onFinalRef.current = onFinal;
      setError(null);
      setInterim("");
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (_) {
        /* already started */
      }
    },
    [isListening],
  );

  const stop = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch (_) {
      /* noop */
    }
    setIsListening(false);
  }, []);

  return { isSupported, isListening, interim, error, start, stop };
}
