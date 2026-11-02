import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useBackend } from "@/lib/rbac";
import { STATION_OPTIONS } from "@/lib/constants";
import type { FirefighterProfile, UpdateProfileRequest, DriverPathwayStatus } from "~backend/profile/types";
import SkillsTab from "@/components/SkillsTab";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Copy,
  KeyRound,
  Lock,
  MoreHorizontal,
  Send,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { useCanEditProfiles, useIsAdmin, useIsWC, useUserRole } from "@/lib/rbac";
import { useAuth } from "@/App";
import { cn } from "@/lib/utils";
import H4HLedgerSection from "@/components/H4HLedgerSection";
import { ProfileToilSection } from "@/components/ProfileToilSection";
import { ProfileShiftAdjustmentsSection } from "@/components/ProfileShiftAdjustmentsSection";
import { AbsenceHistorySection } from "@/components/AbsenceHistorySection";
import { ProfileHero, type ProfileFact, type ProfileFlag } from "@/components/profile/ProfileHero";
import { ProfileSection, Field } from "@/components/profile/ProfileSection";
import { QualificationsPanel, type SkillLite } from "@/components/profile/QualificationsPanel";
import { DriverPathway } from "@/components/profile/DriverPathway";
import { RecordHistory } from "@/components/profile/RecordHistory";
import { ProfileNotes } from "@/components/profile/ProfileNotes";
import { QUALIFICATIONS, type QualificationKey } from "@/lib/qualifications";

// A person's profile (redesigned Nov 2026, from John's "be bold" brief and a
// look at Attio, Personio, HubSpot mobile and Sage record pages):
//   - a header with who they are, where their watch is on the rota, one-tap
//     Call / Text / Email, and a strip of the facts a WC checks most;
//   - six tabs instead of nine (H4H, TOIL and shift adjustments are one
//     "Hours" tab; Documents — which never uploaded — and the old "Last
//     conversation" card are gone; Activity Log is now a readable History of
//     changes to their record);
//   - each card is edited where it sits, not via one Edit Profile button;
//   - qualifications and skills are one panel, and the driver pathway is a
//     step tracker.
// Who sees what is unchanged: sickness only for the person and the WC/CC on
// their watch; notes and history for WC/CC; TOIL and shift adjustments for
// the person and WC/CC.

type Section = "details" | "contact" | "quals" | "driver";
type TabKey = "overview" | "skills" | "notes" | "absences" | "hours" | "history";

const RANKS = ["Watch Commander", "Crew Commander", "Leading Firefighter", "Firefighter"];
const WATCHES = ["Green", "Red", "White", "Blue", "Amber"];
const shortDate = (d?: string | Date | null) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
const dayMonth = (d: string | Date) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const selectCls = "h-9 w-full max-w-[220px] rounded-lg border border-border bg-background px-2 text-sm font-normal";
const inputCls = "h-9 w-full max-w-[220px] rounded-lg border border-border bg-background px-2 text-right text-sm font-normal";

