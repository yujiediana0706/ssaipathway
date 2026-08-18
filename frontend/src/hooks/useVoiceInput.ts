"use client";

import { useState, useRef, useEffect, useCallback } from "react";

// Minimal types for the Web Speech API (not in TS DOM lib by default)
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{
    0: { transcript: string };
    isFinal: boolean;
  }>;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: unknown) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

interface UseVoiceInputOptions {
  lang?: string;
  onFinal?: (text: string) => void;
}

interface UseVoiceInputReturn {
  supported: boolean;
  listening: boolean;
  interim: string;
  start: () => void;
  stop: () => void;
  toggle: () => void;
}

export function useVoiceInput(
  options: UseVoiceInputOptions = {}
): UseVoiceInputReturn {
  const { lang = "zh-CN", onFinal } = options;
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onFinalRef = useRef(onFinal);

  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  useEffect(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setSupported(false);
      return;
    }
    setSupported(true);

    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = false;
    rec.interimResults = true;

    rec.onstart = () => {
      setListening(true);
      setInterim("");
    };

    rec.onresult = (e) => {
      let finalText = "";
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const text = r[0].transcript;
        if (r.isFinal) finalText += text;
        else interimText += text;
      }
      if (interimText) setInterim(interimText);
      if (finalText) {
        setInterim("");
        onFinalRef.current?.(finalText.trim());
      }
    };

    rec.onerror = () => {
      setListening(false);
      setInterim("");
    };

    rec.onend = () => {
      setListening(false);
      setInterim("");
    };

    recognitionRef.current = rec;

    return () => {
      try {
        rec.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    };
  }, [lang]);

  const start = useCallback(() => {
    if (!recognitionRef.current || listening) return;
    try {
      recognitionRef.current.start();
    } catch {
      // start() throws if already started — ignore
    }
  }, [listening]);

  const stop = useCallback(() => {
    if (!recognitionRef.current || !listening) return;
    try {
      recognitionRef.current.stop();
    } catch {
      // ignore
    }
  }, [listening]);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  return { supported, listening, interim, start, stop, toggle };
}
