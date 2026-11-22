import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bell, Calendar as CalendarIcon, Download, FileText, Loader2, MoreHorizontal, Paperclip, Pencil, Plus, Trash2, X,
} from "lucide-react";
import { useBackend } from "@/lib/rbac";
import type { note as noteApi } from "@/client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { refreshCalendar } from "@/lib/calendarQueries";

// The Notes & 1:1s tab (Nov 2026). Each note has a title — what it was about —
// so the list reads at a glance, and the writer can edit or delete it. Notes
// stay private to whoever wrote them (the server only ever lists your own).

type Note = noteApi.Note;

const longDate = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
const dayMonth = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

// A note can hold as many files as it needs (the server's limit is per file).
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif";
const fileKey = (f: File) => `${f.name}:${f.size}:${f.lastModified}`;
const sizeText = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
const titleCls = "h-10 w-full rounded-xl border border-border bg-background px-3 text-sm font-medium placeholder:font-normal";
const textCls = "w-full rounded-xl border border-border bg-background p-3 text-sm";
const dateCls = "h-8 pointer-coarse:h-11 rounded-lg border border-border bg-background px-2 text-xs text-foreground";

interface Draft {
  title: string;
  note_text: string;
  next_follow_up_date: string;
  reminder_enabled: boolean;
}
const EMPTY: Draft = { title: "", note_text: "", next_follow_up_date: "", reminder_enabled: false };

/** Title, note, follow-up date and reminder — shared by "new note" and "edit". */
function NoteFields({ draft, onChange, firstName, autoFocus }: {
  draft: Draft;
  onChange: (d: Draft) => void;
  firstName: string;
  autoFocus?: boolean;
}) {
  return (
    <>
      <input
        value={draft.title}
        onChange={(e) => onChange({ ...draft, title: e.target.value })}
        placeholder="Title — what was it about?"
        maxLength={120}
        autoFocus={autoFocus}
        className={titleCls}
        aria-label="Title"
      />
      <textarea
        value={draft.note_text}
        onChange={(e) => onChange({ ...draft, note_text: e.target.value })}
        placeholder={`What did you and ${firstName} talk about?`}
        rows={5}
        className={cn(textCls, "mt-2")}
        aria-label="Note"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Follow up
          <input
            type="date"
            value={draft.next_follow_up_date}
            onChange={(e) => onChange({ ...draft, next_follow_up_date: e.target.value })}
            className={dateCls}
          />
        </label>
        <label className="flex cursor-pointer items-center gap-1.5 text-xs pointer-coarse:min-h-11">
          <input
            type="checkbox"
            checked={draft.reminder_enabled}
            onChange={(e) => onChange({ ...draft, reminder_enabled: e.target.checked })}
            className="h-4 w-4"
          />
          Remind me
        </label>
      </div>
      {draft.reminder_enabled && !draft.next_follow_up_date && (
        <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Pick a follow-up date for the reminder.</p>
      )}
    </>
  );
}

