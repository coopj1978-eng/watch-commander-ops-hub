import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";
import {
  useAccent,
  useDensity,
  ACCENT_OPTIONS,
  DENSITY_OPTIONS,
  type AccentKey,
  type DensityKey,
} from "@/hooks/useUIPreferences";

// ──────────────────────────────────────────────────────────────────────────────
// AppearanceSettings — Settings tab letting the user pick a brand accent
// colour and density. Both stored per-device in localStorage by the hooks
// in useUIPreferences.
//
// Deliberately scoped:
//   - Accent: only the nav chrome (sidebar brand mark + active state, top
//     bar avatar + watch-pill dot, mobile-nav active) swaps. Widget colours,
//     buttons, and status pills keep their semantic colours.
//   - Density: only card padding, table row height, and dashboard section
//     gap flex. Font sizes stay fixed.
// ──────────────────────────────────────────────────────────────────────────────

export function AppearanceSettings() {
  const [accent, setAccent] = useAccent();
  const [density, setDensity] = useDensity();

  return (
    <div className="space-y-6">
      {/* ── Accent colour ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Accent colour</CardTitle>
          <CardDescription>
            Choose the brand accent used on the sidebar, top bar avatar and
            mobile nav. Widget colours and status pills stay the same —
            they're doing real semantic signalling. Saved per-device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {ACCENT_OPTIONS.map((opt) => {
              const active = opt.key === accent;
              return (
                <AccentSwatch
                  key={opt.key}
                  option={opt}
                  active={active}
                  onClick={() => setAccent(opt.key)}
                />
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Density ───────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Density</CardTitle>
          <CardDescription>
            How much vertical space the dashboard and crew table use. Font
            sizes don't change — only padding and row heights. Saved per-
            device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {DENSITY_OPTIONS.map((opt) => {
              const active = opt.key === density;
              return (
                <DensityCard
                  key={opt.key}
                  option={opt}
                  active={active}
                  onClick={() => setDensity(opt.key)}
                />
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────────────────

function AccentSwatch({
  option,
  active,
  onClick,
}: {
  option: { key: AccentKey; label: string; swatch: string };
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`group relative flex flex-col items-center gap-2 p-3 rounded-md border-2 transition-colors ${
        active
          ? "border-foreground bg-muted/40"
          : "border-border hover:border-muted-foreground/40"
      }`}
    >
      <span
        className="h-10 w-10 rounded-sm flex items-center justify-center shrink-0"
        style={{ backgroundColor: option.swatch }}
        aria-hidden
      >
        {active && (
          <Check className="h-5 w-5" style={{ color: "var(--brand-foreground)" }} />
        )}
      </span>
      <span className="text-xs font-medium">{option.label}</span>
    </button>
  );
}

function DensityCard({
  option,
  active,
  onClick,
}: {
  option: { key: DensityKey; label: string; description: string };
  active: boolean;
  onClick: () => void;
}) {
  // Simulate the density visually using actual row heights so the user can
  // see what they're picking.
  const rowHeightPx = option.key === "compact" ? 16 : option.key === "airy" ? 26 : 22;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex flex-col items-start text-left gap-2 p-4 rounded-md border-2 transition-colors ${
        active
          ? "border-foreground bg-muted/40"
          : "border-border hover:border-muted-foreground/40"
      }`}
    >
      {/* Preview rows */}
      <div className="w-full space-y-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-sm bg-muted"
            style={{ height: `${rowHeightPx - i * 2}px`, width: `${100 - i * 15}%` }}
          />
        ))}
      </div>

      <div className="flex items-start justify-between w-full gap-2 mt-1">
        <div className="min-w-0">
          <div className="text-sm font-semibold">{option.label}</div>
          <div className="text-[11px] text-muted-foreground leading-snug">
            {option.description}
          </div>
        </div>
        {active && (
          <Check className="h-4 w-4 shrink-0 text-foreground mt-0.5" aria-hidden />
        )}
      </div>
    </button>
  );
}
