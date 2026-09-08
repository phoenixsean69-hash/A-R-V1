import {
  useMemo,
  useState,
} from "react";
import { Link } from "react-router-dom";

import {
  BarChart3,
} from "../icons/materialIcons";

import "./StationOverviewCharts.css";

export interface StationActivityPoint {
  label: string;
  accidents: number;
  cases: number;
  total: number;
}

interface StationOverviewChartsProps {
  data: StationActivityPoint[];
}

interface PlotPoint {
  x: number;
  y: number;
}

const VIEWBOX_WIDTH = 760;
const VIEWBOX_HEIGHT = 280;

const PLOT_LEFT = 52;
const PLOT_RIGHT = 728;
const PLOT_TOP = 30;
const PLOT_BOTTOM = 222;

function buildTotalPoints(
  data: StationActivityPoint[],
): PlotPoint[] {
  const maxValue = Math.max(
    1,
    ...data.map((item) => item.total),
  );

  const plotWidth =
    PLOT_RIGHT - PLOT_LEFT;

  const plotHeight =
    PLOT_BOTTOM - PLOT_TOP;

  return data.map((item, index) => {
    const x =
      data.length <= 1
        ? (PLOT_LEFT + PLOT_RIGHT) / 2
        : PLOT_LEFT +
          (index * plotWidth) /
            (data.length - 1);

    const y =
      PLOT_BOTTOM -
      (item.total / maxValue) *
        plotHeight;

    return { x, y };
  });
}

