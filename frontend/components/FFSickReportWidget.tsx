import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/App";
import backend from "@/lib/backend";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Thermometer, Plus, X, Camera, FileImage, Pencil,
  CheckCircle, Clock, ChevronDown, ChevronUp, Loader2,
} from "lucide-react";

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      // Max 1200px wide, preserve aspect ratio
      const maxW = 1200;
      const scale = Math.min(1, maxW / img.width);
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = reject;
    img.src = url;
  });
}

export default function FFSickReportWidget() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showForm, setShowForm] = useState(false);
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [reason, setReason] = useState("");
  const [sickLineDoc, setSickLineDoc] = useState<string>("");
  const [sickLinePreview, setSickLinePreview] = useState<string>("");
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Edit mode
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editDoc, setEditDoc] = useState<string>("");
  const editFileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["my-absences", user?.id],
    queryFn: () => backend.absence.list({ user_id: user!.id, limit: 10 }),
    enabled: !!user?.id,
  });

  const absences = data?.absences ?? [];
  const sickAbsences = absences.filter((a) => a.type === "sickness").slice(0, 5);

  const reportMutation = useMutation({
    mutationFn: () => backend.absence.selfReport({
      start_date: new Date(startDate),
      end_date: new Date(endDate),
      reason: reason.trim() || undefined,
      sick_line_document: sickLineDoc || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-absences"] });
      queryClient.invalidateQueries({ queryKey: ["absences"] });
      toast({ title: "Sickness reported", description: "Your Watch Commander has been notified." });
      setShowForm(false);
      setStartDate(new Date().toISOString().split("T")[0]);
      setEndDate(new Date().toISOString().split("T")[0]);
      setReason("");
      setSickLineDoc("");
      setSickLinePreview("");
    },
    onError: () => toast({ title: "Failed to report sickness", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (params: { id: number; start_date?: Date; end_date?: Date; sick_line_document?: string }) =>
      (backend.absence as any).updateAbsence(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-absences"] });
      queryClient.invalidateQueries({ queryKey: ["absences"] });
      toast({ title: "Absence updated" });
      setEditingId(null);
    },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, mode: "new" | "edit") => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingDoc(true);
    try {
      const compressed = await compressImage(file);
      if (mode === "new") {
        setSickLineDoc(compressed);
        setSickLinePreview(compressed);
      } else {
        setEditDoc(compressed);
      }
    } catch {
      toast({ title: "Failed to process image", variant: "destructive" });
    } finally {
      setUploadingDoc(false);
      e.target.value = "";
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (new Date(endDate) < new Date(startDate)) {
      toast({ title: "End date must be on or after start date", variant: "destructive" });
      return;
    }
    reportMutation.mutate();
  };

  const handleUpdate = () => {
    if (!editingId) return;
    updateMutation.mutate({
      id: editingId,
      start_date: editStart ? new Date(editStart) : undefined,
      end_date: editEnd ? new Date(editEnd) : undefined,
      sick_line_document: editDoc || undefined,
    });
  };

  const fmt = (d: any) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <Card className="border-t-2 border-t-red-500">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <Thermometer className="h-5 w-5 text-red-500" />
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Sickness</CardTitle>
        </div>
        {!showForm && (
          <Button
            size="sm"
            onClick={() => setShowForm(true)}
            className="h-7 text-xs bg-red-500 hover:bg-red-600 text-white gap-1"
          >
            <Plus className="h-3.5 w-3.5" /> Report sick
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-4">

        {/* ── Report form ── */}
        {showForm && (
          <form onSubmit={handleSubmit} className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/30 p-4 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-semibold text-foreground">Report Sickness</p>
              <button type="button" onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">First day off</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full h-8 rounded-lg border border-border px-2 text-sm bg-background outline-none focus:border-red-400"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Expected return</label>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full h-8 rounded-lg border border-border px-2 text-sm bg-background outline-none focus:border-red-400"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Reason (optional)</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Back injury, illness"
                className="w-full h-8 rounded-lg border border-border px-3 text-sm bg-background outline-none focus:border-red-400"
              />
            </div>

            {/* Sick line upload */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Sick line / doctor's note (optional)</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handleFileUpload(e, "new")}
              />
              {sickLinePreview ? (
                <div className="relative rounded-xl overflow-hidden h-24 border border-border">
                  <img src={sickLinePreview} alt="Sick line" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => { setSickLineDoc(""); setSickLinePreview(""); }}
                    className="absolute top-1 right-1 bg-black/50 hover:bg-black/70 text-white rounded-full p-1"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingDoc}
                  className="w-full flex items-center justify-center gap-2 h-16 rounded-xl border-2 border-dashed border-border text-sm text-muted-foreground hover:border-red-400 hover:text-foreground hover:bg-red-50/30 transition-all"
                >
                  {uploadingDoc ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                  {uploadingDoc ? "Processing…" : "Take photo or upload file"}
                </button>
              )}
            </div>

            <Button
              type="submit"
              disabled={reportMutation.isPending}
              className="w-full bg-red-500 hover:bg-red-600 text-white h-9"
            >
              {reportMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {reportMutation.isPending ? "Submitting…" : "Submit & Notify Watch Commander"}
            </Button>
          </form>
        )}

        {/* ── Recent sick records ── */}
        {isLoading ? (
          <div className="text-sm text-muted-foreground text-center py-4">Loading…</div>
        ) : sickAbsences.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-400" />
            <p className="text-sm font-medium text-green-600">No sickness on record</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Recent absences</p>
            {sickAbsences.map((a) => {
              const isExpanded = expandedId === a.id;
              const isEditing = editingId === a.id;
              return (
                <div key={a.id} className="rounded-xl border border-border bg-muted/20 overflow-hidden">
                  <div
                    className="flex items-center justify-between px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : a.id)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Thermometer className="h-3.5 w-3.5 text-red-400 shrink-0" />
                      <span className="text-sm font-medium truncate">{fmt(a.start_date)} → {fmt(a.end_date)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {(a as any).sick_line_document && (
                        <FileImage className="h-3.5 w-3.5 text-indigo-400" title="Sick line attached" />
                      )}
                      <Badge
                        variant="outline"
                        className={`text-xs ${a.status === "approved" ? "text-green-600 dark:text-green-400 border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/40" : "text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40"}`}
                      >
                        {a.status === "approved" ? "Approved" : "Pending"}
                      </Badge>
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-3 pb-3 pt-1 border-t border-border space-y-3">
                      {isEditing ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">First day off</label>
                              <input type="date" value={editStart} onChange={(e) => setEditStart(e.target.value)}
                                className="w-full h-7 rounded-lg border border-border px-2 text-xs bg-background outline-none focus:border-indigo-400" />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">Return date</label>
                              <input type="date" value={editEnd} min={editStart} onChange={(e) => setEditEnd(e.target.value)}
                                className="w-full h-7 rounded-lg border border-border px-2 text-xs bg-background outline-none focus:border-indigo-400" />
                            </div>
                          </div>

                          {/* Sick line re-upload */}
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Update sick line photo</label>
                            <input ref={editFileRef} type="file" accept="image/*" capture="environment"
                              className="hidden" onChange={(e) => handleFileUpload(e, "edit")} />
                            {editDoc ? (
                              <div className="relative rounded-lg overflow-hidden h-16">
                                <img src={editDoc} alt="New sick line" className="w-full h-full object-cover" />
                                <button type="button" onClick={() => setEditDoc("")}
                                  className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5">
                                  <X className="h-2.5 w-2.5" />
                                </button>
                              </div>
                            ) : (
                              <button type="button" onClick={() => editFileRef.current?.click()}
                                className="w-full flex items-center justify-center gap-1.5 h-10 rounded-lg border-2 border-dashed border-border text-xs text-muted-foreground hover:border-indigo-400 hover:bg-indigo-50/30 transition-all">
                                <Camera className="h-3.5 w-3.5" /> Replace photo
                              </button>
                            )}
                          </div>

                          <div className="flex gap-2">
                            <Button size="sm" onClick={handleUpdate} disabled={updateMutation.isPending}
                              className="flex-1 h-7 text-xs bg-indigo-600 hover:bg-indigo-700">
                              {updateMutation.isPending ? "Saving…" : "Save changes"}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingId(null)}
                              className="h-7 text-xs">Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {a.reason && <p className="text-xs text-muted-foreground">{a.reason}</p>}
                          {(a as any).sick_line_document && (
                            <div className="rounded-lg overflow-hidden border border-border">
                              <img src={(a as any).sick_line_document} alt="Sick line document" className="w-full object-contain max-h-40" />
                            </div>
                          )}
                          <button
                            onClick={() => {
                              setEditingId(a.id);
                              setEditStart(new Date(a.start_date).toISOString().split("T")[0]);
                              setEditEnd(new Date(a.end_date).toISOString().split("T")[0]);
                              setEditDoc("");
                            }}
                            className="flex items-center gap-1.5 text-xs text-indigo-600 hover:underline"
                          >
                            <Pencil className="h-3 w-3" /> Edit dates / update sick line
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
