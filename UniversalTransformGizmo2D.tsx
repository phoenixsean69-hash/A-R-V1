import {
  useRef,
} from "react";

import type {
  PointerEvent as ReactPointerEvent,
} from "react";

import type {
  UniversalTransformMode,
  UniversalTransformValue,
} from "../../types/reconstructionTransform";

import "./universalTransformGizmo.css";

interface Props {
  mode:
    UniversalTransformMode;

  value:
    UniversalTransformValue;

  disabled?:
    boolean;

  label?:
    string;

  onChange(
    next:
      UniversalTransformValue,
  ): void;

  onCommit?():
    void;
}

type DragState =
  | {
      mode:
        "Move";
      pointerId:
        number;
      startClientX:
        number;
      startClientY:
        number;
      startValue:
        UniversalTransformValue;
      plane:
        DOMRect;
    }
  | {
      mode:
        "Rotate";
      pointerId:
        number;
      centreX:
        number;
      centreY:
        number;
      startAngle:
        number;
      startValue:
        UniversalTransformValue;
    }
  | {
      mode:
        "Scale";
      pointerId:
        number;
      centreX:
        number;
      centreY:
        number;
      startDistance:
        number;
      startValue:
        UniversalTransformValue;
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

function normalizeDegrees(
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

function distance(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  return Math.hypot(
    x2 -
      x1,
    y2 -
      y1,
  );
}

function planeRect(
  element:
    HTMLElement,
): DOMRect {
  const plane =
    element.closest<HTMLElement>(
      "[data-roadsafe-transform-plane='true'], [data-roadsafe-2d-projection='true-orthographic-metric']",
    ) ??
    element.closest<HTMLElement>(
      ".reconstruction-workspace__2d-viewport",
    );

  return (
    plane ??
    element
  ).getBoundingClientRect();
}

export default function UniversalTransformGizmo2D({
  mode,
  value,
  disabled = false,
  label,
  onChange,
  onCommit,
}: Props) {
  const dragRef =
    useRef<DragState | null>(
      null,
    );

  const beginMove =
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

      event.currentTarget.setPointerCapture(
        event.pointerId,
      );

      dragRef.current = {
        mode:
          "Move",
        pointerId:
          event.pointerId,
        startClientX:
          event.clientX,
        startClientY:
          event.clientY,
        startValue:
          value,
        plane:
          planeRect(
            event.currentTarget,
          ),
      };
    };

  const beginRotate =
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

      const bounds =
        planeRect(
          event.currentTarget,
        );

      const centreX =
        bounds.left +
        (
          value.position.x /
          100
        ) *
          bounds.width;

      const centreY =
        bounds.top +
        (
          value.position.y /
          100
        ) *
          bounds.height;

      event.currentTarget.setPointerCapture(
        event.pointerId,
      );

      dragRef.current = {
        mode:
          "Rotate",
        pointerId:
          event.pointerId,
        centreX,
        centreY,
        startAngle:
          Math.atan2(
            event.clientY -
              centreY,
            event.clientX -
              centreX,
          ),
        startValue:
          value,
      };
    };

  const beginScale =
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

      const bounds =
        planeRect(
          event.currentTarget,
        );

      const centreX =
        bounds.left +
        (
          value.position.x /
          100
        ) *
          bounds.width;

      const centreY =
        bounds.top +
        (
          value.position.y /
          100
        ) *
          bounds.height;

      event.currentTarget.setPointerCapture(
        event.pointerId,
      );

      dragRef.current = {
        mode:
          "Scale",
        pointerId:
          event.pointerId,
        centreX,
        centreY,
        startDistance:
          Math.max(
            8,
            distance(
              centreX,
              centreY,
              event.clientX,
              event.clientY,
            ),
          ),
        startValue:
          value,
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
                drag.startValue.position.x +
                  deltaX,
                0,
                100,
              ),

            y:
              clamp(
                drag.startValue.position.y +
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
          Math.atan2(
            event.clientY -
              drag.centreY,
            event.clientX -
              drag.centreX,
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
            normalizeDegrees(
              drag.startValue.rotationDegrees +
                deltaDegrees,
            ),
        });

        return;
      }

      const nextDistance =
        Math.max(
          8,
          distance(
            drag.centreX,
            drag.centreY,
            event.clientX,
            event.clientY,
          ),
        );

      onChange({
        ...drag.startValue,

        scale:
          clamp(
            drag.startValue.scale *
              (
                nextDistance /
                drag.startDistance
              ),
            0.2,
            5,
          ),
      });
    };

  const endDrag =
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
        event.currentTarget.hasPointerCapture(
          event.pointerId,
        )
      ) {
        event.currentTarget.releasePointerCapture(
          event.pointerId,
        );
      }

      onCommit?.();
    };

  return (
    <div
      className={`roadsafe-transform-gizmo roadsafe-transform-gizmo--${mode.toLowerCase()} ${
        disabled
          ? "is-disabled"
          : ""
      }`}
      data-scene-interactive="true"
      style={{
        left:
          `${value.position.x}%`,
        top:
          `${value.position.y}%`,
        rotate:
          `${value.rotationDegrees}deg`,
      }}
    >
      {label && (
        <span className="roadsafe-transform-gizmo__label">
          {label}
        </span>
      )}

      {mode ===
        "Move" && (
        <>
          <span className="roadsafe-transform-gizmo__axis roadsafe-transform-gizmo__axis--x" />
          <span className="roadsafe-transform-gizmo__axis roadsafe-transform-gizmo__axis--y" />

          <button
            type="button"
            className="roadsafe-transform-gizmo__handle roadsafe-transform-gizmo__handle--move"
            aria-label="Move selected object"
            title="Move · G"
            onPointerDown={
              beginMove
            }
            onPointerMove={
              handlePointerMove
            }
            onPointerUp={
              endDrag
            }
            onPointerCancel={
              endDrag
            }
          />
        </>
      )}

      {mode ===
        "Rotate" && (
        <>
          <span className="roadsafe-transform-gizmo__rotate-ring" />

          <button
            type="button"
            className="roadsafe-transform-gizmo__handle roadsafe-transform-gizmo__handle--rotate"
            aria-label="Rotate selected object"
            title="Rotate · R"
            onPointerDown={
              beginRotate
            }
            onPointerMove={
              handlePointerMove
            }
            onPointerUp={
              endDrag
            }
            onPointerCancel={
              endDrag
            }
          />
        </>
      )}

      {mode ===
        "Scale" && (
        <>
          <span
            className="roadsafe-transform-gizmo__scale-box"
            style={{
              scale:
                String(
                  clamp(
                    value.scale,
                    0.45,
                    2.3,
                  ),
                ),
            }}
          />

          <button
            type="button"
            className="roadsafe-transform-gizmo__handle roadsafe-transform-gizmo__handle--scale"
            aria-label="Scale selected object"
            title="Scale · S"
            onPointerDown={
              beginScale
            }
            onPointerMove={
              handlePointerMove
            }
            onPointerUp={
              endDrag
            }
            onPointerCancel={
              endDrag
            }
          />
        </>
      )}
    </div>
  );
}
