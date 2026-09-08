import {
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  createPortal,
} from "react-dom";

import {
  X,
} from "../icons/materialIcons";

import "./SelectedAreaDetailsWindow.css";

interface SelectedAreaDetailsWindowProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  onClose(): void;
}

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
}

export default function SelectedAreaDetailsWindow({
  title,
  subtitle,
  children,
  onClose,
}: SelectedAreaDetailsWindowProps) {
  const [offset, setOffset] =
    useState({
      x: 0,
      y: 0,
    });

  const [dragging, setDragging] =
    useState(false);

  const dragRef =
    useRef<DragState | null>(
      null,
    );

  function handlePointerDown(
    event:
      ReactPointerEvent<HTMLElement>,
  ): void {
    if (event.button !== 0) {
      return;
    }

    const target =
      event.target as HTMLElement;

    if (
      target.closest(
        "button, a, input, select, textarea",
      )
    ) {
      return;
    }

    dragRef.current = {
      pointerId:
        event.pointerId,
      startX:
        event.clientX,
      startY:
        event.clientY,
      originX:
        offset.x,
      originY:
        offset.y,
    };

    event.currentTarget
      .setPointerCapture(
        event.pointerId,
      );

    setDragging(true);
  }

  function handlePointerMove(
    event:
      ReactPointerEvent<HTMLElement>,
  ): void {
    const drag =
      dragRef.current;

    if (
      !drag ||
      drag.pointerId !==
        event.pointerId
    ) {
      return;
    }

    setOffset({
      x:
        drag.originX +
        event.clientX -
        drag.startX,

      y:
        drag.originY +
        event.clientY -
        drag.startY,
    });
  }

  function finishDrag(
    event:
      ReactPointerEvent<HTMLElement>,
  ): void {
    if (
      dragRef.current
        ?.pointerId !==
      event.pointerId
    ) {
      return;
    }

    try {
      event.currentTarget
        .releasePointerCapture(
          event.pointerId,
        );
    } catch {
      // Pointer capture may already be released.
    }

    dragRef.current = null;
    setDragging(false);
  }

  if (
    typeof document ===
    "undefined"
  ) {
    return null;
  }

  return createPortal(
    <div className="roadsafe-area-details-layer">
      <section
        className={`roadsafe-area-details-window ${
          dragging
            ? "is-dragging"
            : ""
        }`}
        style={{
          transform:
            `translate(${offset.x}px, ${offset.y}px)`,
        }}
        role="dialog"
        aria-modal="false"
        aria-label={title}
      >
        <header
          className="roadsafe-area-details-header"
          onPointerDown={
            handlePointerDown
          }
          onPointerMove={
            handlePointerMove
          }
          onPointerUp={
            finishDrag
          }
          onPointerCancel={
            finishDrag
          }
          onDoubleClick={() =>
            setOffset({
              x: 0,
              y: 0,
            })
          }
        >
          <div className="roadsafe-area-details-title">
            <span>
              Spatial analysis
            </span>

            <strong>
              {title}
            </strong>

            <small>
              {subtitle}
            </small>
          </div>

          <button
            type="button"
            className="ui-icon-button roadsafe-area-details-close"
            onPointerDown={(
              event,
            ) =>
              event.stopPropagation()
            }
            onClick={onClose}
            aria-label="Close selected area details"
          >
            <X
              size={15}
              strokeWidth={1.8}
            />
          </button>
        </header>

        <div className="roadsafe-area-details-body">
          {children}
        </div>
      </section>
    </div>,
    document.body,
  );
}