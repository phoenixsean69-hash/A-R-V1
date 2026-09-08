interface SettingsToggleProps {
  checked: boolean;
  disabled?: boolean;
  label: string;
  description: string;
  onChange(
    checked: boolean,
  ): void;
}

export default function SettingsToggle({
  checked,
  disabled = false,
  label,
  description,
  onChange,
}: SettingsToggleProps) {
  return (
    <label
      className={`roadsafe-settings-toggle ${
        disabled
          ? "is-disabled"
          : ""
      }`}
    >
      <span className="roadsafe-settings-toggle__copy">
        <strong>
          {label}
        </strong>

        <small>
          {description}
        </small>
      </span>

      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) =>
          onChange(
            event.target.checked,
          )
        }
      />

      <span
        className="roadsafe-settings-switch"
        aria-hidden="true"
      >
        <span />
      </span>
    </label>
  );
}