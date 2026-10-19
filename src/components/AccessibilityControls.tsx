import type { AgeProfile } from '../hooks/useAgeProfile';

interface AccessibilityControlsProps {
  readonly profile: AgeProfile;
  readonly onAgeChange: (age: number) => void;
  readonly onVoiceChange: (enabled: boolean) => void;
  readonly onContrastChange: (enabled: boolean) => void;
}

export function AccessibilityControls({
  profile,
  onAgeChange,
  onVoiceChange,
  onContrastChange,
}: AccessibilityControlsProps): JSX.Element {
  return (
    <section className="control-panel" aria-labelledby="accessibility-heading">
      <div className="control-panel__heading">
        <div>
          <p className="eyebrow">Personalize your view</p>
          <h2 id="accessibility-heading">Accessibility controls</h2>
        </div>
        <span className="age-badge">{profile.band}</span>
      </div>
      <label className="field-label" htmlFor="age-range">
        Age <output htmlFor="age-range">{profile.age}</output>
      </label>
      <input
        id="age-range"
        className="range-input"
        type="range"
        min="13"
        max="80"
        value={profile.age}
        onChange={(event) => onAgeChange(Number(event.target.value))}
        aria-describedby="age-help"
      />
      <p id="age-help" className="helper-text">
        Junior: 13–17. Standard: 18–59. Senior: 60–80.
      </p>
      <div className="toggle-row">
        <label>
          <input
            type="checkbox"
            checked={profile.voiceEnabled}
            onChange={(event) => onVoiceChange(event.target.checked)}
          />
          Voice readout
        </label>
        <label>
          <input
            type="checkbox"
            checked={profile.highContrast}
            onChange={(event) => onContrastChange(event.target.checked)}
          />
          High contrast
        </label>
      </div>
    </section>
  );
}
