/**
 * Lightweight adaptive route ranker used by the reconstruction path planner.
 *
 * This is intentionally not a generative model. The deterministic road graph
 * creates only valid route candidates; this small online learning-to-rank model
 * chooses the most realistic candidate and can learn from investigator edits.
 */

export interface ReconstructionRouteFeatures {
  roadContainment: number;
  startAlignment: number;
  arrivalAlignment: number;
  curvatureCompliance: number;
  directness: number;
  laneContinuity: number;
  turnEfficiency: number;
  vehicleSuitability: number;
  snapQuality: number;
}

export interface ReconstructionRouteCandidate<T = unknown> {
  id: string;
  value: T;
  features: ReconstructionRouteFeatures;
  deterministicConfidence: number;
}

export interface RankedReconstructionRoute<T = unknown>
  extends ReconstructionRouteCandidate<T> {
  aiScore: number;
  combinedScore: number;
  confidence: number;
}

interface PersistedRouteRankerModel {
  version: 1;
  weights: ReconstructionRouteFeatures;
  bias: number;
  learningCount: number;
  learnedSignatures: string[];
}

const STORAGE_KEY = "roadsafe.reconstruction.route-ranker.v1";
const MAX_LEARNED_SIGNATURES = 160;
const LEARNING_RATE = 0.055;
const L2_REGULARISATION = 0.0008;

const DEFAULT_WEIGHTS: ReconstructionRouteFeatures = {
  roadContainment: 2.75,
  startAlignment: 1.25,
  arrivalAlignment: 0.9,
  curvatureCompliance: 2.15,
  directness: 0.72,
  laneContinuity: 1.35,
  turnEfficiency: 0.72,
  vehicleSuitability: 1.85,
  snapQuality: 1.0,
};

const FEATURE_KEYS = Object.keys(DEFAULT_WEIGHTS) as Array<
  keyof ReconstructionRouteFeatures
>;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function sanitiseFeature(value: number): number {
  return Number.isFinite(value) ? clamp(value, 0, 1) : 0;
}

export function normaliseRouteFeatures(
  features: ReconstructionRouteFeatures,
): ReconstructionRouteFeatures {
  return FEATURE_KEYS.reduce<ReconstructionRouteFeatures>(
    (result, key) => {
      result[key] = sanitiseFeature(features[key]);
      return result;
    },
    { ...DEFAULT_WEIGHTS },
  );
}

function safeWindow(): Window | null {
  return typeof window === "undefined" ? null : window;
}

function defaultModel(): PersistedRouteRankerModel {
  return {
    version: 1,
    weights: { ...DEFAULT_WEIGHTS },
    bias: -4.2,
    learningCount: 0,
    learnedSignatures: [],
  };
}

function loadModel(): PersistedRouteRankerModel {
  const browser = safeWindow();
  if (!browser) return defaultModel();

  try {
    const raw = browser.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultModel();

    const parsed = JSON.parse(raw) as Partial<PersistedRouteRankerModel>;
    if (parsed.version !== 1 || !parsed.weights) return defaultModel();

    const weights = FEATURE_KEYS.reduce<ReconstructionRouteFeatures>(
      (result, key) => {
        const value = parsed.weights?.[key];
        result[key] = Number.isFinite(value) ? Number(value) : DEFAULT_WEIGHTS[key];
        return result;
      },
      { ...DEFAULT_WEIGHTS },
    );

    return {
      version: 1,
      weights,
      bias: Number.isFinite(parsed.bias) ? Number(parsed.bias) : -4.2,
      learningCount: Math.max(0, Math.floor(parsed.learningCount ?? 0)),
      learnedSignatures: Array.isArray(parsed.learnedSignatures)
        ? parsed.learnedSignatures.filter((value): value is string => typeof value === "string")
        : [],
    };
  } catch {
    return defaultModel();
  }
}

function saveModel(model: PersistedRouteRankerModel): void {
  const browser = safeWindow();
  if (!browser) return;

  try {
    browser.localStorage.setItem(STORAGE_KEY, JSON.stringify(model));
  } catch {
    // Route planning must remain functional when storage is unavailable.
  }
}

let model = loadModel();

