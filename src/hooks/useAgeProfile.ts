import { useEffect, useMemo, useState } from 'react';

export type AgeBand = 'JUNIOR' | 'STANDARD' | 'SENIOR';

export interface AgeProfile {
  readonly age: number;
  readonly band: AgeBand;
  readonly fontSize: 'base' | 'access-xl' | 'access-2xl';
  readonly voiceEnabled: boolean;
  readonly simplifiedLanguage: boolean;
  readonly highContrast: boolean;
}

const AGE_STORAGE_KEY = 'tradesetu.age';
const MIN_AGE = 13;
const MAX_AGE = 80;

function clampAge(value: number): number {
  if (!Number.isFinite(value)) {
    return 25;
  }
  return Math.min(MAX_AGE, Math.max(MIN_AGE, Math.round(value)));
}

function storedAge(initialAge: number): number {
  if (typeof window === 'undefined') {
    return clampAge(initialAge);
  }
  const savedAge: string | null = window.localStorage.getItem(AGE_STORAGE_KEY);
  return savedAge === null ? clampAge(initialAge) : clampAge(Number(savedAge));
}

function getBand(age: number): AgeBand {
  return age < 18 ? 'JUNIOR' : age >= 60 ? 'SENIOR' : 'STANDARD';
}

export function useAgeProfile(initialAge: number = 25): {
  profile: AgeProfile;
  updateAge: (value: number) => void;
  setVoiceEnabled: (enabled: boolean) => void;
  setHighContrast: (enabled: boolean) => void;
  speak: (text: string) => void;
} {
  const [age, setAge] = useState<number>(() => storedAge(initialAge));
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(false);
  const [highContrast, setHighContrast] = useState<boolean>(false);
  const band: AgeBand = getBand(age);

  useEffect(() => {
    document.documentElement.dataset.ageBand = band;
  }, [band]);

  useEffect(() => {
    document.documentElement.dataset.contrast = highContrast ? 'high' : 'normal';
  }, [highContrast]);

  useEffect(() => {
    try {
      window.localStorage.setItem(AGE_STORAGE_KEY, String(age));
    } catch {
      return;
    }
  }, [age]);

  const profile: AgeProfile = useMemo(() => ({
    age,
    band,
    fontSize: band === 'JUNIOR' ? 'access-xl' : band === 'SENIOR' ? 'access-2xl' : 'base',
    voiceEnabled,
    simplifiedLanguage: band === 'JUNIOR',
    highContrast,
  }), [age, band, highContrast, voiceEnabled]);

  function updateAge(value: number): void {
    setAge(clampAge(value));
  }

  function speak(text: string): void {
    if (!voiceEnabled || typeof window === 'undefined' || !window.speechSynthesis) {
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const utterance: SpeechSynthesisUtterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-IN';
      utterance.rate = band === 'SENIOR' ? 0.9 : 1;
      window.speechSynthesis.speak(utterance);
    } catch {
      return;
    }
  }

  return { profile, updateAge, setVoiceEnabled, setHighContrast, speak };
}
