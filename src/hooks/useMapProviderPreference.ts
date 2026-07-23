import { useEffect, useState } from "react";

import {
  getPreferredMappingProvider,
  setPreferredMappingProvider,
  subscribeToMappingProvider,
} from "../services/mapPreferencesService";
import type { MappingProvider } from "../types/mapping";

export function useMapProviderPreference(): [
  MappingProvider,
  (provider: MappingProvider) => void,
] {
  const [provider, setProvider] = useState<MappingProvider>(() =>
    getPreferredMappingProvider(),
  );

  useEffect(() => subscribeToMappingProvider(setProvider), []);

  return [
    provider,
    (nextProvider) => {
      setPreferredMappingProvider(nextProvider);
      setProvider(nextProvider);
    },
  ];
}
