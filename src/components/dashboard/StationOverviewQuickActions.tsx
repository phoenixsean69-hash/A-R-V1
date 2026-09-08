import { Link } from "react-router-dom";

import {
  Activity,
  Camera,
  FolderKanban,
  Video,
} from "../icons/materialIcons";

import "./StationOverviewQuickActions.css";

const ACTIONS = [
  {
    to: "/cases",
    label: "Case register",
    description: "Open investigations",
    icon: FolderKanban,
  },
  {
    to: "/evidence",
    label: "Evidence",
    description: "Review scene records",
    icon: Camera,
  },
  {
    to: "/footage",
    label: "Footage",
    description: "Open saved recordings",
    icon: Video,
  },
  {
    to: "/reconstruction",
    label: "Reconstruction",
    description: "Open workspace",
    icon: Activity,
  },
] as const;

export default function StationOverviewQuickActions() {
  return (
    <section className="station-overview-quick-actions">
      <div className="station-overview-quick-actions__header">
        <div>
          <p>Quick actions</p>
          <strong>
            Station workspace
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
            description,
            icon: Icon,
          }) => (
            <Link
              key={to}
              to={to}
              className="station-overview-quick-action"
            >
              <span className="station-overview-quick-action__icon">
                <Icon
                  size={18}
                  strokeWidth={1.65}
                />
              </span>

              <span className="station-overview-quick-action__copy">
                <strong>
                  {label}
                </strong>

                <small>
                  {description}
                </small>
              </span>

              <span
                className="station-overview-quick-action__arrow"
                aria-hidden="true"
              >
                &gt;
              </span>
            </Link>
          ),
        )}
      </div>
    </section>
  );
}