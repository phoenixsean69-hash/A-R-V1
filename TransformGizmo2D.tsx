import {
  useEffect,
  useRef,
} from "react";

import type {
  PointerEvent as ReactPointerEvent,
} from "react";

import type {
  ReconstructionPosition,
} from "../../types/reconstruction";

import "./transformGizmo2D.css";

export type TransformGizmoMode =
  | "Move"
  | "Rotate"
  | "Scale";

export interface TransformGizmoValue {
  position:
    ReconstructionPosition;

  rotationDegrees:
    number;

  scale:
    number;
}

interface Props {
  mode:
    TransformGizmoMode;

  value:
    TransformGizmoValue;

  label?:
    string;

  disabled?:
    boolean;

  onChange(
    next:
      TransformGizmoValue,
  ): void;

  onCommit?():
    void;
}

type DragSnapshot = {
  pointerId:
    number;

  mode:
    TransformGizmoMode;

  startValue:
    TransformGizmoValue;

  startClientX:
    number;

  startClientY:
    number;

  centreClientX:
    number;

  centreClientY:
    number;

  startAngle:
    number;

  startDistance:
    number;

  plane:
    DOMRect;
};

function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(
    maximum,
    Math.max(
      minimum,
      value,
    ),
  );
}

function normalizedDegrees(
  value: number,
): number {
  return (
    (
      value %
        360
    ) +
    360
  ) %
    360;
}

function pointerAngle(
  clientX: number,
  clientY: number,
  centreX: number,
  centreY: number,
): number {
  return Math.atan2(
    clientY -
      centreY,
    clientX -
      centreX,
  );
}

function pointerDistance(
  clientX: number,
  clientY: number,
  centreX: number,
  centreY: number,
): number {
  return Math.max(
    8,
    Math.hypot(
      clientX -
        centreX,
      clientY -
        centreY,
    ),
  );
}

function findTransformPlane(
  element:
    HTMLElement,
): HTMLElement | null {
  return (
    element.closest<HTMLElement>(
      "[data-roadsafe-gizmo-plane='true']",
    ) ??
    element.closest<HTMLElement>(
      "[data-roadsafe-2d-projection='true-orthographic-metric']",
    ) ??
    element.closest<HTMLElement>(
      ".reconstruction-workspace__2d-viewport",
    )
  );
}

