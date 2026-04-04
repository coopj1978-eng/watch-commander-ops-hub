/**
 * CrewingBoard — Drag-and-drop shift crewing board
 *
 * Interaction:
 *   • Drag a roster tile onto a named slot (OIC / Driver / BA1 / BA2 / BAECO) — it snaps in.
 *   • Press-and-hold 250 ms on touch (iOS/Android) to start a drag.
 *   • OR click an empty slot → inline picker appears (fallback for accessibility & keyboard users).
 *   • Hover/tap ✕ on a filled slot to remove and return the person to the roster.
 *   • "External / CoS" button adds crew from another watch or station.
 *
 * Layout:
 *   Desktop (xl+): Appliance slots on the left | Roster tiles in a sticky sidebar on the right.
 *   Mobile/tablet: Appliance slots above | Roster tiles below (auto-scroll during drag).
 *
 * Roster fix: /crewing/roster checks BOTH users.watch_unit AND firefighter_profiles.watch.
 */

import {
  useState, useMemo, useEffect, useRef,
} from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import backend from "@/lib/backend";
import { getTodayShift, getShiftsForDateRange, hasRotaConfig } from "@/lib/shiftRota";
import type { crewing } from "@/client";
import { useAuth } from "@/App";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle, CheckCircle2, Copy, GripVertical, Loader2,
  MapPin, Plus, Truck, Users, X,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type CrewingEntry = crewing.CrewingEntry;
type RosterMember  = crewing.RosterMember;
type Appliance     = crewing.Appliance;
type CrewRole      = crewing.CrewRole;
type ShiftType     = crewing.ShiftType;