function dotProduct(
  weights: ReconstructionRouteFeatures,
  features: ReconstructionRouteFeatures,
): number {
  return FEATURE_KEYS.reduce(
    (sum, key) => sum + weights[key] * features[key],
    0,
  );
}

function sigmoid(value: number): number {
  if (value >= 0) {
    const exponential = Math.exp(-value);
    return 1 / (1 + exponential);
  }

  const exponential = Math.exp(value);
  return exponential / (1 + exponential);
}

export function scoreReconstructionRoute(
  features: ReconstructionRouteFeatures,
): number {
  const normalised = normaliseRouteFeatures(features);
  return sigmoid(model.bias + dotProduct(model.weights, normalised));
}

function confidenceFromScores(
  best: number,
  secondBest: number | null,
  deterministicConfidence: number,
): number {
  const separation = secondBest === null ? 0.18 : clamp(best - secondBest, 0, 1);
  return clamp(
    deterministicConfidence * 0.68 +
      best * 0.22 +
      separation * 1.1,
    0,
    1,
  );
}

export function rankReconstructionRoutes<T>(
  candidates: Array<ReconstructionRouteCandidate<T>>,
): Array<RankedReconstructionRoute<T>> {
  const ranked = candidates
    .map((candidate) => {
      const features = normaliseRouteFeatures(candidate.features);
      const aiScore = scoreReconstructionRoute(features);
      const deterministicConfidence = clamp(candidate.deterministicConfidence, 0, 1);
      const combinedScore = aiScore * 0.62 + deterministicConfidence * 0.38;

      return {
        ...candidate,
        features,
        aiScore,
        combinedScore,
        confidence: 0,
      };
    })
    .sort((first, second) => second.combinedScore - first.combinedScore);

  return ranked.map((candidate, index) => ({
    ...candidate,
    confidence:
      index === 0
        ? confidenceFromScores(
            candidate.combinedScore,
            ranked[1]?.combinedScore ?? null,
            candidate.deterministicConfidence,
          )
        : clamp(candidate.deterministicConfidence * 0.55 + candidate.aiScore * 0.25, 0, 1),
  }));
}

function routeFeatureDifference(
  preferred: ReconstructionRouteFeatures,
  rejected: ReconstructionRouteFeatures,
): ReconstructionRouteFeatures {
  const preferredNormalised = normaliseRouteFeatures(preferred);
  const rejectedNormalised = normaliseRouteFeatures(rejected);

  return FEATURE_KEYS.reduce<ReconstructionRouteFeatures>(
    (result, key) => {
      result[key] = preferredNormalised[key] - rejectedNormalised[key];
      return result;
    },
    { ...DEFAULT_WEIGHTS },
  );
}

/**
 * Pairwise online update: the preferred route should score above the rejected
 * route. A signature prevents the same saved correction being learned twice.
 */
export function learnRoutePreference(
  preferred: ReconstructionRouteFeatures,
  rejected: ReconstructionRouteFeatures,
  signature: string,
): boolean {
  const cleanSignature = signature.trim();
  if (!cleanSignature || model.learnedSignatures.includes(cleanSignature)) {
    return false;
  }

  const difference = routeFeatureDifference(preferred, rejected);
  const margin = dotProduct(model.weights, difference);
  const probabilityPreferred = sigmoid(margin);
  const gradientScale = 1 - probabilityPreferred;

  FEATURE_KEYS.forEach((key) => {
    model.weights[key] = clamp(
      model.weights[key] * (1 - L2_REGULARISATION) +
        LEARNING_RATE * gradientScale * difference[key],
      -4,
      6,
    );
  });

  model.learningCount += 1;
  model.learnedSignatures = [
    ...model.learnedSignatures.slice(-(MAX_LEARNED_SIGNATURES - 1)),
    cleanSignature,
  ];
  saveModel(model);
  return true;
}


export function hasLearnedRoutePreference(signature: string): boolean {
  const cleanSignature = signature.trim();
  return Boolean(cleanSignature) && model.learnedSignatures.includes(cleanSignature);
}

export function getRouteRankerLearningCount(): number {
  return model.learningCount;
}

export function resetRouteRankerLearning(): void {
  model = defaultModel();
  saveModel(model);
}