export default function ProfileDetail() {
  const { userId: paramUserId } = useParams<{ userId: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  // If no URL param, fall back to the logged-in user's own profile
  const userId = paramUserId ?? currentUser?.id;
  const backend = useBackend();
  const canEdit = useCanEditProfiles();
  const isWC = useIsWC();
  const userRole = useUserRole();
  const isViewingOwnProfile = currentUser?.id === userId;
  const isManager = userRole === "WC" || userRole === "CC";
  const [editing, setEditing] = useState<Section | null>(null);
  const [editedProfile, setEditedProfile] = useState<Partial<FirefighterProfile>>({});
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetLink, setResetLink] = useState("");
  const [hoursView, setHoursView] = useState<"toil" | "h4h" | "adjustments" | null>(null);
  // Inviting people and sending reset links is the admin's job.
  const isAdmin = useIsAdmin();
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ["user", userId],
    queryFn: async () => backend.user.get(userId!),
    enabled: !!userId,
  });

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["profile", userId],
    queryFn: async () => backend.profile.getByUser(userId!),
    enabled: !!userId,
  });

  // Sickness: the person sees their own; only a WC/CC on their watch can see
  // or change it (the backend enforces the same rule).
  const personWatch = (user?.watch_unit || profile?.watch || "").toLowerCase();
  const myWatch = (currentUser?.watch_unit || "").toLowerCase();
  const isLineManager = !isViewingOwnProfile && isManager && !!myWatch && myWatch === personWatch;
  const canSeeSickness = isViewingOwnProfile || isLineManager;
  // TOIL and shift adjustments: the person, or a WC/CC.
  const canSeeHours = isViewingOwnProfile || isManager;

  const { data: absencesData } = useQuery({
    queryKey: ["absences", userId],
    queryFn: async () => backend.absence.list({ user_id: userId }),
    enabled: !!userId,
  });

  const { data: notesData } = useQuery({
    queryKey: ["notes", profile?.id],
    queryFn: async () => backend.note.list({ profile_id: profile!.id }),
    enabled: !!profile?.id && isManager,
  });
  const notes = notesData?.notes || [];

  const { data: skillsData } = useQuery({
    queryKey: ["skill-renewals", profile?.id],
    queryFn: async () => backend.skill.list({ profile_id: profile!.id }),
    enabled: !!profile?.id,
  });
  const skills = (skillsData?.skills ?? []) as unknown as SkillLite[];

  const year = new Date().getFullYear();
  const { data: toilData } = useQuery({
    queryKey: ["toil-balance", userId, year],
    queryFn: () => backend.toil.balance({ user_id: userId!, year }),
    enabled: !!userId && canSeeHours,
  });
  const { data: h4hData } = useQuery({
    queryKey: ["h4h-ledger", userId],
    queryFn: () => backend.h4h.list({ user_id: userId!, status: "pending" }),
    enabled: !!userId,
  });

  // Previous / next person on the same watch, so a WC can work down the watch.
  const { data: peopleData } = useQuery({
    queryKey: ["people", "active"],
    queryFn: () => backend.profile.listWithUsers({ limit: 500, status: "active" }),
    enabled: isManager && !!personWatch,
    staleTime: 60_000,
  });
  const watchmates = useMemo(
    () =>
      (peopleData?.people ?? [])
        .filter((p) => (p.user.watch_unit || p.profile?.watch || "").toLowerCase() === personWatch)
        .sort((a, b) => a.user.name.localeCompare(b.user.name)),
    [peopleData, personWatch]
  );
  const myIndex = watchmates.findIndex((p) => p.user.id === userId);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: UpdateProfileRequest) => {
      if (!profile) throw new Error("No profile found");
      return await backend.profile.update(profile.id, data as any);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      queryClient.invalidateQueries({ queryKey: ["skill-renewals"] });
      queryClient.invalidateQueries({ queryKey: ["people"] });
      queryClient.invalidateQueries({ queryKey: ["profile-history"] });
      toast({ title: "Saved" });
      setEditing(null);
      setEditedProfile({});
    },
    onError: (error: any) => {
      toast({
        title: "Couldn't save",
        description: error?.message || (error?.details ? JSON.stringify(error.details) : "An error occurred"),
        variant: "destructive",
      });
    },
  });

  const handleSaveProfile = () => {
    const profileUpdates: UpdateProfileRequest = {};
    if (editedProfile.service_number !== undefined) profileUpdates.service_number = editedProfile.service_number;
    if (editedProfile.station !== undefined) profileUpdates.station = editedProfile.station;
    if (editedProfile.rank !== undefined) profileUpdates.rank = editedProfile.rank;
    if (editedProfile.phone !== undefined) profileUpdates.phone = editedProfile.phone;
    if (editedProfile.emergency_contact_name !== undefined) profileUpdates.emergency_contact_name = editedProfile.emergency_contact_name;
    if (editedProfile.emergency_contact_phone !== undefined) profileUpdates.emergency_contact_phone = editedProfile.emergency_contact_phone;
    if (editedProfile.driver !== undefined) profileUpdates.driver = editedProfile.driver;
    if (editedProfile.driverPathway !== undefined) profileUpdates.driverPathway = editedProfile.driverPathway;
    if (editedProfile.prps !== undefined) profileUpdates.prps = editedProfile.prps;
    if (editedProfile.ba !== undefined) profileUpdates.ba = editedProfile.ba;
    if (editedProfile.oic !== undefined) profileUpdates.oic = editedProfile.oic;
    if (editedProfile.mass_decon !== undefined) profileUpdates.mass_decon = editedProfile.mass_decon;
    if (editedProfile.hooklift_operator !== undefined) profileUpdates.hooklift_operator = editedProfile.hooklift_operator;
    if (editedProfile.watch !== undefined) profileUpdates.watch = ((editedProfile.watch as string) === "_none" ? "" : editedProfile.watch) as any;

    if (Object.keys(profileUpdates).length === 0) {
      setEditing(null);
      return;
    }
    updateProfileMutation.mutate(profileUpdates);
  };

  const startEdit = (s: Section) => {
    setEditedProfile({});
    setEditing(s);
  };
  const cancelEdit = () => {
    setEditing(null);
    setEditedProfile({});
  };

  const getDisplayValue = <K extends keyof FirefighterProfile>(key: K): FirefighterProfile[K] => {
    return (editedProfile[key] !== undefined ? editedProfile[key] : profile?.[key]) as FirefighterProfile[K];
  };
  const set = (patch: Partial<FirefighterProfile>) => setEditedProfile((e) => ({ ...e, ...patch }));

  const canEditField = (fieldName: string): boolean => {
    if (userRole === "WC") return true;
    if (userRole === "CC") return !["service_number", "station", "watch", "rank"].includes(fieldName);
    if (userRole === "FF" && isViewingOwnProfile) {
      return ["phone", "emergency_contact_name", "emergency_contact_phone"].includes(fieldName);
    }
    return false;
  };

  // ── Tabs (kept in the URL so a link or the back button lands on the same one) ──
  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: "overview", label: "Overview" },
    { key: "skills", label: "Skills", count: skills.length || undefined },
    ...(isManager ? [{ key: "notes" as const, label: "Notes & 1:1s", count: notes.length || undefined }] : []),
    ...(canSeeSickness ? [{ key: "absences" as const, label: "Absences" }] : []),
    { key: "hours", label: "Hours" },
    ...(isManager ? [{ key: "history" as const, label: "History" }] : []),
  ];
  const requested = searchParams.get("tab") as TabKey | null;
  const tab: TabKey = tabs.some((t) => t.key === requested) ? requested! : "overview";
  const openTab = (t: TabKey) => {
    const next = new URLSearchParams(searchParams);
    if (t === "overview") next.delete("tab");
    else next.set("tab", t);
    setSearchParams(next, { replace: true });
  };

  if (userLoading || profileLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-48 w-full rounded-2xl" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-64 w-full rounded-2xl lg:col-span-2" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  // ── The header's flags and facts ────────────────────────────────────────────
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const absences = absencesData?.absences ?? [];
  const offSick = canSeeSickness
    ? absences.find((a) => a.type === "sickness" && a.status !== "rejected" && !a.returned_to_work_at && new Date(a.start_date) <= today)
    : undefined;
  const onLeave = absences.find(
    (a) => a.type !== "sickness" && a.status === "approved" && new Date(a.start_date) <= today && new Date(a.end_date) >= new Date(today.toDateString())
  );
  const flags: ProfileFlag[] = [
    ...(user && (!user.is_active || user.has_password === false) ? [{ key: "signup", label: "Not signed up yet", tone: "warning" as const }] : []),
    ...(user?.left_at ? [{ key: "left", label: `Left the station ${dayMonth(user.left_at)}` }] : []),
    ...(offSick ? [{ key: "sick", label: `Off sick since ${dayMonth(offSick.start_date)}`, tone: "warning" as const }] : []),
    ...(onLeave ? [{ key: "leave", label: `On leave until ${dayMonth(onLeave.end_date)}` }] : []),
  ];

  const held = {
    oic: !!getDisplayValue("oic"),
    ba: !!getDisplayValue("ba"),
    prps: !!getDisplayValue("prps"),
    mass_decon: !!getDisplayValue("mass_decon"),
    hooklift_operator: !!getDisplayValue("hooklift_operator"),
    driver_lgv: !!getDisplayValue("driver")?.lgv,
  } as Record<QualificationKey, boolean>;
  const heldNames = QUALIFICATIONS.filter((q) => held[q.key]).map((q) => q.short);
  const expired = skills.filter((s) => s.status === "expired").length;
  const dueSoon = skills.filter((s) => s.status === "warning").length;
  const toil = toilData?.balances?.[0];
  const owedToThem = h4hData?.owed_to_me?.length ?? 0;
  const theyOwe = h4hData?.i_owe?.length ?? 0;
  const lastNote = notes.reduce<string | null>((latest, n) => {
    const at = String(n.created_at);
    return !latest || new Date(at) > new Date(latest) ? at : latest;
  }, null);
  const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

  const facts: ProfileFact[] = [
    {
      key: "quals",
      label: "Qualifications",
      value: `${heldNames.length} of ${QUALIFICATIONS.length}`,
      sub: heldNames.join(" · ") || "None held",
      onClick: () => openTab("overview"),
    },
    {
      key: "skills",
      label: "Skills",
      value: expired ? `${expired} expired` : dueSoon ? `${dueSoon} due soon` : String(skills.length),
      sub: expired || dueSoon ? `of ${skills.length} skills` : skills.length ? "all in date" : "none recorded",
      tone: expired ? "critical" : dueSoon ? "warning" : "neutral",
      onClick: () => openTab("skills"),
    },
    ...(canSeeSickness && profile
      ? [{
          key: "sickness",
          label: "Sickness · 6 months",
          value: `${profile.rolling_sick_days} day${profile.rolling_sick_days === 1 ? "" : "s"}`,
          sub: profile.trigger_stage !== "None"
            ? `${profile.trigger_stage.replace("Stage", "Stage ")} trigger hit`
            : `${profile.rolling_sick_episodes} absence${profile.rolling_sick_episodes === 1 ? "" : "s"}`,
          tone: (profile.trigger_stage === "Stage3" ? "critical" : profile.trigger_stage !== "None" ? "warning" : "neutral") as ProfileFact["tone"],
          onClick: () => openTab("absences"),
        }]
      : []),
    ...(canSeeHours && toilData
      ? [{
          key: "toil",
          label: "TOIL",
          value: `${toil?.balance ?? 0}h`,
          sub: toil?.pending_earned ? `${toil.pending_earned}h awaiting approval` : "available",
          onClick: () => { setHoursView("toil"); openTab("hours"); },
        }]
      : []),
    {
      key: "h4h",
      label: "H4H",
      value: !owedToThem && !theyOwe ? "Square" : theyOwe ? `Owes ${theyOwe}` : `Owed ${owedToThem}`,
      sub: !owedToThem && !theyOwe ? "nothing outstanding" : [theyOwe && `owes ${theyOwe}`, owedToThem && `owed ${owedToThem}`].filter(Boolean).join(" · ") + " shift(s)",
      onClick: () => { setHoursView("h4h"); openTab("hours"); },
    },
    ...(isManager
      ? [{
          key: "oneone",
          label: "Last 1:1",
          value: lastNote ? dayMonth(lastNote) : "None yet",
          sub: lastNote ? `${daysSince(lastNote)} days ago · your notes` : "your notes are private to you",
          onClick: () => openTab("notes"),
        }]
      : []),
  ];

  const adminMenu = isAdmin && user && !isViewingOwnProfile ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label="More actions" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border hover:bg-muted">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {!user.has_password ? (
          <DropdownMenuItem
            onSelect={async () => {
              try {
                const result = await backend.admin.getInviteLink({ email: user.email, frontend_url: window.location.origin });
                if (result.already_active) {
                  toast({ title: "Already registered", description: `${result.user_name} has already set up their account and can sign in normally.` });
                  return;
                }
                setInviteLink(result.invite_link);
                setShowInviteDialog(true);
              } catch (error: any) {
                toast({ title: "Error", description: error?.message || "Failed to generate invite link", variant: "destructive" });
              }
            }}
          >
            <Send className="mr-2 h-4 w-4" /> Send invite link
          </DropdownMenuItem>
        ) : (
          // Forgotten password — the admin sends a one-time link; they
          // choose the new password themselves (the admin never sees it).
          <DropdownMenuItem
            onSelect={async () => {
              try {
                const result = await backend.admin.getPasswordResetLink({ user_id: user.id, frontend_url: window.location.origin });
                setResetLink(result.reset_link);
                setShowResetDialog(true);
              } catch (error: any) {
                toast({ title: "Couldn't create a reset link", description: error?.message || "Please try again.", variant: "destructive" });
              }
            }}
          >
            <KeyRound className="mr-2 h-4 w-4" /> Send password reset link
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;

  const sectionProps = (s: Section, editable: boolean) => ({
    editable: editable && !editing,
    editing: editing === s,
    saving: updateProfileMutation.isPending,
    onEdit: () => startEdit(s),
    onCancel: cancelEdit,
    onSave: handleSaveProfile,
  });

  /** A value in a section: an input while editing (if allowed), otherwise text — with a lock when they can't change it. */
  const editableValue = (s: Section, field: string, display: React.ReactNode, input: React.ReactNode) =>
    editing === s ? (canEditField(field) ? input : (
      <span className="inline-flex items-center gap-1.5 text-muted-foreground" title="Only a WC can change this">
        {display} <Lock className="h-3 w-3" />
      </span>
    )) : display;

  const pathway = getDisplayValue("driverPathway");
  const watchValue = (getDisplayValue("watch") as string) || user?.watch_unit || "";
  const hoursOptions = [
    ...(canSeeHours ? [{ key: "toil" as const, label: "TOIL" }] : []),
    { key: "h4h" as const, label: "H4H" },
    ...(canSeeHours ? [{ key: "adjustments" as const, label: "Shift adjustments" }] : []),
  ];
  const hoursActive = hoursOptions.find((o) => o.key === hoursView)?.key ?? hoursOptions[0].key;

  return (
    <div className="flex flex-col gap-4">
      {myIndex >= 0 && watchmates.length > 1 && (
        <nav aria-label="People on this watch" className="-mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <Link to="/people" className="hover:text-foreground">← All people</Link>
          <span className="flex items-center gap-1">
            <Link
              to={`/people/${watchmates[(myIndex - 1 + watchmates.length) % watchmates.length].user.id}${tab !== "overview" ? `?tab=${tab}` : ""}`}
              aria-label="Previous person on the watch"
              className="grid h-7 w-7 place-items-center rounded-lg hover:bg-muted hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <span className="tabular-nums">{myIndex + 1} of {watchmates.length} · {user?.watch_unit || profile?.watch} Watch</span>
            <Link
              to={`/people/${watchmates[(myIndex + 1) % watchmates.length].user.id}${tab !== "overview" ? `?tab=${tab}` : ""}`}
              aria-label="Next person on the watch"
              className="grid h-7 w-7 place-items-center rounded-lg hover:bg-muted hover:text-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          </span>
        </nav>
      )}

      <ProfileHero
        name={user?.name ?? ""}
        rank={profile?.rank}
        watch={user?.watch_unit || profile?.watch}
        station={profile?.station}
        serviceNumber={profile?.service_number}
        phone={profile?.phone}
        email={user?.email}
        flags={flags}
        facts={facts}
        menu={adminMenu}
      />

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div role="tablist" aria-label="Profile sections" className="-mx-4 flex gap-1 overflow-x-auto border-b border-border/70 px-4 md:mx-0 md:px-0">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => openTab(t.key)}
            className={cn(
              "-mb-px inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              tab === t.key ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span className="rounded-full bg-muted px-1.5 text-[11px] font-semibold tabular-nums text-muted-foreground">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Overview ─────────────────────────────────────────────────────── */}
      {tab === "overview" && profile && (
        <div className="grid items-start gap-4 lg:grid-cols-3">
          <div className="flex flex-col gap-4 lg:col-span-2">
            <ProfileSection
              title="Qualifications & skills"
              description="The crewing board's warnings use the qualifications."
              {...sectionProps("quals", canEdit && canEditField("qualifications"))}
            >
              <QualificationsPanel
                held={held}
                skills={skills}
                editing={editing === "quals"}
                onToggle={(key) => {
                  if (key === "driver_lgv") set({ driver: { lgv: !held.driver_lgv, erd: getDisplayValue("driver")?.erd ?? false } });
                  else set({ [key]: !held[key] } as Partial<FirefighterProfile>);
                }}
                onOpenSkills={() => openTab("skills")}
              />
            </ProfileSection>

            <ProfileSection title="Driver pathway" {...sectionProps("driver", canEdit && canEditField("driverPathway"))}>
              <DriverPathway
                status={pathway?.status}
                lgvPassedDate={pathway?.lgvPassedDate as string | undefined}
                editing={editing === "driver"}
                onPick={(status: DriverPathwayStatus) => set({ driverPathway: { status, lgvPassedDate: pathway?.lgvPassedDate } })}
                onDate={(d) => set({ driverPathway: { status: pathway?.status ?? "passed_LGV", lgvPassedDate: d } })}
              />
            </ProfileSection>
          </div>

          <div className="flex flex-col gap-4">
            <ProfileSection title="Details" {...sectionProps("details", canEdit && ["rank", "station", "watch", "service_number"].some(canEditField))}>
              <Field label="Rank">
                {editableValue("details", "rank", profile.rank || "—", (
                  <select className={selectCls} value={getDisplayValue("rank") || ""} onChange={(e) => set({ rank: e.target.value })}>
                    <option value="" disabled>Choose a rank</option>
                    {RANKS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                ))}
              </Field>
              <Field label="Watch">
                {editableValue("details", "watch", watchValue ? `${watchValue} Watch` : "—", (
                  <select className={selectCls} value={watchValue || "_none"} onChange={(e) => set({ watch: e.target.value as any })}>
                    <option value="_none">No watch</option>
                    {WATCHES.map((w) => <option key={w} value={w}>{w}</option>)}
                  </select>
                ))}
              </Field>
              <Field label="Station">
                {editableValue("details", "station", profile.station || "—", (
                  <select className={selectCls} value={getDisplayValue("station") || ""} onChange={(e) => set({ station: e.target.value })}>
                    <option value="" disabled>Choose a station or area</option>
                    {STATION_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                ))}
              </Field>
              <Field label="Service number">
                {editableValue("details", "service_number", <span className="font-mono">{profile.service_number || "—"}</span>, (
                  <input className={cn(inputCls, "font-mono")} value={getDisplayValue("service_number") || ""} onChange={(e) => set({ service_number: e.target.value })} />
                ))}
              </Field>
              {profile.hire_date && <Field label="Started">{shortDate(profile.hire_date)}</Field>}
            </ProfileSection>

            <ProfileSection
              title="Contact"
              {...sectionProps("contact", (canEdit || isViewingOwnProfile) && ["phone", "emergency_contact_name", "emergency_contact_phone"].some(canEditField))}
            >
              <Field label="Phone">
                {editableValue("contact", "phone", profile.phone ? <a href={`tel:${profile.phone.replace(/[^\d+]/g, "")}`} className="font-mono hover:underline">{profile.phone}</a> : "—", (
                  <input className={cn(inputCls, "font-mono")} type="tel" inputMode="tel" value={getDisplayValue("phone") || ""} onChange={(e) => set({ phone: e.target.value })} />
                ))}
              </Field>
              <Field label="Email">
                {user?.email ? (
                  <span className="inline-flex max-w-full items-center gap-1">
                    <a href={`mailto:${user.email}`} className="truncate hover:underline">{user.email}</a>
                    <button
                      type="button"
                      aria-label="Copy email"
                      onClick={() => { navigator.clipboard.writeText(user.email); toast({ title: "Email copied" }); }}
                      className="grid h-6 w-6 shrink-0 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </span>
                ) : "—"}
              </Field>
              <Field label="Emergency contact">
                {editableValue("contact", "emergency_contact_name", profile.emergency_contact_name || "—", (
                  <input className={inputCls} placeholder="Name" value={getDisplayValue("emergency_contact_name") || ""} onChange={(e) => set({ emergency_contact_name: e.target.value })} />
                ))}
              </Field>
              <Field label="Their number">
                {editableValue("contact", "emergency_contact_phone", profile.emergency_contact_phone ? <a href={`tel:${profile.emergency_contact_phone.replace(/[^\d+]/g, "")}`} className="font-mono hover:underline">{profile.emergency_contact_phone}</a> : "—", (
                  <input className={cn(inputCls, "font-mono")} type="tel" inputMode="tel" placeholder="Phone" value={getDisplayValue("emergency_contact_phone") || ""} onChange={(e) => set({ emergency_contact_phone: e.target.value })} />
                ))}
              </Field>
            </ProfileSection>
          </div>
        </div>
      )}

      {/* ── Skills ───────────────────────────────────────────────────────── */}
      {tab === "skills" && profile && <SkillsTab profileId={profile.id} userId={userId} />}

      {/* ── Notes & 1:1s (WC/CC; each note is private to whoever wrote it) ── */}
      {tab === "notes" && isManager && profile && (
        <ProfileNotes profileId={profile.id} firstName={user?.name?.split(" ")[0] ?? "them"} notes={notes} canWrite={canEdit} />
      )}

      {/* ── Absences (the person, and the WC/CC on their watch) ───────────── */}
      {tab === "absences" && canSeeSickness && userId && (
        <div className="flex flex-col gap-4">
          {profile && profile.trigger_stage !== "None" && (
            <div
              className={cn(
                "flex items-start gap-3 rounded-2xl border p-4",
                profile.trigger_stage === "Stage3" ? "border-red-500/30 bg-red-500/5" : "border-amber-500/30 bg-amber-500/5"
              )}
            >
              <AlertTriangle className={cn("mt-0.5 h-5 w-5 shrink-0", profile.trigger_stage === "Stage3" ? "text-red-600" : "text-amber-600")} />
              <div>
                <h3 className="text-sm font-semibold">{profile.trigger_stage.replace("Stage", "Stage ")} absence trigger hit</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Last 6 months: <strong className="text-foreground">{profile.rolling_sick_episodes} sickness absence{profile.rolling_sick_episodes === 1 ? "" : "s"}</strong>,{" "}
                  <strong className="text-foreground">{profile.rolling_sick_days} duty day{profile.rolling_sick_days === 1 ? "" : "s"}</strong> lost (rostered shifts only).
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Any stage is for the Station Commander to decide and note on the attendance file.</p>
              </div>
            </div>
          )}
          <AbsenceHistorySection userId={userId} canManage={isLineManager} watch={user?.watch_unit || profile?.watch || undefined} />
        </div>
      )}

      {/* ── Hours: TOIL, H4H and shift adjustments ───────────────────────── */}
      {tab === "hours" && userId && (
        <div className="flex flex-col gap-4">
          {hoursOptions.length > 1 && (
            <div role="tablist" aria-label="Hours" className="grid w-full max-w-md rounded-xl bg-muted p-1" style={{ gridTemplateColumns: `repeat(${hoursOptions.length}, minmax(0, 1fr))` }}>
              {hoursOptions.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  role="tab"
                  aria-selected={hoursActive === o.key}
                  onClick={() => setHoursView(o.key)}
                  className={cn(
                    "h-8 rounded-lg text-xs font-medium transition-colors",
                    hoursActive === o.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}
          {hoursActive === "toil" && <ProfileToilSection profileUserId={userId} profileName={user?.name} />}
          {hoursActive === "h4h" && (
            <section className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
              <H4HLedgerSection userId={userId} canSettle={isViewingOwnProfile || isWC} />
            </section>
          )}
          {hoursActive === "adjustments" && <ProfileShiftAdjustmentsSection profileUserId={userId} />}
        </div>
      )}

      {/* ── History (WC/CC) ──────────────────────────────────────────────── */}
      {tab === "history" && isManager && profile && <RecordHistory profileId={profile.id} />}

      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite {user?.name}</DialogTitle>
            <DialogDescription>
              Send this link to {user?.name} only. It lets them choose a password and sign in, and works once, for 14 days. Making a new link cancels this one.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Input readOnly value={inviteLink} className="flex-1 font-mono text-xs" />
              <Button
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(inviteLink);
                  toast({ title: "Copied!", description: "Invite link copied to clipboard" });
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Share it privately (WhatsApp, email or Teams) — anyone with the link can set the password. If it expires, they can use "Forgot password" on the sign-in page instead.
            </p>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setShowInviteDialog(false)}>Close</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Password reset link dialog ──────────────────────────────────── */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Password reset link — {user?.name}</DialogTitle>
            <DialogDescription>
              Send this to {user?.name} only. They open it, choose a new password, and sign in. It works once, for 24 hours; their old logins stop working once they've changed it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Input readOnly value={resetLink} className="flex-1 font-mono text-xs" />
              <Button
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(resetLink);
                  toast({ title: "Copied!", description: "Reset link copied to clipboard" });
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Share it privately (WhatsApp, Teams, email) — anyone with the link can set the password.
            </p>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setShowResetDialog(false)}>Close</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
