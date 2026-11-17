// Predefined task labels (colour tags)
export const TASK_LABELS = [
  { id: "urgent",      name: "Urgent",      colour: "#ef4444" },
  { id: "operational", name: "Operational", colour: "#f97316" },
  { id: "training",    name: "Training",    colour: "#eab308" },
  { id: "routine",     name: "Routine",     colour: "#22c55e" },
  { id: "admin",       name: "Admin",       colour: "#3b82f6" },
  { id: "inspection",  name: "Inspection",  colour: "#a855f7" },
  { id: "crewing",     name: "Crewing",     colour: "#ec4899" },
  { id: "welfare",     name: "Welfare",     colour: "#06b6d4" },
] as const;

export type LabelId = typeof TASK_LABELS[number]["id"];

export function getLabelById(id: string) {
  return TASK_LABELS.find((l) => l.id === id);
}

// Card cover colours (solid + gradient swatches)
export const CARD_COVERS = [
  // No cover
  { id: "",          name: "None",        bg: "transparent",                                              textDark: false },
  // Solid colours
  { id: "#ef4444",   name: "Red",         bg: "#ef4444",                                                  textDark: false },
  { id: "#f97316",   name: "Orange",      bg: "#f97316",                                                  textDark: false },
  { id: "#eab308",   name: "Yellow",      bg: "#eab308",                                                  textDark: true  },
  { id: "#22c55e",   name: "Green",       bg: "#22c55e",                                                  textDark: false },
  { id: "#06b6d4",   name: "Cyan",        bg: "#06b6d4",                                                  textDark: false },
  { id: "#3b82f6",   name: "Blue",        bg: "#3b82f6",                                                  textDark: false },
  { id: "#6366f1",   name: "Indigo",      bg: "#6366f1",                                                  textDark: false },
  { id: "#a855f7",   name: "Purple",      bg: "#a855f7",                                                  textDark: false },
  { id: "#ec4899",   name: "Pink",        bg: "#ec4899",                                                  textDark: false },
  { id: "#64748b",   name: "Slate",       bg: "#64748b",                                                  textDark: false },
  { id: "#1e293b",   name: "Dark",        bg: "#1e293b",                                                  textDark: false },
  // Gradients
  { id: "grad-fire",   name: "Fire",      bg: "linear-gradient(135deg,#7f1d1d,#c2410c,#fbbf24)",          textDark: false },
  { id: "grad-ocean",  name: "Ocean",     bg: "linear-gradient(135deg,#1e3a5f,#1d4ed8,#0891b2)",          textDark: false },
  { id: "grad-forest", name: "Forest",    bg: "linear-gradient(135deg,#14532d,#065f46,#0f766e)",          textDark: false },
  { id: "grad-dawn",   name: "Dawn",      bg: "linear-gradient(135deg,#fbbf24,#f472b6,#a78bfa)",          textDark: true  },
  { id: "grad-night",  name: "Night",     bg: "linear-gradient(135deg,#111827,#312e81,#4c1d95)",          textDark: false },
  { id: "grad-rose",   name: "Rose",      bg: "linear-gradient(135deg,#fda4af,#f9a8d4,#d8b4fe)",          textDark: true  },
];

export function getCoverStyle(cover: string | undefined): { background: string; backgroundSize?: string; backgroundPosition?: string } | undefined {
  if (!cover) return undefined;
  const found = CARD_COVERS.find((c) => c.id === cover);
  if (found) return { background: found.bg };
  // HTTP URL or data URL — render as a cover image
  if (cover.startsWith("http") || cover.startsWith("data:")) {
    return {
      background: `url('${cover}') center/cover no-repeat`,
    };
  }
  return { background: cover };
}
