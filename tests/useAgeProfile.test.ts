// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAgeProfile } from '../src/hooks/useAgeProfile';

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.dataset.ageBand = '';
  document.documentElement.dataset.contrast = '';
  vi.stubGlobal('speechSynthesis', {
    cancel: vi.fn(),
    speak: vi.fn(),
  });
  vi.stubGlobal('SpeechSynthesisUtterance', class {
    public lang: string = '';
    public rate: number = 1;
  });
});

describe('useAgeProfile', () => {
  it('defaults to age 25 and standard mode', () => {
    const { result } = renderHook(() => useAgeProfile());
    expect(result.current.profile.age).toBe(25);
    expect(result.current.profile.band).toBe('STANDARD');
  });

  it('clamps ages and selects the correct bands', () => {
    const { result } = renderHook(() => useAgeProfile());
    act(() => result.current.updateAge(5));
    expect(result.current.profile.age).toBe(13);
    expect(result.current.profile.band).toBe('JUNIOR');
    act(() => result.current.updateAge(15));
    expect(result.current.profile.band).toBe('JUNIOR');
    act(() => result.current.updateAge(30));
    expect(result.current.profile.band).toBe('STANDARD');
    act(() => result.current.updateAge(100));
    expect(result.current.profile.age).toBe(80);
    expect(result.current.profile.band).toBe('SENIOR');
    expect(window.localStorage.getItem('tradesetu.age')).toBe('80');
  });

  it('sets document accessibility attributes and speaks in the selected mode', () => {
    const { result } = renderHook(() => useAgeProfile(65));
    expect(document.documentElement.dataset.ageBand).toBe('SENIOR');
    act(() => result.current.setHighContrast(true));
    expect(document.documentElement.dataset.contrast).toBe('high');
    act(() => result.current.setVoiceEnabled(true));
    act(() => result.current.speak('A result is ready.'));
    expect(window.speechSynthesis.cancel).toHaveBeenCalled();
    expect(window.speechSynthesis.speak).toHaveBeenCalled();
  });
});
