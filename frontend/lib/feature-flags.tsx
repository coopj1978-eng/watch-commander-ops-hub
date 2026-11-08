import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import backend from "@/lib/backend";
import { useAuth } from "@/App";

// Which pages firefighters (FF and RO) can open — one switch per page, set by
// the admin in Admin → Feature management. WC and CC always see everything.
// (dashboard / resources / inspections are kept for older settings rows.)
export interface FeatureFlags {
  dashboard: boolean;
  people: boolean;
  calendar: boolean;
  tasks: boolean;
  targets: boolean;
  detachments: boolean;
  equipment: boolean;
  handover: boolean;
  policies: boolean;
  resources: boolean;
  reports: boolean;
  inspections: boolean;
  requests: boolean;
  bulletins: boolean;
  training: boolean;
  hydrants: boolean;
  references: boolean;
}

const DEFAULT_FLAGS: FeatureFlags = {
  dashboard: true,
  people: true,
  calendar: true,
  tasks: true,
  targets: true,
  detachments: true,
  equipment: true,
  handover: true,
  policies: true,
  resources: true,
  reports: true,
  inspections: true,
  requests: true,
  bulletins: true,
  training: true,
  hydrants: true,
  references: true,
};

/** A switch missing from the saved settings (added after they were saved) is off. */
const ALL_OFF = Object.fromEntries(Object.keys(DEFAULT_FLAGS).map((k) => [k, false])) as unknown as FeatureFlags;

interface FeatureFlagContextType {
  flags: FeatureFlags;
  isLoaded: boolean;
  refetch: () => void;
}

const FeatureFlagContext = createContext<FeatureFlagContextType>({
  flags: DEFAULT_FLAGS,
  isLoaded: false,
  refetch: () => {},
});

export function FeatureFlagProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULT_FLAGS);
  const [isLoaded, setIsLoaded] = useState(false);

  const fetchFlags = async () => {
    try {
      const settings = await backend.settings.get();
      if (settings.feature_flags) {
        setFlags({ ...ALL_OFF, ...(settings.feature_flags as Partial<FeatureFlags>) });
      }
    } catch (err) {
      console.error("Failed to load feature flags:", err);
      // Default all to true if settings fail
    } finally {
      setIsLoaded(true);
    }
  };

  useEffect(() => {
    if (user) {
      fetchFlags();
    }
  }, [user?.id]);

  return (
    <FeatureFlagContext.Provider value={{ flags, isLoaded, refetch: fetchFlags }}>
      {children}
    </FeatureFlagContext.Provider>
  );
}

export function useFeatureFlags() {
  return useContext(FeatureFlagContext);
}

/**
 * Check if a feature is visible to the current user.
 * WC, CC and the admin always see everything regardless of the switches.
 */
export function useIsFeatureEnabled(feature: keyof FeatureFlags): boolean {
  const { user } = useAuth();
  const { flags } = useFeatureFlags();

  if (user?.role === "WC" || user?.role === "CC" || user?.is_admin) {
    return true;
  }

  return flags[feature] ?? false;
}
