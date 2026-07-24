import { Crosshair, MapPin, Satellite, X } from "lucide-react";
import type { ReconstructionVehicleType } from "../../types/reconstruction";

interface ParticipantPlacementOverlayProps {
  participantType: ReconstructionVehicleType;
  gpsBusy: boolean;
  gpsAvailable: boolean;
  message: string;
  onUseGps: () => void;
  onCancel: () => void;
}

export default function ParticipantPlacementOverlay({
  participantType,
  gpsBusy,
  gpsAvailable,
  message,
  onUseGps,
  onCancel,
}: ParticipantPlacementOverlayProps) {
  return (
    <div className="participant-placement" data-scene-interactive="true">
      <div className="participant-placement__heading">
        <span className="participant-placement__icon">
          <MapPin size={15} />
        </span>
        <div>
          <strong>Place {participantType}</strong>
          <p>The participant is created only after its starting position is confirmed.</p>
        </div>
        <button type="button" onClick={onCancel} title="Cancel placement">
          <X size={14} />
        </button>
      </div>

      <div className="participant-placement__instruction">
        <Crosshair size={15} />
        <span>Click the exact starting position on the 2D scene.</span>
      </div>

      <div className="participant-placement__divider">
        <span>or</span>
      </div>

      <button
        type="button"
        className="participant-placement__gps"
        disabled={gpsBusy}
        onClick={onUseGps}
      >
        <Satellite size={15} />
        {gpsBusy ? "Reading live GPS…" : "Use live GPS position"}
      </button>

      {!gpsAvailable && (
        <p className="participant-placement__notice">
          No field calibration exists yet. RoadSafe will create a provisional
          north-up GPS frame centred on this live reading. You can refine the
          calibration later in Field Mode.
        </p>
      )}

      {message && <p className="participant-placement__message">{message}</p>}
    </div>
  );
}