function buildLinePath(
  points: PlotPoint[],
): string {
  return points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`,
    )
    .join(" ");
}

export default function StationOverviewCharts({
  data,
}: StationOverviewChartsProps) {
  const [hoveredIndex, setHoveredIndex] =
    useState<number | null>(null);

  const totalPoints = useMemo(
    () => buildTotalPoints(data),
    [data],
  );

  const totalLinePath = useMemo(
    () => buildLinePath(totalPoints),
    [totalPoints],
  );

  const maxValue = Math.max(
    1,
    ...data.map((item) =>
      Math.max(
        item.cases,
        item.accidents,
        item.total,
      ),
    ),
  );

  const hovered =
    hoveredIndex === null
      ? null
      : data[hoveredIndex];

  const hoveredPoint =
    hoveredIndex === null
      ? null
      : totalPoints[hoveredIndex];

  if (data.length === 0) {
    return (
      <article className="station-overview-combined-chart station-overview-combined-chart--empty">
        <BarChart3
          size={28}
          strokeWidth={1.5}
        />

        <div>
          <strong>
            Monthly record activity
          </strong>
          <span>
            No dated station activity is available yet.
          </span>
        </div>
      </article>
    );
  }

  return (
    <article
      className="station-overview-combined-chart"
      onMouseLeave={() =>
        setHoveredIndex(null)
      }
    >
      <header className="station-overview-combined-chart__header">
        <div className="station-overview-combined-chart__heading">
          <span className="station-overview-combined-chart__icon">
            <BarChart3
              size={20}
              strokeWidth={1.6}
            />
          </span>

          <div>
            <p>
              Monthly activity
            </p>

            <strong>
              Cases, accident records and total
            </strong>
          </div>
        </div>

        <Link
          to="/analytics"
          className="station-overview-combined-chart__link"
        >
          Open analytics
        </Link>
      </header>

      <div className="station-overview-combined-chart__legend">
        <span>
          <i className="is-cases" />
          Cases
        </span>

        <span>
          <i className="is-accidents" />
          Accident records
        </span>

        <span>
          <i className="is-total" />
          Total
        </span>
      </div>

      <div className="station-overview-combined-chart__plot">
        <svg
          viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
          preserveAspectRatio="none"
          role="img"
          aria-label="Monthly cases, accident records and total"
        >
          {[0, 1, 2, 3].map(
            (row) => {
              const y =
                PLOT_TOP +
                ((PLOT_BOTTOM -
                  PLOT_TOP) /
                  3) *
                  row;

              const value =
                Math.round(
                  maxValue *
                    (1 - row / 3),
                );

              return (
                <g key={row}>
                  <line
                    className="station-overview-combined-chart__grid"
                    x1={PLOT_LEFT}
                    y1={y}
                    x2={PLOT_RIGHT}
                    y2={y}
                  />

                  <text
                    className="station-overview-combined-chart__y-label"
                    x={PLOT_LEFT - 12}
                    y={y + 4}
                    textAnchor="end"
                  >
                    {value}
                  </text>
                </g>
              );
            },
          )}

          <text
            className="station-overview-combined-chart__axis-label"
            x={15}
            y={
              (PLOT_TOP +
                PLOT_BOTTOM) /
              2
            }
            transform={`rotate(-90 15 ${
              (PLOT_TOP +
                PLOT_BOTTOM) /
              2
            })`}
            textAnchor="middle"
          >
            Records
          </text>

          {hoveredPoint && (
            <rect
              className="station-overview-combined-chart__hover-band"
              x={
                hoveredPoint.x -
                Math.max(
                  18,
                  (PLOT_RIGHT -
                    PLOT_LEFT) /
                    data.length /
                    2,
                )
              }
              y={PLOT_TOP}
              width={Math.max(
                36,
                (PLOT_RIGHT -
                  PLOT_LEFT) /
                  data.length,
              )}
              height={
                PLOT_BOTTOM -
                PLOT_TOP
              }
            />
          )}

          {data.map(
            (item, index) => {
              const point =
                totalPoints[index];

              const groupWidth =
                Math.min(
                  54,
                  (PLOT_RIGHT -
                    PLOT_LEFT) /
                    Math.max(
                      data.length,
                      1,
                    ) *
                    0.62,
                );

              const barWidth =
                groupWidth * 0.34;

              const gap =
                groupWidth * 0.10;

              const casesHeight =
                (item.cases /
                  maxValue) *
                (PLOT_BOTTOM -
                  PLOT_TOP);

              const accidentsHeight =
                (item.accidents /
                  maxValue) *
                (PLOT_BOTTOM -
                  PLOT_TOP);

              const active =
                hoveredIndex === index;

              const hitWidth =
                (PLOT_RIGHT -
                  PLOT_LEFT) /
                Math.max(
                  data.length,
                  1,
                );

              return (
                <g
                  key={`${item.label}-${index}`}
                  onMouseEnter={() =>
                    setHoveredIndex(index)
                  }
                >
                  <rect
                    className="station-overview-combined-chart__hit"
                    x={
                      point.x -
                      hitWidth / 2
                    }
                    y={PLOT_TOP}
                    width={hitWidth}
                    height={
                      PLOT_BOTTOM -
                      PLOT_TOP
                    }
                  />

                  <rect
                    className={
                      active
                        ? "station-overview-combined-chart__bar is-cases is-active"
                        : "station-overview-combined-chart__bar is-cases"
                    }
                    x={
                      point.x -
                      gap / 2 -
                      barWidth
                    }
                    y={
                      PLOT_BOTTOM -
                      casesHeight
                    }
                    width={barWidth}
                    height={Math.max(
                      3,
                      casesHeight,
                    )}
                    rx="2"
                  />

                  <rect
                    className={
                      active
                        ? "station-overview-combined-chart__bar is-accidents is-active"
                        : "station-overview-combined-chart__bar is-accidents"
                    }
                    x={
                      point.x +
                      gap / 2
                    }
                    y={
                      PLOT_BOTTOM -
                      accidentsHeight
                    }
                    width={barWidth}
                    height={Math.max(
                      3,
                      accidentsHeight,
                    )}
                    rx="2"
                  />
                </g>
              );
            },
          )}

          <path
            className="station-overview-combined-chart__total-line"
            d={totalLinePath}
          />

          {totalPoints.map(
            (point, index) => {
              const active =
                hoveredIndex === index;

              return (
                <circle
                  key={`${point.x}-${point.y}-${index}`}
                  className={
                    active
                      ? "station-overview-combined-chart__total-point is-active"
                      : "station-overview-combined-chart__total-point"
                  }
                  cx={point.x}
                  cy={point.y}
                  r={active ? 6 : 4}
                  onMouseEnter={() =>
                    setHoveredIndex(index)
                  }
                />
              );
            },
          )}

          {data.map(
            (item, index) => {
              const point =
                totalPoints[index];

              return (
                <text
                  key={`label-${item.label}`}
                  className={
                    hoveredIndex === index
                      ? "station-overview-combined-chart__x-label is-active"
                      : "station-overview-combined-chart__x-label"
                  }
                  x={point.x}
                  y={252}
                  textAnchor="middle"
                  onMouseEnter={() =>
                    setHoveredIndex(index)
                  }
                >
                  {item.label}
                </text>
              );
            },
          )}
        </svg>

        {hovered &&
          hoveredPoint && (
            <div
              className="station-overview-combined-chart__tooltip"
              style={{
                left: `${Math.min(
                  88,
                  Math.max(
                    12,
                    (hoveredPoint.x /
                      VIEWBOX_WIDTH) *
                      100,
                  ),
                )}%`,
              }}
            >
              <strong>
                {hovered.label}
              </strong>

              <span>
                <i className="is-cases" />
                Cases
                <b>{hovered.cases}</b>
              </span>

              <span>
                <i className="is-accidents" />
                Accident records
                <b>{hovered.accidents}</b>
              </span>

              <span>
                <i className="is-total" />
                Total
                <b>{hovered.total}</b>
              </span>
            </div>
          )}
      </div>
    </article>
  );
}