import type {
  GoogleMapsMap,
  GoogleMapsNamespace,
  GoogleOverlayView,
} from "../../services/googleMapsLoader";
import type { AccidentHeatmapPoint } from "./accidentHeatmapLayer";

export interface GoogleHeatmapOverlayHandle {
  destroy(): void;
  setData(points: AccidentHeatmapPoint[]): void;
  setVisible(visible: boolean): void;
}

const GRADIENT_STOPS: Array<[number, [number, number, number]]> = [
  [0, [36, 78, 145]],
  [0.2, [78, 139, 211]],
  [0.42, [50, 205, 170]],
  [0.62, [250, 204, 21]],
  [0.8, [239, 104, 72]],
  [1, [127, 29, 29]],
];

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function colourAt(value: number): [number, number, number] {
  const safe = clamp(value, 0, 1);
  for (let index = 1; index < GRADIENT_STOPS.length; index += 1) {
    const [rightPosition, rightColour] = GRADIENT_STOPS[index];
    const [leftPosition, leftColour] = GRADIENT_STOPS[index - 1];
    if (safe <= rightPosition) {
      const span = Math.max(0.0001, rightPosition - leftPosition);
      const ratio = (safe - leftPosition) / span;
      return [
        Math.round(leftColour[0] + (rightColour[0] - leftColour[0]) * ratio),
        Math.round(leftColour[1] + (rightColour[1] - leftColour[1]) * ratio),
        Math.round(leftColour[2] + (rightColour[2] - leftColour[2]) * ratio),
      ];
    }
  }
  return GRADIENT_STOPS[GRADIENT_STOPS.length - 1][1];
}

function createPalette(): Uint8ClampedArray {
  const palette = new Uint8ClampedArray(256 * 3);
  for (let index = 0; index < 256; index += 1) {
    const colour = colourAt(index / 255);
    palette[index * 3] = colour[0];
    palette[index * 3 + 1] = colour[1];
    palette[index * 3 + 2] = colour[2];
  }
  return palette;
}

function heatRadius(zoom: number): number {
  return clamp(16 + Math.max(0, zoom - 5) * 2.7, 16, 58);
}

export function createGoogleHeatmapOverlay(
  maps: GoogleMapsNamespace,
  map: GoogleMapsMap,
  initialPoints: AccidentHeatmapPoint[],
): GoogleHeatmapOverlayHandle {
  const overlay: GoogleOverlayView = new maps.OverlayView();
  const palette = createPalette();
  let points = initialPoints;
  let visible = true;
  let canvas: HTMLCanvasElement | null = null;
  let context: CanvasRenderingContext2D | null = null;
  let densityCanvas: HTMLCanvasElement | null = null;
  let densityContext: CanvasRenderingContext2D | null = null;

  const ensureCanvasSize = () => {
    if (!canvas || !densityCanvas) return false;
    const mapElement = map.getDiv();
    const width = Math.max(1, Math.round(mapElement.clientWidth));
    const height = Math.max(1, Math.round(mapElement.clientHeight));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      densityCanvas.width = width;
      densityCanvas.height = height;
    }
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    return true;
  };

  overlay.onAdd = () => {
    canvas = document.createElement("canvas");
    canvas.className = "roadsafe-google-heatmap-canvas";
    canvas.style.position = "absolute";
    canvas.style.left = "0";
    canvas.style.top = "0";
    canvas.style.pointerEvents = "none";
    canvas.style.opacity = "0.88";
    context = canvas.getContext("2d", { willReadFrequently: false });

    densityCanvas = document.createElement("canvas");
    densityContext = densityCanvas.getContext("2d", { willReadFrequently: true });

    overlay.getPanes()?.overlayLayer.appendChild(canvas);
  };

  overlay.draw = () => {
    if (!canvas || !context || !densityCanvas || !densityContext) return;
    if (!ensureCanvasSize()) return;

    const activeCanvas = canvas;
    const activeContext = context;
    const activeDensityCanvas = densityCanvas;
    const activeDensityContext = densityContext;

    activeContext.clearRect(0, 0, activeCanvas.width, activeCanvas.height);
    activeDensityContext.clearRect(
      0,
      0,
      activeDensityCanvas.width,
      activeDensityCanvas.height,
    );
    activeCanvas.style.display = visible ? "block" : "none";
    if (!visible || points.length === 0) return;

    const projection = overlay.getProjection();
    const zoom = map.getZoom() ?? 12;
    const radius = heatRadius(zoom);
    const maximumWeight = Math.max(1, ...points.map((point) => point.weight));

    points.forEach((point) => {
      const pixel = projection.fromLatLngToDivPixel(
        new maps.LatLng(point.latitude, point.longitude),
      );
      if (!pixel) return;
      if (
        pixel.x < -radius ||
        pixel.y < -radius ||
        pixel.x > activeDensityCanvas.width + radius ||
        pixel.y > activeDensityCanvas.height + radius
      ) {
        return;
      }

      const intensity = clamp(point.weight / maximumWeight, 0.12, 1);
      const gradient = activeDensityContext.createRadialGradient(
        pixel.x,
        pixel.y,
        0,
        pixel.x,
        pixel.y,
        radius,
      );
      gradient.addColorStop(0, `rgba(0,0,0,${0.72 * intensity})`);
      gradient.addColorStop(0.35, `rgba(0,0,0,${0.42 * intensity})`);
      gradient.addColorStop(0.72, `rgba(0,0,0,${0.16 * intensity})`);
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      activeDensityContext.fillStyle = gradient;
      activeDensityContext.fillRect(
        pixel.x - radius,
        pixel.y - radius,
        radius * 2,
        radius * 2,
      );
    });

    const image = activeDensityContext.getImageData(
      0,
      0,
      activeDensityCanvas.width,
      activeDensityCanvas.height,
    );
    const data = image.data;
    for (let index = 0; index < data.length; index += 4) {
      const alpha = data[index + 3];
      if (alpha === 0) continue;
      const paletteIndex = Math.min(255, Math.round(alpha * 1.35));
      data[index] = palette[paletteIndex * 3];
      data[index + 1] = palette[paletteIndex * 3 + 1];
      data[index + 2] = palette[paletteIndex * 3 + 2];
      data[index + 3] = Math.min(235, Math.round(alpha * 1.15));
    }
    activeContext.putImageData(image, 0, 0);
  };

  overlay.onRemove = () => {
    canvas?.remove();
    canvas = null;
    context = null;
    densityCanvas = null;
    densityContext = null;
  };

  overlay.setMap(map);

  return {
    destroy() {
      overlay.setMap(null);
    },
    setData(nextPoints) {
      points = nextPoints;
      overlay.draw();
    },
    setVisible(nextVisible) {
      visible = nextVisible;
      overlay.draw();
    },
  };
}
