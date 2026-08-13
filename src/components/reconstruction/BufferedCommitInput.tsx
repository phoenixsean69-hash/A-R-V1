import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type InputHTMLAttributes,
  type KeyboardEvent,
} from "react";

/*
 * [RoadSafe:BufferedCanonicalInputV1]
 *
 * Heavy RoadSafe reconstruction state must not be rewritten on every
 * keystroke. This component keeps the raw editing string local while the user
 * types and emits the original native-style onChange only when the edit is
 * committed with Blur or Enter.
 */
type BufferedCommitInputProps =
  Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "value" | "defaultValue"
  > & {
    value?: string | number;
  };

function displayValue(
  value: string | number | undefined,
): string {
  if (
    value === undefined ||
    value === null
  ) {
    return "";
  }

  return String(value);
}

function numericLimit(
  value:
    | string
    | number
    | undefined,
): number | undefined {
  if (
    value === undefined ||
    value === ""
  ) {
    return undefined;
  }

  const parsed =
    Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : undefined;
}

export default function BufferedCommitInput({
  value,
  type,
  min,
  max,
  onChange,
  onFocus,
  onBlur,
  onKeyDown,
  ...inputProps
}: BufferedCommitInputProps) {
  const inputRef =
    useRef<HTMLInputElement | null>(
      null,
    );

  const focusedRef =
    useRef(false);

  const latestValueRef =
    useRef(value);

  const [
    draft,
    setDraft,
  ] =
    useState(
      displayValue(value),
    );

  useEffect(() => {
    latestValueRef.current =
      value;

    if (
      !focusedRef.current
    ) {
      setDraft(
        displayValue(value),
      );
    }
  }, [value]);

  const resetDraft = () => {
    const next =
      displayValue(
        latestValueRef.current,
      );

    setDraft(next);

    if (
      inputRef.current
    ) {
      inputRef.current.value =
        next;
    }
  };

  const emitCommittedChange = (
    committedValue: string,
  ) => {
    const input =
      inputRef.current;

    if (!input) {
      return;
    }

    input.value =
      committedValue;

    const event = {
      target: input,
      currentTarget: input,
    } as ChangeEvent<HTMLInputElement>;

    onChange?.(event);
  };

  const commit = () => {
    let committed =
      draft;

    if (
      type === "number"
    ) {
      const trimmed =
        draft.trim();

      if (
        trimmed === "" ||
        trimmed === "-" ||
        trimmed === "." ||
        trimmed === "-."
      ) {
        resetDraft();
        return;
      }

      let numeric =
        Number(trimmed);

      if (
        !Number.isFinite(
          numeric,
        )
      ) {
        resetDraft();
        return;
      }

      const minimum =
        numericLimit(min);

      const maximum =
        numericLimit(max);

      if (
        minimum !==
        undefined
      ) {
        numeric =
          Math.max(
            minimum,
            numeric,
          );
      }

      if (
        maximum !==
        undefined
      ) {
        numeric =
          Math.min(
            maximum,
            numeric,
          );
      }

      committed =
        String(numeric);
    }

    const previous =
      displayValue(
        latestValueRef.current,
      );

    setDraft(committed);

    if (
      committed ===
      previous
    ) {
      return;
    }

    emitCommittedChange(
      committed,
    );
  };

  const handleFocus = (
    event:
      FocusEvent<HTMLInputElement>,
  ) => {
    focusedRef.current =
      true;

    onFocus?.(event);
  };

  const handleBlur = (
    event:
      FocusEvent<HTMLInputElement>,
  ) => {
    commit();

    focusedRef.current =
      false;

    onBlur?.(event);
  };

  const handleKeyDown = (
    event:
      KeyboardEvent<HTMLInputElement>,
  ) => {
    if (
      event.key ===
      "Enter"
    ) {
      event.preventDefault();

      commit();

      inputRef.current?.blur();
    } else if (
      event.key ===
      "Escape"
    ) {
      event.preventDefault();

      resetDraft();

      inputRef.current?.blur();
    }

    onKeyDown?.(event);
  };

  return (
    <input
      {...inputProps}
      ref={inputRef}
      type={type}
      min={min}
      max={max}
      value={draft}
      data-roadsafe-buffered-input="true"
      onChange={(event) =>
        setDraft(
          event.target.value,
        )
      }
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  );
}
