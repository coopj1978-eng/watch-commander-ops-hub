import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { useAuth } from "@/App";
import backend from "@/lib/backend";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Camera, FileImage, Loader2, Thermometer, X, Info,
} from "lucide-react";
import { compressImage } from "@/lib/imageCompress";

// ──────────────────────────────────────────────────────────────────────────────
// FFSickLineUpload
//
// Firefighter-facing view of their own sickness absences, with a sick-line
// upload / replace action per row. Read-only on everything else:
//   • Dates are NOT editable here (policy: only WC/CC adjust sick dates).
//   • New sickness bookings are NOT created here (policy: WC/CC record the
//     booking via the Log Sick flow). This widget only attaches evidence
//     to bookings the WC/CC already logged.
//
// Uses backend.absence.updateAbsence — the endpoint permits the FF to write
// `sick_line_document` on their own rows. Because this UI never sends
// `start_date` or `end_date` in the mutation payload, the FF genuinely can
// only upload a photo through this surface, even though the endpoint would
// technically accept date fields too.
//
// When the sick line goes from null → set, the backend fires a "Sick Line
// Uploaded" notification to the WC + CCs on the firefighter's watch.
// ──────────────────────────────────────────────────────────────────────────────

type SickAbsence = {
  id: number;
  firefighter_id: string;
  type: string;
  status: string;
  start_date: string;
  end_date: string;
  reason?: string;
  sick_line_document?: string;
};

export default function FFSickLineUpload() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["my-absences", user?.id],
    queryFn: () => backend.absence.list({ user_id: user!.id, limit: 20 }),
    enabled: !!user?.id,
  });

  // Only sickness rows — AbsenceRequest handles everything else.
  const absences = ((data?.absences ?? []) as SickAbsence[]).filter(
    (a) => a.type === "sickness"
  );

  // Newest first, bounded to what a FF would plausibly need to attach a
  // retrospective sick line for.
  const sorted = absences
    .slice()
    .sort(
      (a, b) =>
        new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
    )
    .slice(0, 10);

  return (
    <Card className="border-t-2 border-t-brand">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-2">
          <Thermometer className="h-4 w-4 text-brand" />
          <CardTitle className="text-sm font-medium">Sick Line Uploads</CardTitle>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <p className="leading-snug">
            Sick bookings are recorded by your Watch Commander or Crew Commander.
            Use this page to attach a sick line to an existing absence — it goes
            straight to your WC for review.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground italic text-center py-4">
            You don't have any sickness absences on record.
          </p>
        ) : (
          <ul className="space-y-2">
            {sorted.map((absence) => (
              <SickAbsenceRow
                key={absence.id}
                absence={absence}
                onUpdated={() => {
                  queryClient.invalidateQueries({ queryKey: ["my-absences"] });
                  queryClient.invalidateQueries({ queryKey: ["absences"] });
                  toast({
                    title: "Sick line uploaded",
                    description: "Your Watch Commander has been notified.",
                  });
                }}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Per-absence row — shows dates / reason / status, plus upload or replace
// action for the sick line photo.
// ──────────────────────────────────────────────────────────────────────────────
function SickAbsenceRow({
  absence,
  onUpdated,
}: {
  absence: SickAbsence;
  onUpdated: () => void;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: (sickLineDoc: string) =>
      // Only send sick_line_document — dates stay as they are, so the FF
      // can't inadvertently or maliciously shift their own sick dates
      // through this surface. (The backend would allow it, but we don't
      // expose the field.)
      (backend.absence as any).updateAbsence({
        id: absence.id,
        sick_line_document: sickLineDoc,
      }),
    onSuccess: onUpdated,
    onError: () =>
      toast({ title: "Failed to upload sick line", variant: "destructive" }),
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const compressed = await compressImage(file);
      await mutation.mutateAsync(compressed);
    } catch (err) {
      toast({ title: "Couldn't process that image", variant: "destructive" });
    } finally {
      setUploading(false);
      // Let the same file be re-selected later if the user changes their mind.
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const startFmt = format(parseISO(absence.start_date), "dd MMM yyyy");
  const endFmt = format(parseISO(absence.end_date), "dd MMM yyyy");
  const dateLabel = startFmt === endFmt ? startFmt : `${startFmt} → ${endFmt}`;
  const hasSickLine = !!absence.sick_line_document;

  return (
    <li className="rounded-lg border bg-background overflow-hidden">
      <div className="flex items-start gap-3 p-3">
        {/* Thumbnail or placeholder — click to preview full-size if present */}
        {hasSickLine ? (
          <button
            type="button"
            onClick={() => setPreviewOpen((o) => !o)}
            className="shrink-0 h-12 w-12 rounded border overflow-hidden bg-muted flex items-center justify-center"
            aria-label="Preview uploaded sick line"
          >
            <img
              src={absence.sick_line_document}
              alt="Sick line"
              className="h-full w-full object-cover"
            />
          </button>
        ) : (
          <div className="shrink-0 h-12 w-12 rounded border bg-muted flex items-center justify-center text-muted-foreground">
            <FileImage className="h-5 w-5 opacity-40" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{dateLabel}</p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <Badge
              variant="outline"
              className={
                absence.status === "approved"
                  ? "text-[10px] text-green-700 dark:text-green-400 border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/40"
                  : "text-[10px] text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40"
              }
            >
              {absence.status === "approved" ? "Approved" : absence.status}
            </Badge>
            {hasSickLine ? (
              <span className="text-[10px] text-muted-foreground">
                Sick line attached
              </span>
            ) : (
              <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                No sick line yet
              </span>
            )}
          </div>
          {absence.reason && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {absence.reason}
            </p>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />

        <Button
          size="sm"
          variant={hasSickLine ? "outline" : "default"}
          className={
            hasSickLine
              ? "shrink-0 h-8 text-xs"
              : "shrink-0 h-8 text-xs bg-brand hover:bg-brand/90 text-brand-foreground"
          }
          disabled={uploading || mutation.isPending}
          onClick={() => fileRef.current?.click()}
        >
          {uploading || mutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <>
              <Camera className="h-3.5 w-3.5 mr-1" />
              {hasSickLine ? "Replace" : "Upload"}
            </>
          )}
        </Button>
      </div>

      {/* Expandable full-size preview — collapses on second click so the user
          can hide a sensitive document quickly on a shared screen. */}
      {hasSickLine && previewOpen && (
        <div className="relative border-t bg-muted/20 p-3">
          <button
            type="button"
            onClick={() => setPreviewOpen(false)}
            className="absolute top-2 right-2 z-10 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
            aria-label="Close preview"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <img
            src={absence.sick_line_document}
            alt="Sick line document"
            className="mx-auto max-h-96 rounded border bg-background object-contain"
          />
        </div>
      )}
    </li>
  );
}