export function ProfileNotes({ profileId, firstName, notes, canWrite }: {
  profileId: number;
  firstName: string;
  notes: Note[];
  /** Can add new notes about this person (editing your own is always allowed). */
  canWrite: boolean;
}) {
  const backend = useBackend();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [newNote, setNewNote] = useState<Draft>(EMPTY);
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [edit, setEdit] = useState<Draft>(EMPTY);
  const [deleting, setDeleting] = useState<Note | null>(null);
  const [addingTo, setAddingTo] = useState<number | null>(null);
  const [removingFile, setRemovingFile] = useState<{ note: Note; key: string; filename: string } | null>(null);

  // New note: each pick ADDS to the list (on a phone you choose one photo at
  // a time), and any of them can be taken off again before saving.
  const addPicked = (list: FileList | null) => {
    if (!list?.length) return;
    const picked = Array.from(list);
    const tooBig = picked.filter((f) => f.size > MAX_FILE_BYTES);
    if (tooBig.length) {
      toast({
        title: tooBig.length === 1 ? `${tooBig[0].name} is over 10 MB` : `${tooBig.length} files are over 10 MB`,
        description: "Each file can be up to 10 MB.",
        variant: "destructive",
      });
    }
    setUploadingFiles((prev) => {
      const have = new Set(prev.map(fileKey));
      return [...prev, ...picked.filter((f) => f.size <= MAX_FILE_BYTES && !have.has(fileKey(f)))];
    });
  };

  // A note already saved: more files go straight on.
  const addFilesToNote = async (note: Note, list: FileList | null) => {
    if (!list?.length) return;
    setAddingTo(note.id);
    let ok = 0;
    const failed: string[] = [];
    for (const file of Array.from(list)) {
      if (file.size > MAX_FILE_BYTES) { failed.push(`${file.name} (over 10 MB)`); continue; }
      try {
        await backend.note.uploadFile(note.id, file, file.name);
        ok++;
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error);
        failed.push(file.name);
      }
    }
    setAddingTo(null);
    queryClient.invalidateQueries({ queryKey: ["notes", profileId] });
    if (ok) toast({ title: ok === 1 ? "File attached" : `${ok} files attached` });
    if (failed.length) {
      toast({ title: "Some files weren't attached", description: failed.join(", "), variant: "destructive" });
    }
  };

  const refresh = (calendarToo: boolean) => {
    queryClient.invalidateQueries({ queryKey: ["notes", profileId] });
    if (calendarToo) {
      refreshCalendar(queryClient);
      queryClient.invalidateQueries({ queryKey: ["crewing-roster"] });
    }
  };

  const createNote = useMutation({
    mutationFn: async () => {
      if (newNote.reminder_enabled && !newNote.next_follow_up_date) {
        throw new Error("Pick a follow-up date for the reminder");
      }
      const note = await backend.note.create({
        profile_id: profileId,
        title: newNote.title.trim() || undefined,
        note_text: newNote.note_text,
        next_follow_up_date: newNote.next_follow_up_date || undefined,
        reminder_enabled: newNote.reminder_enabled,
      });

      for (const file of uploadingFiles) {
        try {
          await backend.note.uploadFile(note.id, file, file.name);
        } catch (error) {
          console.error(`Failed to upload ${file.name}:`, error);
          toast({
            title: "File upload warning",
            description: `Couldn't upload ${file.name}. The note was saved without it.`,
            variant: "destructive",
          });
        }
      }
      return note;
    },
    onSuccess: () => {
      refresh(newNote.reminder_enabled);
      toast({
        title: "Note added",
        description: [
          uploadingFiles.length ? (uploadingFiles.length === 1 ? "1 file attached" : `${uploadingFiles.length} files attached`) : "",
          newNote.reminder_enabled ? "reminder set" : "",
        ].filter(Boolean).join(", ") || undefined,
      });
      setNewNote(EMPTY);
      setUploadingFiles([]);
    },
    onError: (error: any) => {
      toast({ title: "Couldn't add the note", description: error?.message || "An error occurred", variant: "destructive" });
    },
  });

  const updateNote = useMutation({
    mutationFn: async (note: Note) =>
      backend.note.update(note.id, {
        title: edit.title.trim(),
        note_text: edit.note_text,
        next_follow_up_date: edit.next_follow_up_date,
        reminder_enabled: edit.reminder_enabled,
      }),
    onSuccess: (_, note) => {
      refresh(note.reminder_enabled || edit.reminder_enabled);
      setEditingId(null);
      toast({ title: "Note saved" });
    },
    onError: (error: any) => {
      toast({ title: "Couldn't save the note", description: error?.message || "An error occurred", variant: "destructive" });
    },
  });

  const deleteNote = useMutation({
    mutationFn: async (note: Note) => backend.note.deleteNote(note.id),
    onSuccess: (_, note) => {
      refresh(note.reminder_enabled);
      setDeleting(null);
      if (editingId === note.id) setEditingId(null);
      toast({ title: "Note deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Couldn't delete the note", description: error?.message || "An error occurred", variant: "destructive" });
    },
  });

  const removeFile = useMutation({
    mutationFn: async (f: { note: Note; key: string }) => backend.note.removeFile(f.note.id, { key: f.key }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes", profileId] });
      setRemovingFile(null);
      toast({ title: "File removed" });
    },
    onError: (error: any) => {
      toast({ title: "Couldn't remove the file", description: error?.message || "An error occurred", variant: "destructive" });
    },
  });

  const startEdit = (note: Note) => {
    setEditingId(note.id);
    setEdit({
      title: note.title ?? "",
      note_text: note.note_text,
      next_follow_up_date: note.next_follow_up_date ?? "",
      reminder_enabled: note.reminder_enabled,
    });
  };

  const sorted = [...notes].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div className="grid items-start gap-4 lg:grid-cols-5">
      {canWrite && (
        <section className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5 lg:sticky lg:top-24 lg:col-span-2">
          <h2 className="text-sm font-semibold">New note or 1:1</h2>
          <p className="mb-3 mt-0.5 text-xs text-muted-foreground">Only you can see your notes and their reminders.</p>
          <NoteFields draft={newNote} onChange={setNewNote} firstName={firstName} />
          <div className="mt-2 flex">
            <label className="ml-auto inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium hover:bg-muted">
              <Paperclip className="h-3.5 w-3.5" /> {uploadingFiles.length ? "Attach more" : "Attach files"}
              <input
                type="file"
                multiple
                accept={ACCEPT}
                className="sr-only"
                // Cleared after each pick so the same file can be chosen again.
                onChange={(e) => { addPicked(e.target.files); e.target.value = ""; }}
              />
            </label>
          </div>
          {uploadingFiles.length > 0 && (
            <ul className="mt-2 space-y-1">
              {uploadingFiles.map((file) => (
                <li key={fileKey(file)} className="flex items-center gap-2 rounded-lg border border-border/70 py-1 pl-2 pr-1 text-xs">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{file.name}</span>
                  <span className="shrink-0 text-muted-foreground">{sizeText(file.size)}</span>
                  <button
                    type="button"
                    aria-label={`Take ${file.name} off this note`}
                    onClick={() => setUploadingFiles((prev) => prev.filter((f) => fileKey(f) !== fileKey(file)))}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Button
            onClick={() => createNote.mutate()}
            disabled={!newNote.note_text.trim() || createNote.isPending}
            className="mt-3 w-full bg-indigo-600 hover:bg-indigo-700"
          >
            <Plus className="mr-2 h-4 w-4" /> {createNote.isPending ? "Saving…" : "Add note"}
          </Button>
        </section>
      )}

      <section className={cn("rounded-2xl border border-border/70 bg-card p-4 sm:p-5", canWrite ? "lg:col-span-3" : "lg:col-span-5")}>
        <h2 className="text-sm font-semibold">
          Your notes {notes.length > 0 && <span className="font-normal text-muted-foreground">· {notes.length}</span>}
        </h2>
        {sorted.length ? (
          <ol className="relative ml-1.5 mt-4 border-l border-border/70">
            {sorted.map((note) => {
              const isEditing = editingId === note.id;
              const edited = new Date(note.updated_at).getTime() - new Date(note.created_at).getTime() > 60_000;
              return (
                <li key={note.id} className="relative pb-6 pl-5 last:pb-0">
                  <span aria-hidden className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-foreground" />
                  <div className="flex items-start gap-2">
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                      <span className="text-xs font-medium text-muted-foreground">{longDate(note.created_at)}</span>
                      {edited && <span className="text-[11px] text-muted-foreground">· edited {dayMonth(note.updated_at)}</span>}
                      {!isEditing && note.next_follow_up_date && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                          <CalendarIcon className="h-3 w-3" /> Follow up {dayMonth(note.next_follow_up_date)}
                        </span>
                      )}
                      {!isEditing && note.reminder_enabled && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                          <Bell className="h-3 w-3" /> Reminder
                        </span>
                      )}
                    </div>
                    {!isEditing && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label="Note options"
                            className="-mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => startEdit(note)}>
                            <Pencil className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setDeleting(note)} className="text-red-600 focus:text-red-600">
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="mt-2 rounded-xl border border-foreground/30 p-3">
                      <NoteFields draft={edit} onChange={setEdit} firstName={firstName} autoFocus />
                      <div className="mt-3 flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="h-8 rounded-lg border border-border px-2.5 text-xs font-medium hover:bg-muted"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => updateNote.mutate(note)}
                          disabled={
                            !edit.note_text.trim() || updateNote.isPending || (edit.reminder_enabled && !edit.next_follow_up_date)
                          }
                          className="h-8 rounded-lg bg-foreground px-3 text-xs font-medium text-background disabled:opacity-50"
                        >
                          {updateNote.isPending ? "Saving…" : "Save"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {note.title ? (
                        <h3 className="mt-1 text-[15px] font-semibold leading-snug">{note.title}</h3>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEdit(note)}
                          className="mt-1 text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                        >
                          + Add a title
                        </button>
                      )}
                      <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/90">{note.note_text}</p>
                    </>
                  )}

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {(note.attachments ?? []).map((attachment, idx) => (
                      <span key={attachment.key ?? idx} className="inline-flex max-w-full items-center rounded-lg border border-border text-xs">
                        <a
                          href={attachment.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-w-0 items-center gap-1.5 rounded-l-lg px-2 py-1.5 hover:bg-muted"
                        >
                          <FileText className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{attachment.filename}</span>
                          <Download className="h-3 w-3 shrink-0 text-muted-foreground" />
                        </a>
                        {attachment.key && (
                          <button
                            type="button"
                            aria-label={`Remove ${attachment.filename}`}
                            onClick={() => setRemovingFile({ note, key: attachment.key!, filename: attachment.filename })}
                            className="grid h-7 w-7 shrink-0 place-items-center rounded-r-lg border-l border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </span>
                    ))}
                    {/* More files can go on a saved note at any time. */}
                    <label
                      className={cn(
                        "inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-border px-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
                        addingTo === note.id && "pointer-events-none opacity-70",
                      )}
                    >
                      {addingTo === note.id ? (
                        <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Attaching…</>
                      ) : (
                        <><Paperclip className="h-3.5 w-3.5" /> {note.attachments?.length ? "Add files" : "Attach files"}</>
                      )}
                      <input
                        type="file"
                        multiple
                        accept={ACCEPT}
                        className="sr-only"
                        disabled={addingTo === note.id}
                        onChange={(e) => { const picked = e.target.files; void addFilesToNote(note, picked).finally(() => { e.target.value = ""; }); }}
                      />
                    </label>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">No notes yet.</p>
        )}
      </section>

      <AlertDialog open={!!removingFile} onOpenChange={(open) => !open && setRemovingFile(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this file?</AlertDialogTitle>
            <AlertDialogDescription>
              {removingFile?.filename} will be taken off the note and deleted. This can't be undone. The note itself stays.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); if (removingFile) removeFile.mutate(removingFile); }}
              className="bg-red-600 hover:bg-red-700"
            >
              {removeFile.isPending ? "Removing…" : "Remove file"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this note?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.title ? `"${deleting.title}" from ` : "Your note from "}
              {deleting ? longDate(deleting.created_at) : ""} will be gone for good
              {deleting?.reminder_enabled ? ", and its reminder comes off your calendar" : ""}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (deleting) deleteNote.mutate(deleting);
              }}
              disabled={deleteNote.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteNote.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
