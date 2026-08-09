import type {
  ForensicTerrainGrid,
} from "../../types/forensicScenePipeline";

interface Props {
  terrain:
    ForensicTerrainGrid |
    undefined;
}

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

export default function ForensicTerrainPlanOverlay({
  terrain,
}: Props) {
  if (
    !terrain ||
    terrain.status !==
      "ready" ||
    terrain.rows <
      2 ||
    terrain.columns <
      2 ||
    terrain.elevationsMetres.length !==
      terrain.rows *
        terrain.columns
  ) {
    return null;
  }

  const range =
    Math.max(
      0.001,
      terrain.maximumElevationMetres -
        terrain.minimumElevationMetres,
    );

  const cellWidth =
    100 /
    (
      terrain.columns -
      1
    );

  const cellHeight =
    100 /
    (
      terrain.rows -
      1
    );

  const cells:
    Array<{
      key: string;
      x: number;
      y: number;
      value: number;
    }> =
    [];

  const valueAt =
    (
      row: number,
      column: number,
    ) =>
      terrain.elevationsMetres[
        row *
          terrain.columns +
          column
      ] ??
      terrain.meanElevationMetres;

  for (
    let row =
      0;
    row <
      terrain.rows -
        1;
    row +=
      1
  ) {
    for (
      let column =
        0;
      column <
        terrain.columns -
          1;
      column +=
        1
    ) {
      const value =
        (
          valueAt(
            row,
            column,
          ) +
          valueAt(
            row,
            column +
              1,
          ) +
          valueAt(
            row +
              1,
            column,
          ) +
          valueAt(
            row +
              1,
            column +
              1,
          )
        ) /
        4;

      cells.push({
        key:
          `${row}:${column}`,
        x:
          column *
          cellWidth,

        /*
         * Terrain rows are south -> north; SVG y is top -> bottom.
         */
        y:
          100 -
          (
            row +
            1
          ) *
            cellHeight,
        value,
      });
    }
  }

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[1] overflow-hidden"
      data-roadsafe-terrain-plan="dem"
      aria-hidden="true"
    >
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {cells.map(
          (
            cell,
          ) => {
            const normalized =
              clamp(
                (
                  cell.value -
                  terrain.minimumElevationMetres
                ) /
                  range,
                0,
                1,
              );

            const opacity =
              0.04 +
              normalized *
                0.09;

            return (
              <rect
                key={
                  cell.key
                }
                x={
                  cell.x
                }
                y={
                  cell.y
                }
                width={
                  cellWidth +
                  0.08
                }
                height={
                  cellHeight +
                  0.08
                }
                fill={`rgba(205,214,203,${opacity.toFixed(
                  3,
                )})`}
              />
            );
          },
        )}
      </svg>

      <div className="absolute bottom-2 left-2 rounded-sm border border-[#494949] bg-[#292929]/88 px-2 py-1 text-[7px] font-semibold text-[#a7a7a7]">
        DEM · {terrain.reliefMetres.toFixed(
          2,
        )} m relief · ~
        {terrain.nominalResolutionMetres} m
      </div>
    </div>
  );
}