export default function TransformGizmo2D({
  mode,
  value,
  label,
  disabled = false,
  onChange,
  onCommit,
}: Props) {
  const dragRef =
    useRef<DragSnapshot | null>(
      null,
    );

  /*
   * Escape behaves like Blender's transform cancel: while a handle is being
   * dragged, restore the exact value from pointer-down.
   */
  useEffect(
    () => {
      const handleKeyDown =
        (
          event:
            KeyboardEvent,
        ) => {
          if (
            event.key !==
              "Escape" ||
            !dragRef.current
          ) {
            return;
          }

          event.preventDefault();

          onChange(
            dragRef.current
              .startValue,
          );

          dragRef.current =
            null;

          onCommit?.();
        };

      window.addEventListener(
        "keydown",
        handleKeyDown,
      );

      return () =>
        window.removeEventListener(
          "keydown",
          handleKeyDown,
        );
    },
    [
      onChange,
      onCommit,
    ],
  );

  const beginDrag =
    (
      event:
        ReactPointerEvent<HTMLButtonElement>,
    ) => {
      if (
        disabled
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const plane =
        findTransformPlane(
          event.currentTarget,
        );

      if (!plane) {
        return;
      }

      const rectangle =
        plane.getBoundingClientRect();

      const centreClientX =
        rectangle.left +
        (
          value.position.x /
          100
        ) *
          rectangle.width;

      const centreClientY =
        rectangle.top +
        (
          value.position.y /
          100
        ) *
          rectangle.height;

      event.currentTarget
        .setPointerCapture(
          event.pointerId,
        );

      dragRef.current = {
        pointerId:
          event.pointerId,

        mode,

        startValue: {
          position: {
            ...value.position,
          },

          rotationDegrees:
            value.rotationDegrees,

          scale:
            value.scale,
        },

        startClientX:
          event.clientX,

        startClientY:
          event.clientY,

        centreClientX,

        centreClientY,

        startAngle:
          pointerAngle(
            event.clientX,
            event.clientY,
            centreClientX,
            centreClientY,
          ),

        startDistance:
          pointerDistance(
            event.clientX,
            event.clientY,
            centreClientX,
            centreClientY,
          ),

        plane:
          rectangle,
      };
    };

  const handlePointerMove =
    (
      event:
        ReactPointerEvent<HTMLButtonElement>,
    ) => {
      const drag =
        dragRef.current;

      if (
        !drag ||
        drag.pointerId !==
          event.pointerId
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (
        drag.mode ===
        "Move"
      ) {
        const deltaX =
          (
            (
              event.clientX -
              drag.startClientX
            ) /
            Math.max(
              1,
              drag.plane.width,
            )
          ) *
          100;

        const deltaY =
          (
            (
              event.clientY -
              drag.startClientY
            ) /
            Math.max(
              1,
              drag.plane.height,
            )
          ) *
          100;

        onChange({
          ...drag.startValue,

          position: {
            x:
              clamp(
                drag.startValue
                    .position.x +
                  deltaX,
                0,
                100,
              ),

            y:
              clamp(
                drag.startValue
                    .position.y +
                  deltaY,
                0,
                100,
              ),
          },
        });

        return;
      }

      if (
        drag.mode ===
        "Rotate"
      ) {
        const angle =
          pointerAngle(
            event.clientX,
            event.clientY,
            drag.centreClientX,
            drag.centreClientY,
          );

        const deltaDegrees =
          (
            (
              angle -
              drag.startAngle
            ) *
            180
          ) /
          Math.PI;

        onChange({
          ...drag.startValue,

          rotationDegrees:
            normalizedDegrees(
              drag.startValue
                  .rotationDegrees +
                deltaDegrees,
            ),
        });

        return;
      }

      const distance =
        pointerDistance(
          event.clientX,
          event.clientY,
          drag.centreClientX,
          drag.centreClientY,
        );

      onChange({
        ...drag.startValue,

        scale:
          clamp(
            drag.startValue.scale *
              (
                distance /
                drag.startDistance
              ),
            0.2,
            5,
          ),
      });
    };

  const finishDrag =
    (
      event:
        ReactPointerEvent<HTMLButtonElement>,
    ) => {
      const drag =
        dragRef.current;

      if (
        !drag ||
        drag.pointerId !==
          event.pointerId
      ) {
        return;
      }

      dragRef.current =
        null;

      if (
        event.currentTarget
          .hasPointerCapture(
            event.pointerId,
          )
      ) {
        event.currentTarget
          .releasePointerCapture(
            event.pointerId,
          );
      }

      onCommit?.();
    };

  return (
    <div
      data-scene-interactive="true"
      data-roadsafe-transform-gizmo="2d"
      className={`roadsafe-gizmo2d roadsafe-gizmo2d--${mode.toLowerCase()} ${
        disabled
          ? "is-disabled"
          : ""
      }`}
      style={{
        left:
          `${value.position.x}%`,

        top:
          `${value.position.y}%`,
      }}
    >
      {label && (
        <span className="roadsafe-gizmo2d__label">
          {label}
        </span>
      )}

      {mode ===
        "Move" && (
        <>
          <span className="roadsafe-gizmo2d__move-x" />
          <span className="roadsafe-gizmo2d__move-y" />

          <button
            type="button"
            className="roadsafe-gizmo2d__handle roadsafe-gizmo2d__handle--move"
            title="Move · G"
            aria-label="Move selected item"
            disabled={
              disabled
            }
            onPointerDown={
              beginDrag
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
          />
        </>
      )}

      {mode ===
        "Rotate" && (
        <>
          <span className="roadsafe-gizmo2d__rotate-ring" />

          <button
            type="button"
            className="roadsafe-gizmo2d__handle roadsafe-gizmo2d__handle--rotate"
            title="Rotate · R"
            aria-label="Rotate selected item"
            disabled={
              disabled
            }
            onPointerDown={
              beginDrag
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
          />
        </>
      )}

      {mode ===
        "Scale" && (
        <>
          <span
            className="roadsafe-gizmo2d__scale-frame"
            style={{
              transform:
                `translate(-50%, -50%) scale(${clamp(
                  value.scale,
                  0.55,
                  1.8,
                )})`,
            }}
          />

          <button
            type="button"
            className="roadsafe-gizmo2d__handle roadsafe-gizmo2d__handle--scale"
            title="Scale · S"
            aria-label="Scale selected item"
            disabled={
              disabled
            }
            onPointerDown={
              beginDrag
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
          />
        </>
      )}
    </div>
  );
}