interface ApplianceSlot {
  role: CrewRole;
  label: string;
  required: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const WATCHES = ["Red", "White", "Green", "Blue", "Amber"] as const;

const SHIFT_TYPES: { value: ShiftType; label: string; day: boolean }[] = [
  { value: "1st Day",   label: "1st Day",   day: true  },
  { value: "2nd Day",   label: "2nd Day",   day: true  },
  { value: "1st Night", label: "1st Night", day: false },
  { value: "2nd Night", label: "2nd Night", day: false },
];

// Both appliances share the same 5 role slots.
// B10P2 has the same 5 slots but the final one (BA2) is optional — 4 = fully crewed.
const B10P1_SLOTS: ApplianceSlot[] = [
  { role: "oic",    label: "OIC",             required: true  },
  { role: "driver", label: "Driver",           required: true  },
  { role: "ba",     label: "BA1",              required: true  },
  { role: "ba",     label: "BA2",              required: true  },
  { role: "baeco",  label: "BA Entry Control", required: true  },
];

const B10P2_SLOTS: ApplianceSlot[] = [
  { role: "oic",    label: "OIC",                      required: true  },
  { role: "driver", label: "Driver",                    required: true  },
  { role: "ba",     label: "BA1",                      required: true  },
  { role: "ba",     label: "BA2",                      required: true  },
  { role: "baeco",  label: "BA Entry Control (Optional)", required: false },
];

const APPLIANCE_SLOTS: Record<"b10p1" | "b10p2", ApplianceSlot[]> = {
  b10p1: B10P1_SLOTS,
  b10p2: B10P2_SLOTS,
};

const APPLIANCE_LABELS: Record<Appliance, string> = {
  b10p1:    "B10P1 — 1st Pump",
  b10p2:    "B10P2 — 2nd Pump",
  detached: "Detached / Other",
};

const ROLE_BADGE: Record<CrewRole, string> = {
  oic:      "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  driver:   "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  ba:       "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  baeco:    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  ff:       "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  detached: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Shift date — between 00:00–08:00 we are still on the previous night's
 * 2nd Night shift (night shift ends at 08:00), so the operative date is yesterday.
 */
function currentShiftDate(): string {
  const now = new Date();
  if (now.getHours() < 8) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split("T")[0];
  }
  return now.toISOString().split("T")[0];
}

/**
 * Returns the smart default { shiftDate, shiftType } for the crewing board.
 *
 * The rota is the source of truth for 1st/2nd designation.
 * The clock (08:00–18:00) only determines day vs night as a fallback.
 * When before 08:00, the operative date is yesterday (night shift runs 18:00–08:00).
 */
function getSmartDefaults(watchName: string): { shiftDate: string; shiftType: ShiftType } {
  const shiftDate = currentShiftDate();
  const h = new Date().getHours();
  const clockFallback: ShiftType = h >= 8 && h < 18 ? "2nd Day" : "2nd Night";

  if (watchName && hasRotaConfig(watchName)) {
    // Check rota shift for the operative date (may be yesterday if h < 8)
    const operativeDate = new Date(shiftDate + "T12:00:00");
    const rotaShifts = getShiftsForDateRange(watchName, operativeDate, operativeDate);
    const operativeShift = rotaShifts[0];

    if (operativeShift?.isWorking) {
      // Rota knows 1st vs 2nd — use it directly
      return { shiftDate, shiftType: operativeShift.shiftType as ShiftType };
    }

    // On leave or rest — jump to the next 1st Day shift date
    const from = new Date();
    from.setDate(from.getDate() + 1); // start scanning from tomorrow
    const to   = new Date();
    to.setDate(to.getDate() + 90);    // look ahead up to 90 days

    const upcoming     = getShiftsForDateRange(watchName, from, to);
    const nextFirstDay = upcoming.find(s => s.shiftType === "1st Day");
    if (nextFirstDay) {
      return { shiftDate: nextFirstDay.date, shiftType: "1st Day" };
    }
  }

  // Fallback: no rota config — clock determines day/night, default to "2nd"
  return { shiftDate, shiftType: clockFallback };
}

function initials(name: string) {
  return name.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();
}

/**
 * Match entries to ordered slots. Roles that appear more than once (ba)
 * fill first slot first, second slot second.
 */
function matchSlots(
  entries: CrewingEntry[],
  slots: ApplianceSlot[],
): (CrewingEntry | undefined)[] {
  const used = new Set<number>();
  return slots.map(slot => {
    const match = entries.find(e => e.crew_role === slot.role && !used.has(e.id));
    if (match) used.add(match.id);
    return match;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SkillBadges — small coloured pills showing qualifications
// ─────────────────────────────────────────────────────────────────────────────

function SkillBadges({ member, size = "normal" }: { member: RosterMember; size?: "normal" | "small" }) {
  const skills = [
    member.ba         && { label: "BA",   cls: "bg-orange-500" },
    member.prps       && { label: "PRPS", cls: "bg-green-500"  },
    member.driver_erd && { label: "ERD",  cls: "bg-blue-500"   },
    member.driver_lgv && { label: "LGV",  cls: "bg-slate-500"  },
  ].filter(Boolean) as { label: string; cls: string }[];

  if (!skills.length) return null;

  const textCls = size === "small" ? "text-[8px]" : "text-[9px]";

  return (
    <div className="flex flex-wrap gap-0.5">
      {skills.map(s => (
        <span key={s.label} className={`${textCls} font-bold px-1 py-px rounded text-white leading-tight ${s.cls}`}>
          {s.label}
        </span>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TileCard — pure visual tile, used in roster + DragOverlay
// ─────────────────────────────────────────────────────────────────────────────

// Only outbound types affect roster availability on the person's OWN watch.
// Inbound types (flexi_payback, orange_day) mean the person comes IN to another watch — they do NOT
// remove the person from their own watch's roster.
type ShiftAdjType = "flexi" | "training" | "h4h";
const OUTBOUND_ADJ_TYPES: ShiftAdjType[] = ["flexi", "training", "h4h"];
const ADJ_BADGE: Record<ShiftAdjType, { label: string; cls: string }> = {
  flexi:    { label: "Flexi",    cls: "text-amber-600"  },
  training: { label: "Training", cls: "text-blue-600"   },
  h4h:      { label: "H4H Away", cls: "text-purple-600" },
};

interface TileCardProps {
  member: RosterMember;
  assignedEntry?: CrewingEntry;
  isAbsent?: boolean;
  adjustment?: ShiftAdjType;
  isDragging?: boolean;
  isOverlay?: boolean;
}

function TileCard({ member, assignedEntry, isAbsent, adjustment, isDragging, isOverlay }: TileCardProps) {
  const systemLabel =
    member.system_role === "WC" ? "Watch Commander"
    : member.system_role === "CC" ? "Crew Commander"
    : "Firefighter";

  const isAssigned = !!assignedEntry;

  return (
    <div
      className={`
        rounded-xl border select-none transition-all
        w-[120px] p-2.5 space-y-1.5
        ${isOverlay
          ? "shadow-xl ring-2 ring-indigo-400 bg-white dark:bg-gray-900 rotate-3 scale-105"
          : isAbsent
          ? "border-border bg-muted/40 opacity-50"
          : isAssigned
          ? "border-border bg-muted/50"
          : isDragging
          ? "border-indigo-300 bg-indigo-50/60 dark:bg-indigo-950/30 opacity-50"
          : "border-border bg-card hover:border-indigo-400 hover:shadow-sm"
        }
      `}
    >
      {/* Avatar + drag handle row */}
      <div className="flex items-center gap-1.5">
        <div className={`
          h-8 w-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0
          ${isAbsent ? "bg-muted-foreground/30" : isAssigned ? "bg-gradient-to-br from-teal-400 to-blue-500" : "bg-gradient-to-br from-indigo-400 to-purple-500"}
        `}>
          {initials(member.name)}
        </div>
        {!isAssigned && !isAbsent && !isOverlay && (
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
        )}
      </div>

      {/* Name */}
      <p className="text-xs font-semibold leading-tight truncate">
        {member.name}
      </p>

      {/* Rank + system role */}
      <p className="text-[10px] text-muted-foreground leading-tight truncate">
        {member.rank ? `${member.rank} · ` : ""}{member.system_role}
      </p>

      {/* Skills */}
      <SkillBadges member={member} />

      {/* Assignment status */}
      {adjustment ? (
        <span className={`text-[9px] font-bold uppercase tracking-wide ${ADJ_BADGE[adjustment].cls}`}>
          {ADJ_BADGE[adjustment].label}
        </span>
      ) : isAbsent ? (
        <span className="text-[9px] font-bold text-red-500 uppercase tracking-wide">Absent</span>
      ) : isAssigned ? (
        <span className={`text-[9px] font-bold px-1 py-px rounded ${ROLE_BADGE[assignedEntry!.crew_role]}`}>
          {assignedEntry!.appliance.toUpperCase()}
        </span>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PendingExternal type (used by ExternalRosterTile + CrewingBoard state)
// ─────────────────────────────────────────────────────────────────────────────

interface PendingExternal {
  tempId: string;    // uuid or Date.now() string
  userId?: string;   // set for "from another watch" picks
  name: string;      // display name
  isCoS: boolean;    // true for from-another-watch
}

// ─────────────────────────────────────────────────────────────────────────────
// DraggableTile — TileCard wrapped with @dnd-kit useDraggable
// ─────────────────────────────────────────────────────────────────────────────

function DraggableTile({
  member,
  assignedEntry,
  isAbsent,
  adjustment,
}: {
  member: RosterMember;
  assignedEntry?: CrewingEntry;
  isAbsent: boolean;
  adjustment?: ShiftAdjType;
}) {
  const disabled = !!assignedEntry || isAbsent || !!adjustment;

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `tile-${member.id}`,
    data: { member },
    disabled,
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(disabled ? {} : listeners)}
      {...(disabled ? {} : attributes)}
      className={`${disabled ? "cursor-default" : "cursor-grab active:cursor-grabbing"} touch-none`}
    >
      <TileCard
        member={member}
        assignedEntry={assignedEntry}
        isAbsent={isAbsent}
        adjustment={adjustment}
        isDragging={isDragging}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ExternalRosterTile — draggable pending-external tile shown in RosterPanel
// ─────────────────────────────────────────────────────────────────────────────

function ExternalRosterTile({
  pending,
  onDismiss,
}: {
  pending: PendingExternal;
  onDismiss: (tempId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `external-${pending.tempId}`,
    data: { external: pending },
  });
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`relative group w-[120px] rounded-xl border-2 border-dashed border-amber-400 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 cursor-grab active:cursor-grabbing touch-none select-none ${isDragging ? "opacity-40 ring-2 ring-amber-300" : ""}`}
    >
      {/* dismiss X */}
      <button
        onPointerDown={e => e.stopPropagation()}
        onClick={() => onDismiss(pending.tempId)}
        className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-muted border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <X className="h-2.5 w-2.5 text-muted-foreground" />
      </button>
      <div className="flex items-center gap-1.5 mb-1">
        <div className="h-6 w-6 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-[9px] font-bold shrink-0">
          {pending.name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase()}
        </div>
        <p className="text-xs font-semibold leading-tight truncate">{pending.name}</p>
      </div>
      <span className="text-[9px] font-semibold text-amber-700 dark:text-amber-400">
        {pending.isCoS ? "Change of Shift" : "External"}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SlotDropZone — the droppable empty state inside a slot row
// ─────────────────────────────────────────────────────────────────────────────

function SlotDropZone({
  id,
  slot,
  isDragActive,
  onClick,
  canEdit,
}: {
  id: string;
  slot: ApplianceSlot;
  isDragActive: boolean;   // true while any tile is being dragged
  onClick: () => void;
  canEdit: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { slotId: id } });

  const highlight = isOver && isDragActive;

  return (
    <div ref={setNodeRef} className="flex-1">
      {canEdit ? (
        <button
          onClick={onClick}
          className={`
            w-full flex items-center justify-center gap-1.5 rounded-lg border-2 border-dashed
            py-2 px-3 text-xs transition-all duration-150
            ${highlight
              ? "border-indigo-500 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 scale-[1.02] shadow-sm"
              : isDragActive
              ? "border-indigo-300 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-400 animate-pulse"
              : slot.required
              ? "border-amber-300/70 bg-amber-50/40 dark:bg-amber-950/10 text-amber-600/70 dark:text-amber-400/60 hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20 hover:text-amber-700 dark:hover:text-amber-400"
              : "border-muted-foreground/20 text-muted-foreground/40 hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/20"
            }
          `}
        >
          {highlight
            ? <CheckCircle2 className="h-3.5 w-3.5" />
            : <Plus className="h-3 w-3" />
          }
          <span className="font-medium">
            {highlight ? "Drop here" : slot.required ? "Assign (required)" : "Optional — assign"}
          </span>
        </button>
      ) : (
        <div className={`flex items-center gap-1.5 py-2 px-3 rounded-lg text-xs ${
          slot.required
            ? "text-amber-600/70 dark:text-amber-400/60"
            : "text-muted-foreground/40"
        }`}>
          {slot.required && <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400/70 shrink-0" />}
          <span className="italic">{slot.required ? "Not assigned" : "Not assigned (optional)"}</span>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SlotDragOverlay — drag ghost shown when re-dragging a placed slot entry
// ─────────────────────────────────────────────────────────────────────────────

function SlotDragOverlay({ entry }: { entry: CrewingEntry }) {
  const name = entry.user_name ?? entry.external_name ?? "Unknown";
  return (
    <div className="rounded-xl border border-indigo-400 ring-2 ring-indigo-400 shadow-xl bg-white dark:bg-gray-900 rotate-1 scale-105 px-3 py-2 min-w-[160px] select-none">
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
          {initials(name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate leading-tight">{name}</p>
          <span className={`text-[9px] font-bold px-1 py-px rounded ${ROLE_BADGE[entry.crew_role]}`}>
            {entry.crew_role.toUpperCase()}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DraggableFilledSlot — a placed crew member that can be re-dragged to a new slot
// ─────────────────────────────────────────────────────────────────────────────

function DraggableFilledSlot({
  entry,
  slot,
  canEdit,
  onRemove,
  hasBAWarning,
}: {
  entry: CrewingEntry;
  slot: ApplianceSlot;
  canEdit: boolean;
  onRemove: (id: number) => void;
  hasBAWarning?: boolean;
}) {
  const name = entry.user_name ?? entry.external_name ?? "Unknown";

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `placed-${entry.id}`,
    data: { entry },
    disabled: !canEdit,
  });

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(canEdit ? listeners : {})}
      {...(canEdit ? attributes : {})}
      className={`
        flex-1 flex items-center gap-2 min-w-0 bg-muted/40 rounded-lg px-2 py-1.5
        ${canEdit ? "cursor-grab active:cursor-grabbing" : ""}
        ${isDragging ? "opacity-40 ring-2 ring-indigo-300" : ""}
        touch-none
      `}
    >
      <div className="h-6 w-6 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-[9px] font-bold shrink-0">
        {initials(name)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate leading-tight">{name}</p>
        {entry.is_change_of_shift && (
          <span className="text-[9px] font-semibold text-amber-600 dark:text-amber-400">External / CoS</span>
        )}
      </div>
      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${ROLE_BADGE[entry.crew_role]}`}>
        {slot.label}
      </span>
      {hasBAWarning && (
        <span title="Not BA qualified" className="shrink-0">
          <AlertTriangle className="h-3 w-3 text-amber-500" />
        </span>
      )}
      {canEdit && (
        <button
          onPointerDown={e => e.stopPropagation()} // prevent drag starting on remove button
          onClick={() => onRemove(entry.id)}
          className="opacity-0 group-hover:opacity-100 transition-opacity h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0"
          title="Remove"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// InlinePicker — click-to-assign fallback (keyboard / accessibility)
// ─────────────────────────────────────────────────────────────────────────────

function InlinePicker({
  roster,
  alreadyAssignedIds,
  isPending,
  onAssign,
  onCancel,
}: {
  roster: RosterMember[];
  alreadyAssignedIds: Set<string>;
  isPending: boolean;
  onAssign: (userId: string | undefined, externalName: string | undefined) => void;
  onCancel: () => void;
}) {
  const [mode,     setMode]     = useState<"roster" | "external">("roster");
  const [userId,   setUserId]   = useState("");
  const [extName,  setExtName]  = useState("");

  useEffect(() => { setMode("roster"); setUserId(""); setExtName(""); }, []);

  const available = roster.filter(m => !alreadyAssignedIds.has(m.id));
  const valid     = mode === "roster" ? !!userId : extName.trim().length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2 py-1.5 pl-1">
      {mode === "roster" ? (
        <Select value={userId} onValueChange={setUserId}>
          <SelectTrigger className="h-8 text-xs w-48 min-w-0">
            <SelectValue placeholder="Select person…" />
          </SelectTrigger>
          <SelectContent>
            {!available.length && <SelectItem value="_none" disabled>All assigned</SelectItem>}
            {available.map(m => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}{m.rank ? ` — ${m.rank}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          className="h-8 text-xs w-48 min-w-0"
          placeholder="e.g. FF Jones (Blue Watch)"
          value={extName}
          onChange={e => setExtName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && valid && onAssign(undefined, extName.trim())}
          autoFocus
        />
      )}

      <button
        onClick={() => { setMode(m => m === "roster" ? "external" : "roster"); setUserId(""); setExtName(""); }}
        className="text-[11px] text-amber-600 hover:underline dark:text-amber-400 whitespace-nowrap"
      >
        {mode === "roster" ? "+ External / CoS" : "← Roster"}
      </button>

      <div className="flex gap-1 ml-auto">
        <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button
          size="sm" className="h-7 px-2 text-xs gap-1"
          disabled={!valid || isPending}
          onClick={() => onAssign(mode === "roster" ? userId : undefined, mode === "external" ? extName.trim() : undefined)}
        >
          {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          Assign
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SlotRow — one named role row inside an appliance card
// ─────────────────────────────────────────────────────────────────────────────

function SlotRow({
  slotId,
  slot,
  entry,
  roster,
  alreadyAssignedIds,
  isActive,
  isDragActive,
  canEdit,
  isPending,
  onActivate,
  onDeactivate,
  onAssign,
  onRemove,
  isLast,
  hasBAWarning,
}: {
  slotId: string;
  slot: ApplianceSlot;
  entry: CrewingEntry | undefined;
  roster: RosterMember[];
  alreadyAssignedIds: Set<string>;
  isActive: boolean;
  isDragActive: boolean;
  canEdit: boolean;
  isPending: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
  onAssign: (userId: string | undefined, externalName: string | undefined) => void;
  onRemove: (id: number) => void;
  isLast: boolean;
  hasBAWarning?: boolean;
}) {
  const borderB = !isLast ? "border-b border-border/40" : "";

  const labelCls = `
    text-xs font-semibold shrink-0 pt-2
    ${slot.required ? "text-foreground/70" : "text-muted-foreground/50"}
    w-[108px]
  `;

  // ── Filled slot ──────────────────────────────────────────────────────────
  if (entry) {
    return (
      <div className={`flex items-start gap-2 px-3 py-2 ${borderB} group`}>
        <span className={labelCls}>{slot.label}</span>
        <DraggableFilledSlot
          entry={entry}
          slot={slot}
          canEdit={canEdit}
          onRemove={onRemove}
          hasBAWarning={hasBAWarning}
        />
      </div>
    );
  }

  // ── Active inline picker ──────────────────────────────────────────────────
  if (isActive) {
    return (
      <div className={`flex items-start gap-2 px-3 py-2 ${borderB} bg-indigo-50/60 dark:bg-indigo-950/20 rounded-lg`}>
        <span className={`${labelCls} text-indigo-600 dark:text-indigo-400`}>{slot.label}</span>
        <div className="flex-1">
          <InlinePicker
            roster={roster}
            alreadyAssignedIds={alreadyAssignedIds}
            isPending={isPending}
            onAssign={onAssign}
            onCancel={onDeactivate}
          />
        </div>
      </div>
    );
  }

  // ── Empty slot ────────────────────────────────────────────────────────────
  return (
    <div className={`flex items-start gap-2 px-3 py-2 ${borderB}`}>
      <span className={labelCls}>{slot.label}</span>
      <SlotDropZone
        id={slotId}
        slot={slot}
        isDragActive={isDragActive}
        onClick={onActivate}
        canEdit={canEdit}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ApplianceSlotsCard — card with 5 named slot rows
// ─────────────────────────────────────────────────────────────────────────────

function ApplianceSlotsCard({
  appliance,
  entries,
  roster,
  canEdit,
  activeSlotId,
  isDragActive,
  addPending,
  onActivateSlot,
  onDeactivateSlot,
  onSlotAssign,
  onRemove,
}: {
  appliance: "b10p1" | "b10p2";
  entries: CrewingEntry[];
  roster: RosterMember[];
  canEdit: boolean;
  activeSlotId: string | null;
  isDragActive: boolean;
  addPending: boolean;
  onActivateSlot: (slotId: string) => void;
  onDeactivateSlot: () => void;
  onSlotAssign: (slotId: string, userId: string | undefined, extName: string | undefined, role: CrewRole) => void;
  onRemove: (id: number) => void;
}) {
  const slots       = APPLIANCE_SLOTS[appliance];
  const slotEntries = matchSlots(entries, slots);
  const baWarnings  = slots.map((slot, idx) => {
    if (slot.role !== "ba" && slot.role !== "baeco") return false;
    const entry = slotEntries[idx];
    if (!entry || !entry.user_id) return false;
    const member = roster.find(m => m.id === entry.user_id);
    return !!(member && !member.ba);
  });

  const assignedInAppliance = new Set(entries.filter(e => e.user_id).map(e => e.user_id!));

  const reqCount  = slots.filter(s => s.required).length;
  const reqFilled = slotEntries.filter((e, i) => e && slots[i].required).length;
  const full      = reqFilled >= reqCount;

  const missingLabels = slots
    .map((s, i) => !slotEntries[i] && s.required ? s.label : null)
    .filter(Boolean) as string[];

  const borderCls = full
    ? "border-green-400 dark:border-green-700"
    : reqFilled > 0
    ? "border-amber-400 dark:border-amber-700"
    : "border-border";

  return (
    <Card className={`transition-colors ${borderCls}`}>
      <CardHeader className="pt-4 pb-2 px-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-indigo-500 shrink-0" />
            <CardTitle className="text-sm font-semibold">{APPLIANCE_LABELS[appliance]}</CardTitle>
          </div>
          <Badge
            variant="secondary"
            className={`text-xs tabular-nums shrink-0 ${
              full ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                   : reqFilled > 0 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" : ""
            }`}
          >
            {slotEntries.filter(Boolean).length} / {reqCount}
            {full && <CheckCircle2 className="h-3 w-3 ml-1 inline" />}
          </Badge>
        </div>
        {missingLabels.length > 0 && (
          <p className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-1">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            Missing: {missingLabels.join(", ")}
          </p>
        )}
      </CardHeader>

      <CardContent className="p-0 pb-2">
        {slots.map((slot, idx) => {
          const slotId = `slot-${appliance}-${idx}`;
          return (
            <SlotRow
              key={slotId}
              slotId={slotId}
              slot={slot}
              entry={slotEntries[idx]}
              roster={roster}
              alreadyAssignedIds={assignedInAppliance}
              isActive={activeSlotId === slotId}
              isDragActive={isDragActive}
              canEdit={canEdit}
              isPending={addPending}
              onActivate={() => onActivateSlot(slotId)}
              onDeactivate={onDeactivateSlot}
              onAssign={(uid, ext) => onSlotAssign(slotId, uid, ext, slot.role)}
              onRemove={onRemove}
              isLast={idx === slots.length - 1}
              hasBAWarning={baWarnings[idx]}
            />
          );
        })}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DetachedCard — free-form list, no slots
// ─────────────────────────────────────────────────────────────────────────────

function DetachedCard({
  entries,
  roster,
  canEdit,
  showPicker,
  isPending,
  isDragActive,
  allAssignedIds,
  onShowPicker,
  onHidePicker,
  onAssign,
  onRemove,
}: {
  entries: CrewingEntry[];
  roster: RosterMember[];
  canEdit: boolean;
  showPicker: boolean;
  isPending: boolean;
  isDragActive: boolean;
  allAssignedIds: Set<string>;
  onShowPicker: () => void;
  onHidePicker: () => void;
  onAssign: (uid: string | undefined, ext: string | undefined) => void;
  onRemove: (id: number) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: "detached-zone",
    data: { zone: "detached" },
  });

  if (!canEdit && entries.length === 0) return null;

  const isHighlighted = isDragActive && isOver;
  const isDropTarget  = isDragActive && !isOver;

  return (
    <div ref={setNodeRef}>
    <Card className={`border-dashed transition-all duration-150 ${
      isHighlighted ? "border-amber-400 bg-amber-50/50 dark:bg-amber-900/10 shadow-md"
      : isDropTarget ? "border-muted-foreground/50 bg-muted/20"
      : "border-muted-foreground/30"
    }`}>
      <CardHeader className="pt-4 pb-2 px-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <MapPin className={`h-4 w-4 ${isHighlighted ? "text-amber-500" : ""}`} />
            Detached / Other
            {isDragActive && (
              <span className={`text-[10px] font-normal ${isHighlighted ? "text-amber-600" : "text-muted-foreground/60"}`}>
                {isHighlighted ? "↓ Drop to record detachment" : "drag here to detach"}
              </span>
            )}
          </CardTitle>
          <Badge variant="secondary" className="text-xs">{entries.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-1">
        {entries.length === 0 && !showPicker && (
          <p className="text-xs text-muted-foreground/50 italic py-1">No detached crew</p>
        )}
        {entries.map(e => {
          const name = e.user_name ?? e.external_name ?? "Unknown";
          return (
            <div key={e.id} className="flex items-center gap-2 py-1 px-2 bg-muted/30 rounded-lg group">
              <div className="h-6 w-6 rounded-full bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center text-white text-[9px] font-bold shrink-0">
                {initials(name)}
              </div>
              <span className="text-sm flex-1 truncate">{name}</span>
              {e.is_change_of_shift && (
                <Badge variant="outline" className="text-[9px] py-0 px-1 border-amber-400 text-amber-600 shrink-0">CoS</Badge>
              )}
              {canEdit && (
                <button
                  onClick={() => onRemove(e.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-red-500"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}
        {showPicker && (
          <div className="pt-2 border-t border-border/40">
            <InlinePicker
              roster={roster}
              alreadyAssignedIds={allAssignedIds}
              isPending={isPending}
              onAssign={onAssign}
              onCancel={onHidePicker}
            />
          </div>
        )}
        {canEdit && !showPicker && (
          <Button variant="ghost" size="sm" className="mt-1 w-full h-7 text-xs text-muted-foreground gap-1.5" onClick={onShowPicker}>
            <Plus className="h-3.5 w-3.5" />
            Add Detached / Other
          </Button>
        )}
      </CardContent>
    </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RosterPanel — sticky sidebar of draggable crew tiles
// ─────────────────────────────────────────────────────────────────────────────

function RosterPanel({
  roster,
  assignedByUserId,
  absentIds,
  adjustmentByUserId,
  h4hCovers,
  inboundCovers,
  isLoading,
  watch,
  canEdit,
  pendingExternal,
  onDismissPending,
  onExternalClick,
}: {
  roster: RosterMember[];
  assignedByUserId: Map<string, CrewingEntry>;
  absentIds: Set<string>;
  adjustmentByUserId: Map<string, ShiftAdjType>;
  h4hCovers: { name: string; userId?: string }[];
  inboundCovers: { name: string; userId: string; type: "flexi_payback" | "orange_day"; shiftDayNight?: "Day" | "Night"; watchUnit: string }[];
  isLoading: boolean;
  watch: string;
  canEdit: boolean;
  pendingExternal: PendingExternal[];
  onDismissPending: (tempId: string) => void;
  onExternalClick: () => void;
}) {
  const unassigned = roster.filter(m =>
    !assignedByUserId.has(m.id) && !absentIds.has(m.id) && !adjustmentByUserId.has(m.id)
  );
  const assigned   = roster.filter(m => assignedByUserId.has(m.id));
  const absent     = roster.filter(m => absentIds.has(m.id));
  const adjusted   = roster.filter(m => adjustmentByUserId.has(m.id));

  return (
    <Card className="xl:sticky xl:top-4">
      <CardHeader className="pt-4 pb-3 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Users className="h-4 w-4 text-indigo-500" />
          {watch} Watch Roster
          {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </CardTitle>
        {canEdit && (
          <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
            Drag a tile onto a slot to assign · click a slot to use the picker
          </p>
        )}
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-4">
        {isLoading ? (
          <div className="flex flex-wrap gap-2">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-28 w-[120px] rounded-xl" />)}
          </div>
        ) : roster.length === 0 ? (
          <div className="text-center py-4">
            <Users className="h-7 w-7 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">No {watch} Watch members found</p>
            <p className="text-[10px] text-muted-foreground/70 mt-1">Check that watch unit is set in each user's profile</p>
          </div>
        ) : (
          <>
            {/* Unassigned tiles */}
            {unassigned.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Available ({unassigned.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {unassigned.map(m => (
                    <DraggableTile key={m.id} member={m} isAbsent={false} />
                  ))}
                </div>
              </div>
            )}

            {/* Assigned tiles */}
            {assigned.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Assigned ({assigned.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {assigned.map(m => (
                    <DraggableTile key={m.id} member={m} assignedEntry={assignedByUserId.get(m.id)} isAbsent={false} />
                  ))}
                </div>
              </div>
            )}

            {/* Absent tiles */}
            {absent.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Absent ({absent.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {absent.map(m => (
                    <DraggableTile key={m.id} member={m} isAbsent={true} />
                  ))}
                </div>
              </div>
            )}

            {/* Shift adjustment tiles (Flexi / Training / H4H Away) */}
            {adjusted.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Shift Adjusted ({adjusted.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {adjusted.map(m => (
                    <DraggableTile
                      key={m.id}
                      member={m}
                      isAbsent={false}
                      adjustment={adjustmentByUserId.get(m.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* H4H cover people (from another watch, covering an absent member) */}
            {h4hCovers.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  H4H Cover ({h4hCovers.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {h4hCovers.map((cover, i) => {
                    if (cover.userId) {
                      // Person is in the system — fully draggable tile
                      const syntheticMember: RosterMember = {
                        id:          cover.userId,
                        name:        cover.name,
                        system_role: "FF",
                        watch_unit:  undefined,
                        profile_watch: undefined,
                        ba:          false,
                        prps:        false,
                        driver_lgv:  false,
                        driver_erd:  false,
                      };
                      return (
                        <div key={cover.userId} className="flex flex-col items-center">
                          <DraggableTile
                            member={syntheticMember}
                            assignedEntry={assignedByUserId.get(cover.userId)}
                            isAbsent={false}
                          />
                          <span className="text-[9px] font-bold text-purple-600 uppercase tracking-wide mt-0.5">
                            H4H Cover
                          </span>
                        </div>
                      );
                    }
                    // Free-text name only — show static tile, WC can add via External/CoS
                    return (
                      <div
                        key={i}
                        className="rounded-xl border border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-950/40 w-[120px] p-2.5 space-y-1.5"
                      >
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center text-white text-[10px] font-bold">
                          {cover.name.split(" ").map((p: string) => p[0]).slice(0, 2).join("").toUpperCase()}
                        </div>
                        <p className="text-xs font-semibold leading-tight truncate">{cover.name}</p>
                        <span className="text-[9px] font-bold text-purple-600 uppercase tracking-wide">H4H Cover</span>
                        <p className="text-[9px] text-muted-foreground/70 leading-tight">Add via External / CoS ↓</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Inbound cover (Flexi Payback / Orange Day — person from another watch covering this watch) */}
            {inboundCovers.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Extra Cover ({inboundCovers.length})
                </p>
                <p className="text-[10px] text-muted-foreground mb-2">Drag to assign to an appliance slot</p>
                <div className="flex flex-wrap gap-2">
                  {inboundCovers.map((cover) => {
                    // Build a synthetic RosterMember so DraggableTile can handle drag-and-drop
                    const syntheticMember: RosterMember = {
                      id:          cover.userId,
                      name:        cover.name,
                      system_role: "FF",
                      watch_unit:  cover.watchUnit,
                      profile_watch: cover.watchUnit,
                      ba:          false,
                      prps:        false,
                      driver_lgv:  false,
                      driver_erd:  false,
                    };
                    const isOrange = cover.type === "orange_day";
                    const label    = isOrange ? "Orange Day" : "Flexi PB";
                    const textCls  = isOrange ? "text-orange-600" : "text-teal-600";
                    return (
                      <div key={cover.userId} className="flex flex-col items-center">
                        <DraggableTile
                          member={syntheticMember}
                          assignedEntry={assignedByUserId.get(cover.userId)}
                          isAbsent={false}
                        />
                        <span className={`text-[9px] font-bold uppercase tracking-wide mt-0.5 ${textCls}`}>
                          {label} · {cover.watchUnit}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* Skill legend */}
        {roster.length > 0 && (
          <div className="pt-2 border-t border-border/40">
            <p className="text-[10px] text-muted-foreground flex flex-wrap gap-2">
              <span className="font-semibold text-orange-500">BA</span>
              <span className="font-semibold text-green-500">PRPS</span>
              <span className="font-semibold text-blue-500">ERD</span>
              <span className="font-semibold text-slate-500">LGV</span>
            </p>
          </div>
        )}

        {/* Pending external tiles */}
        {pendingExternal.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              External / CoS ({pendingExternal.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {pendingExternal.map(p => (
                <ExternalRosterTile key={p.tempId} pending={p} onDismiss={onDismissPending} />
              ))}
            </div>
          </div>
        )}

        {/* External / CoS */}
        {canEdit && (
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-1.5 text-amber-700 border-amber-300 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-700 dark:hover:bg-amber-950/30"
            onClick={onExternalClick}
          >
            <Plus className="h-3.5 w-3.5" />
            External / CoS
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ExternalDialog — add crew from another watch / station
// Supports two modes:
//   "roster"   — pick a real person from another watch's roster (links to their profile)
//   "freetext" — type a name manually (for external stations / agency staff)
// ─────────────────────────────────────────────────────────────────────────────

function ExternalDialog({
  open,
  onClose,
  onAdd,
  currentWatch,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (userId: string | undefined, name: string | undefined, isCoS: boolean) => void;
  currentWatch: string;
}) {
  const [mode,          setMode]         = useState<"roster" | "freetext">("roster");
  const [selectedWatch, setSelectedWatch] = useState<string>("");
  const [userId,        setUserId]        = useState("");
  const [name,          setName]          = useState("");

  // Other watches the user can borrow from
  const otherWatches = WATCHES.filter(w => w !== currentWatch);

  // Fetch that watch's roster when selected
  const { data: otherRosterData, isLoading: rosterLoading } = useQuery({
    queryKey: ["crewing-roster", selectedWatch],
    queryFn:  () => backend.crewing.roster({ watch: selectedWatch }),
    enabled:  mode === "roster" && !!selectedWatch,
  });
  const otherRoster = otherRosterData?.members ?? [];

  const valid =
    mode === "roster"
      ? !!selectedWatch && !!userId
      : name.trim().length > 0;

  const reset = () => {
    setMode("roster"); setSelectedWatch(""); setUserId(""); setName("");
  };

  const handleAdd = () => {
    if (!valid) return;
    if (mode === "roster") {
      const member = otherRoster.find(m => m.id === userId);
      onAdd(userId, member?.name, true);
    } else {
      onAdd(undefined, name.trim(), false);
    }
    reset();
  };

  const handleClose = () => { reset(); onClose(); };

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add External / Change of Shift</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">

          {/* Mode toggle */}
          <div className="flex rounded-md border overflow-hidden text-xs bg-border gap-px">
            <button
              onClick={() => { setMode("roster"); setName(""); }}
              className={`flex-1 py-2 font-medium transition-colors ${
                mode === "roster" ? "bg-indigo-600 text-white" : "bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              From Another Watch
            </button>
            <button
              onClick={() => { setMode("freetext"); setSelectedWatch(""); setUserId(""); }}
              className={`flex-1 py-2 font-medium transition-colors ${
                mode === "freetext" ? "bg-amber-600 text-white" : "bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              Free-text / External
            </button>
          </div>

          {/* ── Roster mode ── */}
          {mode === "roster" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Watch</Label>
                <Select
                  value={selectedWatch}
                  onValueChange={v => { setSelectedWatch(v); setUserId(""); }}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select watch…" />
                  </SelectTrigger>
                  <SelectContent>
                    {otherWatches.map(w => (
                      <SelectItem key={w} value={w}>{w} Watch</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedWatch && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Person</Label>
                  <Select value={userId} onValueChange={setUserId} disabled={rosterLoading || !otherRoster.length}>
                    <SelectTrigger className="h-9">
                      {rosterLoading
                        ? <span className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Loading…</span>
                        : <SelectValue placeholder={otherRoster.length ? "Select person…" : "No members found"} />
                      }
                    </SelectTrigger>
                    <SelectContent>
                      {otherRoster.map(m => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}{m.rank ? ` — ${m.rank}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    Covers as Change of Shift — linked to their profile
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Free-text mode ── */}
          {mode === "freetext" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input
                placeholder="e.g. FF Jones (Blue Watch)"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && valid && handleAdd()}
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground">
                For external stations or agency staff not in the system
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={handleClose}>Cancel</Button>
            <Button className="flex-1 gap-1.5" onClick={handleAdd} disabled={!valid}>
              <Plus className="h-3.5 w-3.5" />
              Add to Pending
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DetachmentModal — confirm destination + reason when dragging to detached zone
// ─────────────────────────────────────────────────────────────────────────────

const DETACHMENT_REASONS = [
  "Operational cover",
  "Mutual aid",
  "Training",
  "Secondment",
  "Special duty",
  "Other",
];

function DetachmentModal({
  open,
  name,
  shiftDate,
  isPending,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  name: string;
  shiftDate: string;
  isPending: boolean;
  onConfirm: (toStation: string, reason: string, notes: string) => void;
  onCancel: () => void;
}) {
  const [toStation, setToStation] = useState("");
  const [reason,    setReason]    = useState("Operational cover");
  const [notes,     setNotes]     = useState("");

  // Reset fields whenever the modal opens
  useEffect(() => {
    if (open) { setToStation(""); setReason("Operational cover"); setNotes(""); }
  }, [open]);

  const valid = toStation.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-amber-500" />
            Record Detachment
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <p className="text-sm text-muted-foreground">
            Recording <span className="font-medium text-foreground">{name}</span> as detached on{" "}
            <span className="font-medium text-foreground">{format(parseISO(shiftDate), "dd MMM yyyy")}</span>.
          </p>

          <div className="space-y-1.5">
            <Label className="text-xs">Detached to (station)</Label>
            <Input
              placeholder="e.g. Stn 08 — Tollcross"
              value={toStation}
              onChange={e => setToStation(e.target.value)}
              onKeyDown={e => e.key === "Enter" && valid && onConfirm(toStation, reason, notes)}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DETACHMENT_REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Notes <span className="text-muted-foreground/60">(optional)</span></Label>
            <Input
              placeholder="Any additional context..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onCancel} disabled={isPending}>Cancel</Button>
            <Button
              className="flex-1 gap-1.5 bg-amber-600 hover:bg-amber-700"
              onClick={() => onConfirm(toStation, reason, notes)}
              disabled={!valid || isPending}
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MapPin className="h-3.5 w-3.5" />}
              Record &amp; Assign
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CrewingBoard — main component
// ─────────────────────────────────────────────────────────────────────────────

export default function CrewingBoard() {
  const { user }  = useAuth();
  const { toast } = useToast();
  const qc        = useQueryClient();
  const canEdit   = user?.role === "WC" || user?.role === "CC";

  const userWatch     = user?.watch_unit ?? "Red";
  const smartDefaults = getSmartDefaults(userWatch);

  // ── State ─────────────────────────────────────────────────────────────────
  const [shiftDate,      setShiftDate]      = useState(smartDefaults.shiftDate);
  const [shiftType,      setShiftType]      = useState<ShiftType>(smartDefaults.shiftType);
  const [watch,          setWatch]          = useState<string>(userWatch);
  const [activeSlotId,   setActiveSlotId]   = useState<string | null>(null);
  const [showDetached,   setShowDetached]   = useState(false);
  const [showExtDialog,  setShowExtDialog]  = useState(false);

  // Detachment modal — opened when a tile is dropped onto the detached zone
  const [pendingDetach,  setPendingDetach]  = useState<{ member?: RosterMember; entry?: CrewingEntry } | null>(null);

  // Pending external tiles waiting to be dragged onto a slot
  const [pendingExternal, setPendingExternal] = useState<PendingExternal[]>([]);

  // Track what is currently being dragged (for DragOverlay + drop logic)
  const [draggingMember, setDraggingMember] = useState<RosterMember | null>(null);
  const [draggingEntry,  setDraggingEntry]  = useState<CrewingEntry | null>(null);

  // Map from slot ID → { appliance, slotIdx, role } for drop handling
  const slotMetaRef = useRef<Map<string, { appliance: Appliance; role: CrewRole }>>(new Map());

  // Build slot metadata whenever appliance slots change (they're static, but keep it readable)
  useMemo(() => {
    const map = new Map<string, { appliance: Appliance; role: CrewRole }>();
    (["b10p1", "b10p2"] as const).forEach(appl => {
      APPLIANCE_SLOTS[appl].forEach((slot, idx) => {
        map.set(`slot-${appl}-${idx}`, { appliance: appl as Appliance, role: slot.role });
      });
    });
    slotMetaRef.current = map;
  }, []);

  const crewingKey = ["crewing", watch, shiftDate, shiftType];

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: crewingData, isLoading: crewingLoading } = useQuery({
    queryKey: crewingKey,
    queryFn: () => backend.crewing.list({ watch, shift_date: shiftDate, shift_type: shiftType }),
    enabled: !!watch,
  });

  const { data: rosterData, isLoading: rosterLoading } = useQuery({
    queryKey: ["crewing-roster", watch],
    queryFn: () => backend.crewing.roster({ watch }),
    enabled: !!watch,
  });

  const { data: absenceData } = useQuery({
    queryKey: ["absences-date", shiftDate],
    queryFn: () => backend.absence.list({ status: "approved" as any, start_date: shiftDate, end_date: shiftDate, limit: 200 }),
    retry: false,
  });

  const { data: shiftAdjData } = useQuery({
    queryKey: ["shift-adjustments", watch, shiftDate],
    queryFn: () => backend.shift_adjustments.list({ watch_unit: watch, start_date: shiftDate, end_date: shiftDate }),
    retry: false,
  });

  const { data: inboundAdjData } = useQuery({
    queryKey: ["shift-adjustments-inbound", watch, shiftDate],
    queryFn: () => backend.shift_adjustments.list({ covering_watch: watch, start_date: shiftDate, end_date: shiftDate }),
    enabled: !!watch,
    retry: false,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const addMut = useMutation({
    mutationFn: (req: crewing.AddCrewingRequest) => backend.crewing.add(req),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: crewingKey });
      setActiveSlotId(null);
      setShowDetached(false);
      setShowExtDialog(false);
    },
    onError: () => toast({ title: "Error", description: "Failed to add crew member.", variant: "destructive" }),
  });

  const removeMut = useMutation({
    mutationFn: (id: number) => backend.crewing.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: crewingKey }),
    onError: () => toast({ title: "Error", description: "Failed to remove crew member.", variant: "destructive" }),
  });

  // Move a placed entry to a different slot (remove old → add to new)
  const moveMut = useMutation({
    mutationFn: async ({ removeId, addReq }: { removeId: number; addReq: crewing.AddCrewingRequest }) => {
      await backend.crewing.remove(removeId);
      return backend.crewing.add(addReq);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: crewingKey }),
    onError: () => toast({ title: "Error", description: "Failed to move crew member.", variant: "destructive" }),
  });

  // Record a detachment event + add crewing entry in one go
  const detachMut = useMutation({
    mutationFn: async ({
      firefighterId, firefighterName, toStation, reason, notes,
      userId, externalName,
    }: {
      firefighterId: string;
      firefighterName: string;
      toStation: string;
      reason: string;
      notes: string;
      userId?: string;
      externalName?: string;
    }) => {
      // Only create a detachments record for known users (not free-text external names)
      if (firefighterId) {
        await backend.detachments.create({
          firefighter_id:   firefighterId,
          firefighter_name: firefighterName,
          home_watch:       watch,
          to_station:       toStation,
          detachment_date:  shiftDate,
          reason:           reason || undefined,
          notes:            notes  || undefined,
        });
      }
      return backend.crewing.add({
        watch, shift_date: shiftDate, shift_type: shiftType,
        appliance: "detached", crew_role: "detached",
        user_id:       userId,
        external_name: externalName,
        is_change_of_shift: false,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: crewingKey });
      qc.invalidateQueries({ queryKey: ["detachments-rota"] });
      setPendingDetach(null);
      toast({ title: "Detachment recorded", description: "Crew member added to detached list and detachment logged." });
    },
    onError: () => toast({ title: "Error", description: "Failed to record detachment.", variant: "destructive" }),
  });

  const copyMut = useMutation({
    mutationFn: () => backend.crewing.copyPrevious({ watch, shift_date: shiftDate, shift_type: shiftType }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: crewingKey });
      if (!data.entries.length) {
        toast({ title: "No previous shift found", description: "No earlier crewing record to copy from." });
      } else {
        toast({ title: "Crewing copied", description: `Copied ${data.entries.length} crew from the last ${shiftType} shift.` });
      }
    },
    onError: () => toast({ title: "Error", description: "Failed to copy previous crewing.", variant: "destructive" }),
  });

  // ── Derived data ──────────────────────────────────────────────────────────
  const entries  = crewingData?.entries ?? [];
  const roster   = rosterData?.members  ?? [];

  const b10p1    = entries.filter(e => e.appliance === "b10p1");
  const b10p2    = entries.filter(e => e.appliance === "b10p2");
  const detached = entries.filter(e => e.appliance === "detached");

  const assignedByUserId = useMemo(() => {
    const map = new Map<string, CrewingEntry>();
    entries.forEach(e => { if (e.user_id) map.set(e.user_id, e); });
    return map;
  }, [entries]);

  const allAssignedIds = useMemo(() => new Set(assignedByUserId.keys()), [assignedByUserId]);

  // Build a quick lookup: slotId → entry (for drop validation)
  const slotEntryMap = useMemo(() => {
    const map = new Map<string, CrewingEntry | undefined>();
    (["b10p1", "b10p2"] as const).forEach(appl => {
      const appEntries  = entries.filter(e => e.appliance === appl);
      const slots       = APPLIANCE_SLOTS[appl];
      const matched     = matchSlots(appEntries, slots);
      slots.forEach((_, idx) => {
        map.set(`slot-${appl}-${idx}`, matched[idx]);
      });
    });
    return map;
  }, [entries]);

  const absentIds = useMemo(() => {
    const ids = new Set<string>();
    (absenceData?.absences ?? []).forEach((a: any) => {
      if (a.status === "approved") ids.add(a.firefighter_id ?? a.user_id ?? "");
    });
    return ids;
  }, [absenceData]);

  const adjustmentByUserId = useMemo(() => {
    const map = new Map<string, ShiftAdjType>();
    (shiftAdjData?.adjustments ?? []).forEach((a: any) => {
      // Only outbound types (flexi, training, h4h) remove the person from their own watch's roster.
      // Inbound types (flexi_payback, orange_day) must NOT be put in this map — they don't affect
      // the person's own watch, and passing them to ADJ_BADGE would crash the component.
      if (OUTBOUND_ADJ_TYPES.includes(a.type)) {
        map.set(a.user_id, a.type as ShiftAdjType);
      }
    });
    return map;
  }, [shiftAdjData]);

  const h4hCovers = useMemo(() => {
    return (shiftAdjData?.adjustments ?? [])
      .filter((a: any) => a.type === "h4h" && (a.covering_name || a.covering_user_id))
      .map((a: any) => ({
        name: a.covering_name || "Unknown cover",
        userId: a.covering_user_id,
      }));
  }, [shiftAdjData]);

  // Inbound covers (flexi_payback / orange_day) — people covering this watch from another watch
  const inboundCovers = useMemo(() => {
    return (inboundAdjData?.adjustments ?? []).map((a: any) => ({
      name: a.user_name || "Cover",
      userId: a.user_id,
      type: a.type as "flexi_payback" | "orange_day",
      shiftDayNight: a.shift_day_night as "Day" | "Night" | undefined,
      watchUnit: a.watch_unit,
    }));
  }, [inboundAdjData]);

  // ── DnD sensors ───────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  // ── DnD handlers ──────────────────────────────────────────────────────────
  const handleDragStart = (event: DragStartEvent) => {
    const member = event.active.data.current?.member as RosterMember | undefined;
    const entry  = event.active.data.current?.entry  as CrewingEntry | undefined;
    if (member) setDraggingMember(member);
    if (entry)  setDraggingEntry(entry);
    setActiveSlotId(null); // close any open inline picker
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggingMember(null);
    setDraggingEntry(null);

    const { active, over } = event;
    if (!over) return;

    // ── Dropped onto the detached zone — show the detachment modal ───────────
    if (over.data.current?.zone === "detached") {
      const member = active.data.current?.member as RosterMember | undefined;
      const entry  = active.data.current?.entry  as CrewingEntry  | undefined;
      // Only if not already in the detached list
      const alreadyDetached = entry?.appliance === "detached";
      if ((member || entry) && !alreadyDetached) {
        setPendingDetach({ member, entry });
      }
      return;
    }

    const slotId = over.data.current?.slotId as string | undefined;
    if (!slotId) return;

    // Don't drop on an occupied slot
    if (slotEntryMap.get(slotId)) return;

    const meta = slotMetaRef.current.get(slotId);
    if (!meta) return;

    // Case 2.5: dragging a pending external tile → assign to slot
    const ext = active.data.current?.external as PendingExternal | undefined;
    if (ext) {
      addMut.mutate({
        watch, shift_date: shiftDate, shift_type: shiftType,
        appliance: meta.appliance, crew_role: meta.role,
        user_id: ext.userId,
        external_name: ext.userId ? undefined : ext.name,
        is_change_of_shift: ext.isCoS,
      });
      // Remove from pending immediately (optimistic)
      setPendingExternal(prev => prev.filter(p => p.tempId !== ext.tempId));
      return;
    }

    // Case 1: dragging a roster tile → add to slot
    const member = active.data.current?.member as RosterMember | undefined;
    if (member) {
      if ((meta.role === "ba" || meta.role === "baeco") && !member.ba) {
        toast({
          title: "BA qualification warning",
          description: `${member.name} is not BA qualified for this slot. Review before turnout.`,
        });
      }
      addMut.mutate({
        watch, shift_date: shiftDate, shift_type: shiftType,
        appliance: meta.appliance, crew_role: meta.role,
        user_id: member.id,
        is_change_of_shift: false,
      });
      return;
    }

    // Case 2: dragging an already-placed entry → move to new slot
    const entry = active.data.current?.entry as CrewingEntry | undefined;
    if (entry) {
      moveMut.mutate({
        removeId: entry.id,
        addReq: {
          watch, shift_date: shiftDate, shift_type: shiftType,
          appliance: meta.appliance, crew_role: meta.role,
          user_id:       entry.user_id       ?? undefined,
          external_name: entry.external_name ?? undefined,
          is_change_of_shift: entry.is_change_of_shift,
        },
      });
    }
  };

  // ── Assign handlers ───────────────────────────────────────────────────────
  const handleSlotAssign = (
    slotId: string,
    userId: string | undefined,
    extName: string | undefined,
    role: CrewRole,
  ) => {
    const meta = slotMetaRef.current.get(slotId);
    if (!meta) return;
    if (userId && (role === "ba" || role === "baeco")) {
      const member = roster.find(m => m.id === userId);
      if (member && !member.ba) {
        toast({
          title: "BA qualification warning",
          description: `${member.name} is not BA qualified for this slot. Review before turnout.`,
        });
      }
    }
    addMut.mutate({
      watch, shift_date: shiftDate, shift_type: shiftType,
      appliance: meta.appliance, crew_role: role,
      user_id: userId, external_name: extName,
      is_change_of_shift: !!extName,
    });
  };

  const handleExternalAdd = (
    userId: string | undefined,
    name: string | undefined,
    isCoS: boolean,
  ) => {
    setPendingExternal(prev => [...prev, {
      tempId: String(Date.now()),
      userId: userId || undefined,
      name: name ?? (userId ? "External" : "Unknown"),
      isCoS,
    }]);
    setShowExtDialog(false);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-5">

        {/* ── Controls ───────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-end gap-3">

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Watch</label>
            <Select value={watch} onValueChange={v => { setWatch(v); setActiveSlotId(null); }} disabled={!canEdit}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {WATCHES.map(w => <SelectItem key={w} value={w}>{w} Watch</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Shift Date</label>
            <input
              type="date"
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={shiftDate}
              onChange={e => setShiftDate(e.target.value)}
            />
          </div>

          {/* 4-type shift selector */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Shift</label>
            <div className="grid grid-cols-2 gap-px rounded-md border overflow-hidden text-sm bg-border">
              {SHIFT_TYPES.map(s => (
                <button
                  key={s.value}
                  onClick={() => { setShiftType(s.value); setShiftDate(currentShiftDate()); }}
                  className={`px-3 py-2 transition-colors font-medium ${
                    shiftType === s.value
                      ? s.day ? "bg-sky-600 text-white" : "bg-indigo-700 text-white"
                      : "bg-background text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {canEdit && (
            <Button variant="outline" size="sm" className="gap-2 ml-auto" onClick={() => copyMut.mutate()} disabled={copyMut.isPending}>
              {copyMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
              Copy Previous
            </Button>
          )}
        </div>

        {/* ── Shift header ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-sm font-semibold">
            {format(parseISO(shiftDate), "EEEE d MMMM yyyy")} — {shiftType} Shift — {watch} Watch
          </h2>
          <Badge variant="secondary" className="text-xs">{entries.length} crew assigned</Badge>
        </div>

        {/* ── Loading ───────────────────────────────────────────────────────── */}
        {crewingLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[...Array(2)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2"><Skeleton className="h-5 w-40" /></CardHeader>
                <CardContent className="space-y-3 px-4">
                  {[...Array(5)].map((_, j) => <Skeleton key={j} className="h-9 w-full" />)}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          /* ── Main grid: Appliances | Roster ─────────────────────────────── */
          <div className="grid xl:grid-cols-[1fr_300px] gap-5">

            {/* Left column: appliance cards */}
            <div className="space-y-4">
              <ApplianceSlotsCard
                appliance="b10p1"
                entries={b10p1}
                roster={roster}
                canEdit={canEdit}
                activeSlotId={activeSlotId}
                isDragActive={!!draggingMember || !!draggingEntry}
                addPending={addMut.isPending}
                onActivateSlot={id => { setActiveSlotId(id); setShowDetached(false); }}
                onDeactivateSlot={() => setActiveSlotId(null)}
                onSlotAssign={handleSlotAssign}
                onRemove={id => removeMut.mutate(id)}
              />
              <ApplianceSlotsCard
                appliance="b10p2"
                entries={b10p2}
                roster={roster}
                canEdit={canEdit}
                activeSlotId={activeSlotId}
                isDragActive={!!draggingMember || !!draggingEntry}
                addPending={addMut.isPending}
                onActivateSlot={id => { setActiveSlotId(id); setShowDetached(false); }}
                onDeactivateSlot={() => setActiveSlotId(null)}
                onSlotAssign={handleSlotAssign}
                onRemove={id => removeMut.mutate(id)}
              />
              <DetachedCard
                entries={detached}
                roster={roster}
                canEdit={canEdit}
                showPicker={showDetached}
                isPending={addMut.isPending}
                isDragActive={!!draggingMember || !!draggingEntry}
                allAssignedIds={allAssignedIds}
                onShowPicker={() => { setShowDetached(true); setActiveSlotId(null); }}
                onHidePicker={() => setShowDetached(false)}
                onAssign={(uid, ext) => addMut.mutate({ watch, shift_date: shiftDate, shift_type: shiftType, appliance: "detached", crew_role: "detached", user_id: uid, external_name: ext, is_change_of_shift: !!ext })}
                onRemove={id => removeMut.mutate(id)}
              />
            </div>

            {/* Right column: roster tiles (sticky on xl) */}
            <div>
              <RosterPanel
                roster={roster}
                assignedByUserId={assignedByUserId}
                absentIds={absentIds}
                adjustmentByUserId={adjustmentByUserId}
                h4hCovers={h4hCovers}
                inboundCovers={inboundCovers}
                isLoading={rosterLoading}
                watch={watch}
                canEdit={canEdit}
                pendingExternal={pendingExternal}
                onDismissPending={tempId => setPendingExternal(prev => prev.filter(p => p.tempId !== tempId))}
                onExternalClick={() => setShowExtDialog(true)}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Drag overlay — ghost tile that follows the cursor ────────────── */}
      <DragOverlay dropAnimation={null}>
        {draggingMember && <TileCard member={draggingMember} isOverlay />}
        {draggingEntry  && <SlotDragOverlay entry={draggingEntry} />}
      </DragOverlay>

      {/* ── External / CoS dialog ──────────────────────────────────────── */}
      <ExternalDialog
        open={showExtDialog}
        onClose={() => setShowExtDialog(false)}
        onAdd={handleExternalAdd}
        currentWatch={watch}
      />

      {/* ── Detachment modal — shown when tile is dropped onto detached zone ── */}
      <DetachmentModal
        open={!!pendingDetach}
        name={
          pendingDetach?.member?.name ??
          pendingDetach?.entry?.user_name ??
          pendingDetach?.entry?.external_name ??
          "Unknown"
        }
        shiftDate={shiftDate}
        isPending={detachMut.isPending}
        onConfirm={(toStation, reason, notes) => {
          const member = pendingDetach?.member;
          const entry  = pendingDetach?.entry;
          detachMut.mutate({
            firefighterId:   member?.id ?? entry?.user_id ?? "",
            firefighterName: member?.name ?? entry?.user_name ?? entry?.external_name ?? "Unknown",
            toStation,
            reason,
            notes,
            userId:       member?.id ?? entry?.user_id       ?? undefined,
            externalName: entry?.external_name               ?? undefined,
          });
        }}
        onCancel={() => setPendingDetach(null)}
      />
    </DndContext>
  );
}
