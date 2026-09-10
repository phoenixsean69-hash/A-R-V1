import { Link } from "react-router-dom";

import {
  Activity,
  Camera,
  ChevronRight,
  FolderKanban,
  Video,
  Zap,
} from "../icons/materialIcons";

import "./StationOverviewQuickActions.css";

const ACTIONS = [
  {
    to: "/cases",
    label: "Cases",
    icon: FolderKanban,
  },
  {
    to: "/evidence",
    label: "Evidence",
    icon: Camera,
  },
  {
    to: "/footage",
    label: "Footage",
    icon: Video,
  },
  {
    to: "/reconstruction",
    label: "Reconstruct",
    icon: Activity,
  },
] as const;

export default function StationOverviewQuickActions() {
  return (
    <section className="station-overview-quick-actions station-overview-quick-actions--icon-first">
      <div className="station-overview-quick-actions__header">
        <div>
          <Zap
            size={15}
            strokeWidth={1.8}
          />

          <strong>
            Quick actions
          </strong>
        </div>

        <span>
          {ACTIONS.length}
        </span>
      </div>

      <div className="station-overview-quick-actions__grid">
        {ACTIONS.map(
          ({
            to,
            label,
            icon: Icon,
          }) => (
            <Link
              key={to}
              to={to}
              className="station-overview-quick-action"
              title={label}
            >
              <span className="station-overview-quick-action__icon">
                <Icon
                  size={19}
                  strokeWidth={1.7}
                />
              </span>

              <span className="station-overview-quick-action__copy">
                <strong>
                  {label}
                </strong>
              </span>

              <ChevronRight
                className="station-overview-quick-action__arrow"
                size={14}
                strokeWidth={1.8}
              />
            </Link>
          ),
        )}
      </div>
    </section>
  );
}
