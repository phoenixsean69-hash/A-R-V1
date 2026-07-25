const EDITOR_SELECTOR = ".reconstruction-editor";
const PARTICIPANT_SELECTOR = "[data-playback-participant-id]";
const RESET_BUTTON_SELECTOR = 'button[title="Reset playback"]';

declare global {
  interface Window {
    __roadSafeParticipantAnchorSyncInstalled?: boolean;
  }
}

const knownParticipantIds = new WeakMap<HTMLElement, Set<string>>();

function getParticipantIds(editor: HTMLElement): Set<string> {
  return new Set(
    Array.from(
      editor.querySelectorAll<HTMLElement>(PARTICIPANT_SELECTOR),
    )
      .map((element) => element.dataset.playbackParticipantId ?? "")
      .filter(Boolean),
  );
}

function resetPlaybackToPointOne(editor: HTMLElement): void {
  const resetButton =
    editor.querySelector<HTMLButtonElement>(RESET_BUTTON_SELECTOR);

  if (resetButton && !resetButton.disabled) {
    resetButton.click();
    return;
  }

  const scrubber = editor.querySelector<HTMLInputElement>(
    '.reconstruction-playback__scrubber input[type="range"]',
  );

  if (!scrubber) return;

  const nativeValueSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;

  if (nativeValueSetter) {
    nativeValueSetter.call(scrubber, "0");
  } else {
    scrubber.value = "0";
  }

  scrubber.dispatchEvent(
    new Event("input", {
      bubbles: true,
    }),
  );
  scrubber.dispatchEvent(
    new Event("change", {
      bubbles: true,
    }),
  );
}

function synchroniseEditor(editor: HTMLElement): void {
  const nextIds = getParticipantIds(editor);
  const previousIds = knownParticipantIds.get(editor);

  if (!previousIds) {
    knownParticipantIds.set(editor, nextIds);
    return;
  }

  const participantWasAdded =
    nextIds.size > previousIds.size ||
    Array.from(nextIds).some((id) => !previousIds.has(id));

  knownParticipantIds.set(editor, nextIds);

  if (!participantWasAdded) return;

  /*
   * Wait until React has committed the participant and Point 1 marker.
   * The editor's own Reset action then updates React state, the playback
   * clock and both the 2D and 3D participant state consistently.
   */
  window.requestAnimationFrame(() => {
    resetPlaybackToPointOne(editor);
  });
}

function scanEditors(root: ParentNode = document): void {
  root
    .querySelectorAll<HTMLElement>(EDITOR_SELECTOR)
    .forEach(synchroniseEditor);
}

export function installParticipantAnchorSynchronization(): void {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    window.__roadSafeParticipantAnchorSyncInstalled
  ) {
    return;
  }

  window.__roadSafeParticipantAnchorSyncInstalled = true;

  const observer = new MutationObserver((records) => {
    const editors = new Set<HTMLElement>();

    records.forEach((record) => {
      const mutationTarget =
        record.target instanceof HTMLElement
          ? record.target
          : record.target.parentElement;

      const targetEditor = mutationTarget?.closest<HTMLElement>(
        EDITOR_SELECTOR,
      );

      if (targetEditor) {
        editors.add(targetEditor);
      }

      record.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;

        const addedEditor = node.matches(EDITOR_SELECTOR)
          ? node
          : node.querySelector<HTMLElement>(EDITOR_SELECTOR);

        if (addedEditor) {
          editors.add(addedEditor);
        }

        const participantEditor = node.matches(PARTICIPANT_SELECTOR)
          ? node.closest<HTMLElement>(EDITOR_SELECTOR)
          : node
              .querySelector<HTMLElement>(PARTICIPANT_SELECTOR)
              ?.closest<HTMLElement>(EDITOR_SELECTOR);

        if (participantEditor) {
          editors.add(participantEditor);
        }
      });
    });

    editors.forEach(synchroniseEditor);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  scanEditors();
}
