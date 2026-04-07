import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import backend from "@/lib/backend";
import { useAuth } from "@/App";

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
};

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
        setFlags(settings.feature_flags as unknown as FeatureFlags);
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
 * WC and admin users always see all features regardless of flags.
 */
export function useIsFeatureEnabled(feature: keyof FeatureFlags): boolean {
  const { user } = useAuth();
  const { flags } = useFeatureFlags();

  // WC and admin users always see everything
  if (user?.role === "WC" || user?.is_admin) {
    return true;
  }

  return flags[feature] ?? true;
}
