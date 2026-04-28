import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO, formatDistanceToNowStrict } from "date-fns";
import { useAuth } from "@/App";
import backend from "@/lib/backend";
import { useToast } from "@/components/ui/use-toast";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Megaphone,
  AlertTriangle,
  CheckCheck,
  Eye,
  Users,
  MapPin,
  Plus,
  Trash2,
  X,
  CircleCheck,
  CircleDashed,
} from "lucide-react";
import type { bulletin } from "@/client";

// ──────────────────────────────────────────────────────────────────────────────
// Bulletins — broadcast communication with read receipts.
//
// Every user sees bulletins targeted at their watch (or station-wide). WCs
// and CCs can post new bulletins — WC can post station-wide, CC limited to
// their own watch. Authors + WCs can see a per-user read/ack table so they
// know who's caught up and who still needs chasing.
//
// Unacknowledged bulletins surface on the dashboard via <BulletinsTile />
// and via a "📢 New bulletin" notification in the bell drawer. Priority
// urgent + requires_ack items stay visible there until explicitly
// acknowledged, so nothing drops through the cracks.
// ──────────────────────────────────────────────────────────────────────────────

const WATCHES = ["Red", "White", "Green", "Blue", "Amber"] as const;

type Tab = "open" | "history" | "create";

export default function Bulletins() {
  const { user } = useAuth();
  const canPost = user?.role === "WC" || user?.role === "CC";
  const [tab, setTab] = useState<Tab>("open");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* Visual-refresh page header: h1 + eyebrow context line. */}
      <header className="flex items-baseline flex-wrap gap-x-4 gap-y-1">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <Megaphone className="h-7 w-7 text-brand shrink-0" />
          Bulletins
        </h1>
        <span className="eyebrow">
          Station + watch-wide notices with read-receipts
        </span>
      </header>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b">
        <TabButton active={tab === "open"} onClick={() => setTab("open")}>
          Open
        </TabButton>
        <TabButton active={tab === "history"} onClick={() => setTab("history")}>
          History
        </TabButton>
        {canPost && (
          <TabButton active={tab === "create"} onClick={() => setTab("create")}>
            <span className="inline-flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              New bulletin
            </span>
          </TabButton>
        )}
      </div>

      {tab === "create" && canPost ? (
        <NewBulletinForm onPosted={() => setTab("open")} />
      ) : (
        <BulletinList
          mode={tab === "history" ? "history" : "open"}
          expandedId={expandedId}
          onToggle={(id) => setExpandedId((curr) => (curr === id ? null : id))}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab button — thin underline-style tab, matches the shadcn look elsewhere.
// ─────────────────────────────────────────────────────────────────────────────
function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
        active
          ? "border-brand text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BulletinList — renders the Open or History view.
// Open: hides already-read+acked items and expired ones (the quick "what's
// new for me" feed). History: the full list.
// ─────────────────────────────────────────────────────────────────────────────
function BulletinList({
  mode,
  expandedId,
  onToggle,
}: {
  mode: "open" | "history";
  expandedId: number | null;
  onToggle: (id: number) => void;
}) {
  const includeRead = mode === "history";
  const q = useQuery({
    queryKey: ["bulletins", includeRead],
    queryFn: () =>
      backend.bulletin.list({ include_read: includeRead, limit: 100 }),
  });

  if (q.isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  const bulletins = q.data?.bulletins ?? [];

  if (bulletins.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          <Megaphone className="h-10 w-10 mx-auto opacity-30 mb-3" />
          <p className="text-sm font-medium">
            {mode === "open"
              ? "You're all caught up — nothing to read."
              : "No bulletins posted yet."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <ul className="space-y-2">
      {bulletins.map((b) => (
        <BulletinRow
          key={b.id}
          bulletin={b}
          expanded={expandedId === b.id}
          onToggle={() => onToggle(b.id)}
        />
      ))}
    </ul>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BulletinRow — collapsed card with priority colour-strip. Expands to show
// the body, mark-as-read / acknowledge affordances, and (for WC/CC) the
// audience read-receipt drawer.
// ─────────────────────────────────────────────────────────────────────────────
function BulletinRow({
  bulletin: b,
  expanded,
  onToggle,
}: {
  bulletin: bulletin.Bulletin;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { user } = useAuth();
  const canManage =
    user?.role === "WC" ||
    user?.role === "CC" ||
    user?.id === b.posted_by;
  const isAuthor = user?.id === b.posted_by;
  const canDelete = isAuthor || user?.role === "WC";

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const priorityBorder =
    b.priority === "urgent"
      ? "border-l-red-500"
      : b.priority === "important"
      ? "border-l-amber-500"
      : "border-l-brand";

  const priorityPill =
    b.priority === "urgent"
      ? "bg-red-100 text-red-700 border-red-300 dark:bg-red-950/40 dark:text-red-300"
      : b.priority === "important"
      ? "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300"
      : "bg-muted text-muted-foreground";

  const scopeLabel =
    b.scope === "station"
      ? "Station-wide"
      : b.watch_unit
      ? `${b.watch_unit} Watch`
      : "Watch";

  const markReadMutation = useMutation({
    mutationFn: () => backend.bulletin.markRead(b.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bulletins"] });
      queryClient.invalidateQueries({ queryKey: ["bulletin-tile"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const acknowledgeMutation = useMutation({
    mutationFn: () => backend.bulletin.acknowledge(b.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bulletins"] });
      queryClient.invalidateQueries({ queryKey: ["bulletin-tile"] });
      queryClient.invalidateQueries({ queryKey: ["bulletin-stats", b.id] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast({ title: "Acknowledged", description: b.title });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => backend.bulletin.deleteBulletin(b.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bulletins"] });
      queryClient.invalidateQueries({ queryKey: ["bulletin-tile"] });
      toast({ title: "Bulletin deleted" });
    },
  });

  return (
    <li>
      <Card className={`border-l-4 ${priorityBorder} overflow-hidden`}>
        <button
          type="button"
          onClick={onToggle}
          className="w-full text-left"
        >
          <div className="flex items-start justify-between gap-3 p-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3
                  className={`text-sm font-semibold truncate ${
                    b.is_read ? "text-muted-foreground" : "text-foreground"
                  }`}
                >
                  {b.title}
                </h3>
                {b.priority !== "routine" && (
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-semibold uppercase tracking-wide ${priorityPill}`}
                  >
                    {b.priority === "urgent" && (
                      <AlertTriangle className="h-2.5 w-2.5 mr-1" />
                    )}
                    {b.priority}
                  </Badge>
                )}
                {b.requires_ack && !b.is_acknowledged && (
                  <Badge className="text-[10px] bg-red-100 text-red-700 border border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900">
                    ACK required
                  </Badge>
                )}
                {!b.is_read && (
                  <span
                    className="h-2 w-2 rounded-full bg-brand shrink-0"
                    aria-label="Unread"
                  />
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5 flex-wrap">
                {b.scope === "station" ? (
                  <MapPin className="h-3 w-3 shrink-0" />
                ) : (
                  <Users className="h-3 w-3 shrink-0" />
                )}
                {scopeLabel}
                <span className="text-muted-foreground/50">·</span>
                <span>
                  by {b.posted_by_name ?? "Unknown"}
                </span>
                <span className="text-muted-foreground/50">·</span>
                <span>
                  {formatDistanceToNowStrict(parseISO(b.created_at), {
                    addSuffix: true,
                  })}
                </span>
              </p>
            </div>
            {b.is_acknowledged ? (
              <Badge
                variant="outline"
                className="text-[10px] gap-1 bg-green-50 border-green-300 text-green-700 dark:bg-green-950/40 dark:text-green-300 dark:border-green-900"
              >
                <CheckCheck className="h-3 w-3" />
                Acked
              </Badge>
            ) : b.is_read ? (
              <Badge
                variant="outline"
                className="text-[10px] gap-1 text-muted-foreground"
              >
                <Eye className="h-3 w-3" />
                Read
              </Badge>
            ) : null}
          </div>
        </button>

        {expanded && (
          <CardContent className="pt-0 pb-4 px-4 border-t space-y-4">
            {/* Body — preserve author's line breaks */}
            <p className="text-sm whitespace-pre-wrap leading-relaxed pt-4">
              {b.body}
            </p>

            {/* ── Reader actions ─────────────────────────────────────────── */}
            <div className="flex items-center gap-2 flex-wrap">
              {!b.is_read && !b.requires_ack && (
                <Button
                  size="sm"
                  className="bg-brand hover:bg-brand/90 text-brand-foreground"
                  disabled={markReadMutation.isPending}
                  onClick={() => markReadMutation.mutate()}
                >
                  <Eye className="h-3.5 w-3.5 mr-1" />
                  Mark as read
                </Button>
              )}
              {b.requires_ack && !b.is_acknowledged && (
                <Button
                  size="sm"
                  className="bg-brand hover:bg-brand/90 text-brand-foreground"
                  disabled={acknowledgeMutation.isPending}
                  onClick={() => acknowledgeMutation.mutate()}
                >
                  <CheckCheck className="h-3.5 w-3.5 mr-1" />
                  I've read &amp; understood
                </Button>
              )}
              {canDelete && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 ml-auto"
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    if (confirm("Delete this bulletin? This cannot be undone.")) {
                      deleteMutation.mutate();
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Delete
                </Button>
              )}
            </div>

            {/* ── WC/CC read-receipts table ──────────────────────────────── */}
            {canManage && <BulletinReadReceipts id={b.id} />}
          </CardContent>
        )}
      </Card>
    </li>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BulletinReadReceipts — per-user table showing who has / hasn't read /
// acknowledged. Only queried when the bulletin row is expanded so we don't
// hammer the stats endpoint for rows nobody's looking at.
// ─────────────────────────────────────────────────────────────────────────────
function BulletinReadReceipts({ id }: { id: number }) {
  const q = useQuery({
    queryKey: ["bulletin-stats", id],
    queryFn: () => backend.bulletin.getStats(id),
    staleTime: 30_000,
  });

  if (q.isLoading) {
    return (
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-40" />
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  const data = q.data;
  if (!data) return null;

  const { bulletin: b, audience } = data;
  const readPct =
    b.audience_count && b.audience_count > 0
      ? Math.round(((b.read_count ?? 0) / b.audience_count) * 100)
      : 0;
  const ackPct =
    b.audience_count && b.audience_count > 0
      ? Math.round(((b.acknowledged_count ?? 0) / b.audience_count) * 100)
      : 0;

  return (
    <div className="space-y-2 pt-1 border-t">
      <div className="flex items-center justify-between pt-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Read-receipts
        </h4>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Eye className="h-3 w-3" />
            <span className="font-mono tabular-nums">
              {b.read_count ?? 0}/{b.audience_count ?? 0}
            </span>
            <span className="text-muted-foreground/60">({readPct}%)</span>
          </span>
          {b.requires_ack && (
            <span className="inline-flex items-center gap-1">
              <CheckCheck className="h-3 w-3" />
              <span className="font-mono tabular-nums">
                {b.acknowledged_count ?? 0}/{b.audience_count ?? 0}
              </span>
              <span className="text-muted-foreground/60">({ackPct}%)</span>
            </span>
          )}
        </div>
      </div>

      <ul className="divide-y divide-border/60 border rounded-lg overflow-hidden">
        {audience.map((a) => {
          const readRow = !!a.read_at;
          const ackRow = !!a.acknowledged_at;
          return (
            <li
              key={a.user_id}
              className="flex items-center gap-3 px-3 py-1.5 text-xs"
            >
              {ackRow ? (
                <CircleCheck className="h-3.5 w-3.5 text-green-500 shrink-0" />
              ) : readRow ? (
                <Eye className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              ) : (
                <CircleDashed className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
              )}
              <span className="flex-1 min-w-0 truncate font-medium">
                {a.name}
              </span>
              {a.rank && (
                <span className="text-muted-foreground shrink-0">
                  {a.rank}
                </span>
              )}
              <span className="text-muted-foreground shrink-0 min-w-[110px] text-right font-mono tabular-nums">
                {ackRow
                  ? `Acked ${format(parseISO(a.acknowledged_at!), "d MMM HH:mm")}`
                  : readRow
                  ? `Read ${format(parseISO(a.read_at!), "d MMM HH:mm")}`
                  : "Unread"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NewBulletinForm — the WC/CC author surface. Kept as a single-page form
// rather than a dialog so the body Textarea has room to breathe (bulletins
// are often a paragraph or two).
// ─────────────────────────────────────────────────────────────────────────────
function NewBulletinForm({ onPosted }: { onPosted: () => void }) {
  const { user } = useAuth();
  const canPostStation = user?.role === "WC";
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [scope, setScope] = useState<bulletin.BulletinScope>("watch");
  const [watchUnit, setWatchUnit] = useState<string>(user?.watch_unit ?? "");
  const [priority, setPriority] = useState<bulletin.BulletinPriority>("routine");
  const [requiresAck, setRequiresAck] = useState(false);
  const [expiresIn, setExpiresIn] = useState<string>("never");

  const expiresAtIso = useMemo(() => {
    if (expiresIn === "never") return undefined;
    const days = parseInt(expiresIn, 10);
    if (!Number.isFinite(days)) return undefined;
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString();
  }, [expiresIn]);

  const createMutation = useMutation({
    mutationFn: () =>
      backend.bulletin.create({
        scope,
        watch_unit: scope === "watch" ? watchUnit : undefined,
        title: title.trim(),
        body: body.trim(),
        priority,
        requires_ack: requiresAck,
        expires_at: expiresAtIso,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bulletins"] });
      queryClient.invalidateQueries({ queryKey: ["bulletin-tile"] });
      toast({
        title: "Bulletin posted",
        description: "Notifications sent to the audience.",
      });
      setTitle("");
      setBody("");
      setRequiresAck(false);
      onPosted();
    },
    onError: (err: any) => {
      toast({
        title: "Failed to post bulletin",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    },
  });

  const valid =
    title.trim().length > 0 &&
    body.trim().length > 0 &&
    (scope === "station" || !!watchUnit);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">New bulletin</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Scope */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="bulletin-scope" className="text-xs">Scope</Label>
            <Select
              value={scope}
              onValueChange={(v) => setScope(v as bulletin.BulletinScope)}
            >
              <SelectTrigger id="bulletin-scope" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="watch">Watch</SelectItem>
                <SelectItem value="station" disabled={!canPostStation}>
                  Station-wide {!canPostStation && "(WC only)"}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          {scope === "watch" && (
            <div>
              <Label htmlFor="bulletin-watch" className="text-xs">Watch</Label>
              <Select value={watchUnit} onValueChange={setWatchUnit}>
                <SelectTrigger id="bulletin-watch" className="mt-1">
                  <SelectValue placeholder="Choose a watch" />
                </SelectTrigger>
                <SelectContent>
                  {WATCHES.map((w) => (
                    <SelectItem
                      key={w}
                      value={w}
                      disabled={
                        user?.role === "CC" &&
                        w.toLowerCase() !==
                          (user.watch_unit ?? "").toLowerCase()
                      }
                    >
                      {w} Watch
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Priority + expiry */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="bulletin-priority" className="text-xs">Priority</Label>
            <Select
              value={priority}
              onValueChange={(v) =>
                setPriority(v as bulletin.BulletinPriority)
              }
            >
              <SelectTrigger id="bulletin-priority" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="routine">Routine</SelectItem>
                <SelectItem value="important">Important</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="bulletin-expiry" className="text-xs">
              Expires
            </Label>
            <Select value={expiresIn} onValueChange={setExpiresIn}>
              <SelectTrigger id="bulletin-expiry" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="never">Never</SelectItem>
                <SelectItem value="7">In 7 days</SelectItem>
                <SelectItem value="14">In 14 days</SelectItem>
                <SelectItem value="30">In 30 days</SelectItem>
                <SelectItem value="90">In 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Title + body */}
        <div>
          <Label htmlFor="bulletin-title" className="text-xs">Title</Label>
          <Input
            id="bulletin-title"
            className="mt-1"
            placeholder="e.g. New BA procedure effective Monday"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={160}
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            {title.length} / 160
          </p>
        </div>
        <div>
          <Label htmlFor="bulletin-body" className="text-xs">Body</Label>
          <Textarea
            id="bulletin-body"
            className="mt-1"
            rows={8}
            placeholder="Say what changed, when it takes effect, and what (if anything) crew need to do."
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>

        {/* Require-acknowledgement */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border">
          <Checkbox
            id="bulletin-ack"
            checked={requiresAck}
            onCheckedChange={(checked) => setRequiresAck(!!checked)}
            className="mt-0.5"
          />
          <label
            htmlFor="bulletin-ack"
            className="text-sm cursor-pointer leading-snug flex-1"
          >
            <span className="font-medium">Require acknowledgement</span>
            <span className="block text-muted-foreground text-xs mt-0.5">
              Recipients must tap "I've read &amp; understood" — tracked per
              person for compliance. Use for SOP updates, safety flashes.
            </span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() => {
              setTitle("");
              setBody("");
              setRequiresAck(false);
              onPosted();
            }}
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Cancel
          </Button>
          <Button
            className="bg-brand hover:bg-brand/90 text-brand-foreground"
            disabled={!valid || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            <Megaphone className="h-3.5 w-3.5 mr-1" />
            {createMutation.isPending ? "Posting…" : "Post bulletin"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
