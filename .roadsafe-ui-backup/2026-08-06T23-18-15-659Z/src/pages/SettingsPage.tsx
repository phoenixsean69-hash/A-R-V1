import {
  KeyRound,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

export default function SettingsPage() {
  const auth = useAuth();
  const isStationAdmin =
    auth.identity?.role ===
    "station_admin";

  return (
    <div className="space-y-3">
      {isStationAdmin && (
        <section className="ui-panel overflow-hidden">
          <div className="ui-panel-header">
            <div>
              <h2 className="ui-panel-title">
                Station administration
              </h2>
              <p className="mt-1 text-[9px] text-slate-600">
                Control officer access without opening the Appwrite Console.
              </p>
            </div>

            <ShieldCheck
              size={16}
              className="text-[#8ed6ca]"
            />
          </div>

          <div className="grid gap-3 p-4 sm:grid-cols-2">
            <Link
              to="/officers"
              className="rounded-md border border-[#315b91] bg-[#0b1b38] p-4 transition-colors hover:bg-[#10284f]"
            >
              <Users
                size={18}
                className="text-[#8ebcff]"
              />
              <h3 className="mt-3 text-sm font-bold text-slate-100">
                Officer management
              </h3>
              <p className="mt-2 text-[9px] leading-5 text-slate-500">
                Create officers, assign station roles, block access and reset temporary passwords.
              </p>
            </Link>

            <Link
              to="/change-password"
              className="rounded-md border border-[#1a2946] bg-[#070d1a] p-4 transition-colors hover:border-[#29446f] hover:bg-[#0a1325]"
            >
              <KeyRound
                size={18}
                className="text-[#8ebcff]"
              />
              <h3 className="mt-3 text-sm font-bold text-slate-100">
                Change my password
              </h3>
              <p className="mt-2 text-[9px] leading-5 text-slate-500">
                Replace the current Station Client password securely.
              </p>
            </Link>
          </div>
        </section>
      )}

      <section className="ui-panel p-5">
        <div className="flex items-center gap-3 border-b border-[#18243f] pb-3">
          <SlidersHorizontal
            size={16}
            className="text-[#8ebcff]"
          />
          <div>
            <h2 className="ui-panel-title">
              Workspace preferences
            </h2>
            <p className="mt-1 text-[9px] text-slate-600">
              Configure reconstruction behaviour for this browser.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-5">
          {[
            [
              "Auto save",
              "Automatically save changes in reconstruction",
            ],
            [
              "Show physics vectors",
              "Display velocity and impact indicators",
            ],
            [
              "Confirm destructive actions",
              "Require confirmation before deletion",
            ],
          ].map(
            ([label, note], index) => (
              <label
                key={label}
                className="flex items-center justify-between gap-5 border-b border-[#15223b] pb-5"
              >
                <span>
                  <span className="block text-xs font-semibold text-slate-300">
                    {label}
                  </span>
                  <span className="mt-1 block text-[10px] text-slate-500">
                    {note}
                  </span>
                </span>

                <input
                  type="checkbox"
                  defaultChecked={
                    index !== 1
                  }
                  className="h-4 w-4 accent-[#4d8cf5]"
                />
              </label>
            ),
          )}

          <label className="block">
            <span className="text-xs font-semibold text-slate-300">
              Default playback speed
            </span>
            <select className="ui-input mt-2 block w-full max-w-xs">
              <option>1.0x</option>
              <option>0.5x</option>
              <option>1.5x</option>
              <option>2.0x</option>
            </select>
          </label>
        </div>
      </section>

      <section className="ui-panel p-5">
        <h2 className="ui-panel-title">
          Data
        </h2>
        <div className="mt-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-slate-300">
              Storage location
            </p>
            <p className="mt-1 text-[10px] text-slate-500">
              Local browser storage
            </p>
          </div>
          <button className="ui-button">
            Clear local data
          </button>
        </div>
      </section>
    </div>
  );
}
