import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { useBackend } from "@/lib/rbac";
import type { FirefighterProfile, UpdateProfileRequest, DriverPathwayStatus } from "~backend/profile/types";
import type { AbsenceType } from "~backend/absence/types";
import SkillsTab from "@/components/SkillsTab";
import SkillsSummaryCard from "@/components/SkillsSummaryCard";
import { WatchBadge, WatchDot } from "@/components/WatchBadge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Edit,
  Phone,
  Mail,
  Save,
  X,
  Plus,
  Shield,
  Building2,
  Briefcase,
  User,
  Clock,
  FileText,
  Lock,
  AlertTriangle,
  Download,
  Trash2,
  Upload,
  MessageSquare,
  Bell,
  Calendar as CalendarIcon,
  History,
  Award,
  Truck,
  CheckCircle2,
  Send,
  Copy,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { useCanEditProfiles, useIsWC, useUserRole } from "@/lib/rbac";
import { useAuth } from "@/App";

export default function ProfileDetail() {
  const { userId } = useParams<{ userId: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const backend = useBackend();
  const canEdit = useCanEditProfiles();
  const isWC = useIsWC();
  const userRole = useUserRole();
  const isViewingOwnProfile = currentUser?.id === userId;
  const [editMode, setEditMode] = useState(false);
  const [editedProfile, setEditedProfile] = useState<Partial<FirefighterProfile>>({});
  const [editedUser, setEditedUser] = useState<{ role?: string }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteLink, setInviteLink] = useState("");

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ["user", userId],
    queryFn: async () => backend.user.get({ id: userId! }),
    enabled: !!userId,
  });

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["profile", userId],
    queryFn: async () => backend.profile.getByUser({ user_id: userId! }),
    enabled: !!userId,
  });

  const { data: absencesData, isLoading: absencesLoading } = useQuery({
    queryKey: ["absences", userId],
    queryFn: async () => backend.absence.list({ user_id: userId }),
    enabled: !!userId,
  });

  const absences = absencesData?.absences;

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => backend.settings.get(),
  });

  const { data: notesData } = useQuery({
    queryKey: ["notes", profile?.id],
    queryFn: async () => backend.note.list({ profile_id: profile!.id }),
    enabled: !!profile?.id,
  });

  const notes = notesData?.notes || [];

  // Temporarily disabled
  // const { data: documentsData } = useQuery({
  //   queryKey: ["documents", profile?.id],
  //   queryFn: async () => backend.document.list({ profile_id: profile!.id }),
  //   enabled: !!profile?.id,
  // });

  const documents: any[] = [];

  const { data: activityLog } = useQuery({
    queryKey: ["activity-log", userId],
    queryFn: async () => backend.admin.getActivityLog({ user_id: userId }),
    enabled: !!userId,
  });

  const { data: allUsersData, isLoading: allUsersLoading, error: allUsersError } = useQuery({
    queryKey: ["users-basic"],
    queryFn: async () => {
      try {
        const result = await backend.user.listBasic();
        console.log("✓ Users loaded:", result.users?.length || 0, "users");
        return result;
      } catch (error) {
        console.error("✗ Failed to load users:", error);
        throw error;
      }
    },
    retry: 3,
    staleTime: 5 * 60 * 1000,
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: UpdateProfileRequest) => {
      if (!profile) throw new Error("No profile found");
      return await backend.profile.update({ id: profile.id, ...data });
    },
    onSuccess: async () => {
      if (currentUser?.id) {
        try {
          await backend.admin.createActivityLog({
            actor_user_id: currentUser.id,
            action: "update_profile",
            entity_type: "profile",
            entity_id: userId,
            metadata: { updated_fields: Object.keys(editedProfile) },
          });
        } catch (error) {
          console.error("Failed to log activity:", error);
        }
      }
      
      queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      toast({
        title: "Profile updated",
        description: "Changes saved successfully",
      });
      setEditMode(false);
      setEditedProfile({});
      setEditedUser({});
    },
    onError: (error: any) => {
      console.error("Failed to update profile:", error);
      console.error("Error details:", {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        response: error?.response,
      });
      
      let errorMessage = "An error occurred";
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.details) {
        errorMessage = JSON.stringify(error.details);
      }
      
      toast({
        title: "Failed to update profile",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const [newNote, setNewNote] = useState({
    note_text: "",
    next_follow_up_date: "",
    reminder_enabled: false,
    reminder_recipient_user_id: "",
  });
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([]);

  const createNoteMutation = useMutation({
    mutationFn: async () => {
      if (!profile) throw new Error("No profile found");
      
      if (newNote.reminder_enabled && !newNote.next_follow_up_date) {
        throw new Error("Follow-up date is required when reminder is enabled");
      }
      
      console.log("Creating note with:", {
        profile_id: profile.id,
        note_text: newNote.note_text,
        next_follow_up_date: newNote.next_follow_up_date,
        reminder_enabled: newNote.reminder_enabled,
        reminder_recipient_user_id: newNote.reminder_recipient_user_id,
      });
      
      const note = await backend.note.create({
        profile_id: profile.id,
        note_text: newNote.note_text,
        next_follow_up_date: newNote.next_follow_up_date || undefined,
        reminder_enabled: newNote.reminder_enabled,
        reminder_recipient_user_id: newNote.reminder_recipient_user_id || undefined,
      });

      if (uploadingFiles.length > 0) {
        for (const file of uploadingFiles) {
          try {
            const { upload_url, file_key } = await backend.note.getUploadUrl({
              note_id: note.id,
              filename: file.name,
              content_type: file.type,
            });

            await fetch(upload_url, {
              method: 'PUT',
              body: file,
              headers: {
                'Content-Type': file.type,
              },
            });

            await backend.note.saveAttachment({
              note_id: note.id,
              file_key,
              filename: file.name,
              file_type: file.type,
              file_size: file.size,
            });
          } catch (error) {
            console.error(`Failed to upload ${file.name}:`, error);
            toast({
              title: "File upload warning",
              description: `Failed to upload ${file.name}. Note was saved without this attachment.`,
              variant: "destructive",
            });
          }
        }
      }

      return note;
    },
    onSuccess: (note) => {
      queryClient.invalidateQueries({ queryKey: ["notes", profile?.id] });
      
      if (newNote.reminder_enabled) {
        queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      }
      
      const hasAttachments = uploadingFiles.length > 0;
      const hasReminder = newNote.reminder_enabled;
      
      let description = "Note saved successfully";
      if (hasAttachments && hasReminder) {
        description = `Note, ${uploadingFiles.length} file(s), and reminder created`;
      } else if (hasAttachments) {
        description = `Note and ${uploadingFiles.length} file(s) saved`;
      } else if (hasReminder) {
        description = "Note and reminder created";
      }
      
      toast({
        title: "Note added",
        description,
      });
      
      setNewNote({
        note_text: "",
        next_follow_up_date: "",
        reminder_enabled: false,
        reminder_recipient_user_id: "",
      });
      setUploadingFiles([]);
    },
    onError: (error: any) => {
      console.error("Failed to create note:", error);
      toast({
        title: "Failed to add note",
        description: error?.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  // Temporarily disabled
  const uploadDocumentMutation = useMutation({
    mutationFn: async (file: File) => {
      return { success: true };
    },
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: async (documentId: number) => {
      return { success: true };
    },
  });

  const handleSaveProfile = async () => {
    console.log("=== SAVE PROFILE DEBUG ===");
    console.log("editedProfile state:", JSON.stringify(editedProfile, null, 2));
    console.log("editedUser state:", JSON.stringify(editedUser, null, 2));
    
    const profileUpdates: UpdateProfileRequest = {};
    const userUpdates: any = {};
    
    if (editedProfile.service_number !== undefined) profileUpdates.service_number = editedProfile.service_number;
    if (editedProfile.station !== undefined) profileUpdates.station = editedProfile.station;
    if (editedProfile.shift !== undefined) profileUpdates.shift = editedProfile.shift;
    if (editedProfile.rank !== undefined) profileUpdates.rank = editedProfile.rank;
    if (editedProfile.phone !== undefined) profileUpdates.phone = editedProfile.phone;
    if (editedProfile.emergency_contact_name !== undefined) profileUpdates.emergency_contact_name = editedProfile.emergency_contact_name;
    if (editedProfile.emergency_contact_phone !== undefined) profileUpdates.emergency_contact_phone = editedProfile.emergency_contact_phone;
    if (editedProfile.skills !== undefined) profileUpdates.skills = editedProfile.skills;
    if (editedProfile.certifications !== undefined) profileUpdates.certifications = editedProfile.certifications;
    if (editedProfile.driver !== undefined) profileUpdates.driver = editedProfile.driver;
    if (editedProfile.driverPathway !== undefined) profileUpdates.driverPathway = editedProfile.driverPathway;
    if (editedProfile.prps !== undefined) profileUpdates.prps = editedProfile.prps;
    if (editedProfile.ba !== undefined) profileUpdates.ba = editedProfile.ba;
    if (editedProfile.notes !== undefined) profileUpdates.notes = editedProfile.notes;
    if (editedProfile.watch !== undefined) profileUpdates.watch = editedProfile.watch;
    
    if (editedUser.role !== undefined) userUpdates.role = editedUser.role;

    console.log("Profile update payload:", JSON.stringify(profileUpdates, null, 2));
    console.log("User update payload:", JSON.stringify(userUpdates, null, 2));
    console.log("Profile ID:", profile?.id);
    
    if (Object.keys(profileUpdates).length === 0 && Object.keys(userUpdates).length === 0) {
      toast({
        title: "No changes detected",
        description: "Please make some changes before saving",
        variant: "destructive",
      });
      return;
    }

    try {
      if (Object.keys(userUpdates).length > 0 && userId) {
        await backend.user.update({ id: userId, updates: userUpdates });
      }
      if (Object.keys(profileUpdates).length > 0) {
        updateProfileMutation.mutate(profileUpdates);
      } else {
        queryClient.invalidateQueries({ queryKey: ["user", userId] });
        queryClient.invalidateQueries({ queryKey: ["profile", userId] });
        toast({ title: "Profile updated", description: "Changes saved successfully" });
        setEditMode(false);
        setEditedProfile({});
        setEditedUser({});
      }
    } catch (error) {
      console.error("Failed to update user:", error);
      toast({
        title: "Failed to update profile",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    }
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    setEditedProfile({});
    setEditedUser({});
  };

  const getDisplayValue = <K extends keyof FirefighterProfile>(key: K): FirefighterProfile[K] => {
    return (editedProfile[key] !== undefined ? editedProfile[key] : profile?.[key]) as FirefighterProfile[K];
  };

  const canEditField = (fieldName: string): boolean => {
    if (userRole === "WC") return true;
    
    if (userRole === "CC") {
      const wcOnlyFields = ["service_number", "station", "shift", "rank"];
      return !wcOnlyFields.includes(fieldName);
    }
    
    if (userRole === "FF" && isViewingOwnProfile) {
      const ffEditableFields = ["phone", "emergency_contact_name", "emergency_contact_phone", "skills"];
      return ffEditableFields.includes(fieldName);
    }
    
    return false;
  };

  const isFieldLocked = (fieldName: string): boolean => {
    return editMode && !canEditField(fieldName);
  };



  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadDocumentMutation.mutate(file);
    }
  };

  // Temporarily disabled
  const handleDownloadDocument = async (documentId: number) => {
    console.log("Download document:", documentId);
  };

  const renderFieldWithLock = (
    fieldName: string,
    label: string,
    renderInput: () => React.ReactNode,
    renderDisplay: () => React.ReactNode
  ) => {
    const locked = isFieldLocked(fieldName);
    
    if (!editMode) {
      return renderDisplay();
    }

    if (locked) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="relative">
                {renderDisplay()}
                <Lock className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>You don't have permission to edit this field</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return renderInput();
  };

  if (userLoading || profileLoading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  const absenceTypeLabels: Record<AbsenceType, string> = {
    sickness: "Sickness",
    AL: "Annual Leave",
    TOIL: "TOIL",
    parental: "Parental",
    other: "Other",
  };

  const absenceStatusColors = {
    pending: "bg-yellow-500/10 text-yellow-500",
    approved: "bg-green-500/10 text-green-500",
    rejected: "bg-red-500/10 text-red-500",
  };

  const driverPathwayStatuses: { value: DriverPathwayStatus; label: string }[] = [
    { value: "medical_due", label: "Medical Due" },
    { value: "application_sent", label: "Application Sent" },
    { value: "awaiting_theory", label: "Awaiting Theory" },
    { value: "awaiting_course", label: "Awaiting Course" },
    { value: "passed_LGV", label: "Passed LGV" },
    { value: "awaiting_ERD", label: "Awaiting ERD" },
    { value: "passed", label: "Passed" },
  ];

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-red-600 flex items-center justify-center text-white text-2xl font-bold">
            {user?.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              {user?.name}
              {!user?.is_active && (
                <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                  Pending Sign-up
                </Badge>
              )}
            </h1>
            <p className="text-muted-foreground mt-1">{user?.email}</p>
            {profile?.service_number && (
              <p className="text-sm text-muted-foreground">Service #{profile.service_number}</p>
            )}
          </div>
        </div>
        {(canEdit || (userRole === "FF" && isViewingOwnProfile)) && (
          <div className="flex gap-2">
            {!user?.is_active && isWC && user && (
              <Button 
                variant="outline"
                onClick={async () => {
                  try {
                    const result = await backend.admin.getInviteLink({ email: user.email });
                    setInviteLink(result.invite_link);
                    setShowInviteDialog(true);
                  } catch (error: any) {
                    console.error("Failed to generate invite link:", error);
                    toast({
                      title: "Error",
                      description: error?.message || "Failed to generate invite link",
                      variant: "destructive",
                    });
                  }
                }}
                className="border-yellow-500 text-yellow-600 hover:bg-yellow-50"
              >
                <Send className="h-4 w-4 mr-2" />
                Send Invite Link
              </Button>
            )}
            {editMode ? (
              <>
                <Button variant="outline" onClick={handleCancelEdit}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  className="bg-red-600 hover:bg-red-700"
                  onClick={handleSaveProfile}
                  disabled={updateProfileMutation.isPending}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              </>
            ) : (
              <Button className="bg-red-600 hover:bg-red-700" onClick={() => setEditMode(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit Profile
              </Button>
            )}
          </div>
        )}
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="skills">Skills</TabsTrigger>
          <TabsTrigger value="notes">Notes & 1:1s</TabsTrigger>
          <TabsTrigger value="absences">Absences</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="activity">Activity Log</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Personal Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-muted-foreground">Email</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-foreground">{user?.email}</span>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Phone</Label>
                  {renderFieldWithLock(
                    "phone",
                    "Phone",
                    () => (
                      <Input
                        value={getDisplayValue("phone") || ""}
                        onChange={(e) => setEditedProfile({ ...editedProfile, phone: e.target.value })}
                        placeholder="Phone number"
                        className="mt-1"
                      />
                    ),
                    () => (
                      <div className="flex items-center gap-2 mt-1">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="text-foreground">{profile?.phone || "-"}</span>
                      </div>
                    )
                  )}
                </div>
                <div>
                  <Label className="text-muted-foreground">Role</Label>
                  {renderFieldWithLock(
                    "role",
                    "Role",
                    () => (
                      <Input
                        value={editedUser.role !== undefined ? editedUser.role : user?.role || ""}
                        onChange={(e) =>
                          setEditedUser({ ...editedUser, role: e.target.value })
                        }
                        placeholder="Role"
                        className="mt-1"
                      />
                    ),
                    () => (
                      <div className="mt-1">
                        <Badge>{user?.role}</Badge>
                      </div>
                    )
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5" />
                  Service Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-muted-foreground">Service Number</Label>
                  {renderFieldWithLock(
                    "service_number",
                    "Service Number",
                    () => (
                      <Input
                        value={getDisplayValue("service_number") || ""}
                        onChange={(e) => setEditedProfile({ ...editedProfile, service_number: e.target.value })}
                        placeholder="Service number"
                        className="mt-1"
                      />
                    ),
                    () => (
                      <p className="text-foreground font-medium mt-1">{profile?.service_number || "-"}</p>
                    )
                  )}
                </div>
                <div>
                  <Label className="text-muted-foreground">Rank</Label>
                  {renderFieldWithLock(
                    "rank",
                    "Rank",
                    () => (
                      <Select
                        value={getDisplayValue("rank") || ""}
                        onValueChange={(value) => setEditedProfile({ ...editedProfile, rank: value })}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select rank" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SC">SC - Station Commander</SelectItem>
                          <SelectItem value="WC">WC - Watch Commander</SelectItem>
                          <SelectItem value="CC">CC - Crew Commander</SelectItem>
                          <SelectItem value="FF">FF - Firefighter</SelectItem>
                        </SelectContent>
                      </Select>
                    ),
                    () => (
                      <p className="text-foreground font-medium mt-1">{profile?.rank || "-"}</p>
                    )
                  )}
                </div>
                {profile?.hire_date && (
                  <div>
                    <Label className="text-muted-foreground">Hire Date</Label>
                    <p className="text-foreground font-medium mt-1">
                      {new Date(profile.hire_date).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Assignment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-muted-foreground">Station</Label>
                  {renderFieldWithLock(
                    "station",
                    "Station",
                    () => (
                      <Input
                        value={getDisplayValue("station") || ""}
                        onChange={(e) => setEditedProfile({ ...editedProfile, station: e.target.value })}
                        placeholder="Station"
                        className="mt-1"
                      />
                    ),
                    () => (
                      <p className="text-foreground font-medium mt-1">{profile?.station || "-"}</p>
                    )
                  )}
                </div>
                <div>
                  <Label className="text-muted-foreground">Shift</Label>
                  {renderFieldWithLock(
                    "shift",
                    "Shift",
                    () => (
                      <Input
                        value={getDisplayValue("shift") || ""}
                        onChange={(e) => setEditedProfile({ ...editedProfile, shift: e.target.value })}
                        placeholder="Shift"
                        className="mt-1"
                      />
                    ),
                    () => (
                      <p className="text-foreground font-medium mt-1">{profile?.shift || "-"}</p>
                    )
                  )}
                </div>
                <div>
                  <Label className="text-muted-foreground">Watch Unit</Label>
                  {editMode && canEditField("watch") ? (
                    <Select
                      value={getDisplayValue("watch") || ""}
                      onValueChange={(value) => setEditedProfile({ ...editedProfile, watch: value as any })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select watch" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Green">
                          <div className="flex items-center gap-2">
                            <WatchDot watch="Green" />
                            Green
                          </div>
                        </SelectItem>
                        <SelectItem value="Red">
                          <div className="flex items-center gap-2">
                            <WatchDot watch="Red" />
                            Red
                          </div>
                        </SelectItem>
                        <SelectItem value="White">
                          <div className="flex items-center gap-2">
                            <WatchDot watch="White" />
                            White
                          </div>
                        </SelectItem>
                        <SelectItem value="Blue">
                          <div className="flex items-center gap-2">
                            <WatchDot watch="Blue" />
                            Blue
                          </div>
                        </SelectItem>
                        <SelectItem value="Amber">
                          <div className="flex items-center gap-2">
                            <WatchDot watch="Amber" />
                            Amber
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="mt-1">
                      {profile?.watch || user?.watch_unit ? (
                        <WatchBadge watch={profile?.watch || user?.watch_unit || ""} />
                      ) : (
                        <span className="text-foreground">-</span>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Driver Pathway
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  {editMode && canEditField("driverPathway") ? (
                    <Select
                      value={getDisplayValue("driverPathway")?.status || ""}
                      onValueChange={(value: DriverPathwayStatus) =>
                        setEditedProfile({
                          ...editedProfile,
                          driverPathway: {
                            status: value,
                            lgvPassedDate: getDisplayValue("driverPathway")?.lgvPassedDate,
                          },
                        })
                      }
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {driverPathwayStatuses.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="mt-1">
                      {profile?.driverPathway?.status ? (
                        <Badge>
                          {driverPathwayStatuses.find(s => s.value === profile.driverPathway?.status)?.label || profile.driverPathway.status}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </div>
                  )}
                </div>
                {(getDisplayValue("driverPathway")?.status === "passed_LGV" || 
                  getDisplayValue("driverPathway")?.status === "awaiting_ERD" || 
                  getDisplayValue("driverPathway")?.status === "passed") && (
                  <div>
                    <Label className="text-muted-foreground">LGV Passed Date</Label>
                    {editMode && canEditField("driverPathway") ? (
                      <Input
                        type="date"
                        value={getDisplayValue("driverPathway")?.lgvPassedDate || ""}
                        onChange={(e) =>
                          setEditedProfile({
                            ...editedProfile,
                            driverPathway: {
                              status: getDisplayValue("driverPathway")?.status || "passed_LGV",
                              lgvPassedDate: e.target.value,
                            },
                          })
                        }
                        className="mt-1"
                      />
                    ) : (
                      <p className="text-foreground font-medium mt-1">
                        {profile?.driverPathway?.lgvPassedDate || "-"}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <SkillsSummaryCard profileId={profile?.id} />

            <Card>
              <CardHeader>
                <CardTitle>Emergency Contact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-muted-foreground">Contact Name</Label>
                  {renderFieldWithLock(
                    "emergency_contact_name",
                    "Emergency Contact Name",
                    () => (
                      <Input
                        value={getDisplayValue("emergency_contact_name") || ""}
                        onChange={(e) =>
                          setEditedProfile({ ...editedProfile, emergency_contact_name: e.target.value })
                        }
                        placeholder="Emergency contact name"
                        className="mt-1"
                      />
                    ),
                    () => (
                      <p className="text-foreground font-medium mt-1">
                        {profile?.emergency_contact_name || "-"}
                      </p>
                    )
                  )}
                </div>
                <div>
                  <Label className="text-muted-foreground">Contact Phone</Label>
                  {renderFieldWithLock(
                    "emergency_contact_phone",
                    "Emergency Contact Phone",
                    () => (
                      <Input
                        value={getDisplayValue("emergency_contact_phone") || ""}
                        onChange={(e) =>
                          setEditedProfile({ ...editedProfile, emergency_contact_phone: e.target.value })
                        }
                        placeholder="Emergency contact phone"
                        className="mt-1"
                      />
                    ),
                    () => (
                      <p className="text-foreground font-medium mt-1">
                        {profile?.emergency_contact_phone || "-"}
                      </p>
                    )
                  )}
                </div>
              </CardContent>
            </Card>

            {profile?.lastConversation && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Last Conversation
                  </CardTitle>
                  <CardDescription>
                    {new Date(profile.lastConversation.date).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-foreground">{profile.lastConversation.text}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="notes" className="space-y-6">
          {canEdit && (
            <Card>
              <CardHeader>
                <CardTitle>Add Note / 1:1 Entry</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Note</Label>
                  <Textarea
                    value={newNote.note_text}
                    onChange={(e) => setNewNote({ ...newNote, note_text: e.target.value })}
                    placeholder="Enter conversation notes..."
                    rows={4}
                    className="mt-1"
                  />
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Follow-up Date {newNote.reminder_enabled && <span className="text-red-600">*</span>}</Label>
                      <Input
                        type="date"
                        value={newNote.next_follow_up_date}
                        onChange={(e) => setNewNote({ ...newNote, next_follow_up_date: e.target.value })}
                        className="mt-1"
                      />
                      {newNote.reminder_enabled && !newNote.next_follow_up_date && (
                        <p className="text-xs text-red-600 mt-1">Required when reminder is enabled</p>
                      )}
                    </div>
                    <div className="flex items-end">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="reminder"
                          checked={newNote.reminder_enabled}
                          onCheckedChange={(checked) =>
                            setNewNote({ ...newNote, reminder_enabled: !!checked })
                          }
                        />
                        <Label htmlFor="reminder" className="cursor-pointer">Set reminder</Label>
                      </div>
                    </div>
                  </div>
                  {newNote.reminder_enabled && (() => {
                    try {
                      return (
                        <div>
                          <Label>Reminder Recipient</Label>
                          {allUsersLoading ? (
                            <div className="mt-1 p-2 border rounded-md">
                              <p className="text-sm text-muted-foreground">Loading users...</p>
                            </div>
                          ) : allUsersError ? (
                            <div className="mt-1 p-2 border rounded-md border-yellow-500/20 bg-yellow-500/10">
                              <p className="text-sm text-yellow-600">Failed to load users. Creating personal reminder only.</p>
                            </div>
                          ) : !allUsersData?.users || allUsersData.users.length === 0 ? (
                            <div className="mt-1 p-2 border rounded-md border-yellow-500/20 bg-yellow-500/10">
                              <p className="text-sm text-yellow-600">No users found. Creating personal reminder only.</p>
                            </div>
                          ) : (
                            <Select
                              value={newNote.reminder_recipient_user_id || "__personal__"}
                              onValueChange={(value) => {
                                setNewNote({ 
                                  ...newNote, 
                                  reminder_recipient_user_id: value === "__personal__" ? "" : value 
                                });
                                setUserSearchQuery("");
                              }}
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue placeholder="Only me (personal reminder)" />
                              </SelectTrigger>
                              <SelectContent>
                                <div className="p-2 sticky top-0 bg-background border-b">
                                  <Input
                                    placeholder="Search users..."
                                    value={userSearchQuery}
                                    onChange={(e) => setUserSearchQuery(e.target.value)}
                                    className="h-8"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>
                                <SelectItem value="__personal__">Only me (personal reminder)</SelectItem>
                                {Array.isArray(allUsersData.users) && allUsersData.users
                                  .filter(u => 
                                    u && u.name && u.email && (
                                      !userSearchQuery || 
                                      u.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                                      u.email.toLowerCase().includes(userSearchQuery.toLowerCase())
                                    )
                                  )
                                  .map(u => (
                                    <SelectItem key={u.id} value={u.id}>
                                      {u.name} ({u.email})
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {newNote.reminder_recipient_user_id
                              ? "Reminder will appear in both calendars"
                              : "Reminder will appear in your calendar"}
                          </p>
                        </div>
                      );
                    } catch (err) {
                      console.error("Error rendering reminder recipient:", err);
                      return (
                        <div className="mt-1 p-2 border rounded-md border-red-500/20 bg-red-500/10">
                          <p className="text-sm text-red-600">Error loading recipient options. Creating personal reminder only.</p>
                        </div>
                      );
                    }
                  })()}
                </div>
                <div>
                  <Label>Attachments (optional)</Label>
                  <Input
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif"
                    onChange={(e) => {
                      if (e.target.files) {
                        setUploadingFiles(Array.from(e.target.files));
                      }
                    }}
                    className="mt-1"
                  />
                  {uploadingFiles.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {uploadingFiles.map((file, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <FileText className="h-4 w-4" />
                          <span>{file.name}</span>
                          <span className="text-xs">({(file.size / 1024).toFixed(1)} KB)</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Supported: PDF, Word, Excel, Images (JPG, PNG, GIF)
                  </p>
                </div>
                <Button
                  onClick={() => createNoteMutation.mutate()}
                  disabled={!newNote.note_text || createNoteMutation.isPending}
                  className="bg-red-600 hover:bg-red-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Note
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
              <CardDescription>All notes and 1:1 conversations</CardDescription>
            </CardHeader>
            <CardContent>
              {notes.length > 0 ? (
                <div className="space-y-4">
                  {notes.map((note) => (
                    <div key={note.id} className="border-l-2 border-red-600 pl-4 py-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-sm font-medium text-muted-foreground">
                              {new Date(note.created_at).toLocaleDateString()}
                            </span>
                            {note.reminder_enabled && note.next_follow_up_date && (
                              <Badge variant="outline" className="text-xs">
                                <CalendarIcon className="h-3 w-3 mr-1" />
                                {new Date(note.next_follow_up_date).toLocaleDateString()}
                              </Badge>
                            )}
                            {note.reminder_enabled && note.reminder_recipient_user_id && (
                              <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 border-blue-500/20">
                                <User className="h-3 w-3 mr-1" />
                                Shared reminder
                              </Badge>
                            )}
                            {note.reminder_enabled && !note.reminder_recipient_user_id && (
                              <Badge variant="outline" className="text-xs">
                                <Bell className="h-3 w-3 mr-1" />
                                Personal reminder
                              </Badge>
                            )}
                          </div>
                          <p className="text-foreground whitespace-pre-wrap">{note.note_text}</p>
                          {note.attachments && note.attachments.length > 0 && (
                            <div className="mt-3 space-y-2">
                              {note.attachments.map((attachment, idx) => (
                                <a
                                  key={idx}
                                  href={attachment.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 hover:underline"
                                >
                                  <FileText className="h-4 w-4" />
                                  <span>{attachment.filename}</span>
                                  <span className="text-xs text-muted-foreground">
                                    ({(attachment.fileSize / 1024).toFixed(1)} KB)
                                  </span>
                                  <Download className="h-3 w-3" />
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center py-8 text-muted-foreground">No notes recorded</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="skills" className="space-y-6">
          {profile && <SkillsTab profileId={profile.id} userId={userId} />}
        </TabsContent>

        <TabsContent value="absences" className="space-y-6">
          {profile && profile.trigger_stage !== "None" && (
            <div className={`p-4 rounded-lg border ${
              profile.trigger_stage === "Stage3"
                ? "bg-red-500/10 border-red-500/20"
                : profile.trigger_stage === "Stage2"
                ? "bg-yellow-500/10 border-yellow-500/20"
                : "bg-blue-500/10 border-blue-500/20"
            }`}>
              <div className="flex items-start gap-3">
                <AlertTriangle className={`h-5 w-5 mt-0.5 ${
                  profile.trigger_stage === "Stage3"
                    ? "text-red-600 dark:text-red-400"
                    : profile.trigger_stage === "Stage2"
                    ? "text-yellow-600 dark:text-yellow-400"
                    : "text-blue-600 dark:text-blue-400"
                }`} />
                <div className="flex-1">
                  <h4 className={`font-semibold ${
                    profile.trigger_stage === "Stage3"
                      ? "text-red-600 dark:text-red-400"
                      : profile.trigger_stage === "Stage2"
                      ? "text-yellow-600 dark:text-yellow-400"
                      : "text-blue-600 dark:text-blue-400"
                  }`}>
                    {profile.trigger_stage === "Stage3" && "Critical Alert - Stage 3 Triggered"}
                    {profile.trigger_stage === "Stage2" && "Warning - Stage 2 Triggered"}
                    {profile.trigger_stage === "Stage1" && "Notice - Stage 1 Triggered"}
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Rolling 6-month sickness: <strong>{profile.rolling_sick_episodes} episodes</strong>, <strong>{profile.rolling_sick_days} days</strong>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Action may be required according to absence management policy
                  </p>
                </div>
              </div>
            </div>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Absence History</CardTitle>
                  <CardDescription>
                    Rolling 6-month totals: <strong>{profile?.rolling_sick_episodes || 0} episodes</strong>, <strong>{profile?.rolling_sick_days || 0} days</strong>
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {absencesLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    </TableRow>
                  ) : absences && absences.length > 0 ? (
                    absences.map((absence) => {
                      const days = Math.ceil(
                        (new Date(absence.end_date).getTime() - new Date(absence.start_date).getTime()) /
                          (1000 * 60 * 60 * 24)
                      ) + 1;
                      return (
                        <TableRow key={absence.id}>
                          <TableCell>
                            <Badge variant="outline">{absenceTypeLabels[absence.type]}</Badge>
                          </TableCell>
                          <TableCell>{new Date(absence.start_date).toLocaleDateString()}</TableCell>
                          <TableCell>{new Date(absence.end_date).toLocaleDateString()}</TableCell>
                          <TableCell>{days}</TableCell>
                          <TableCell className="max-w-xs truncate">{absence.reason}</TableCell>
                          <TableCell>
                            <Badge className={absenceStatusColors[absence.status]}>
                              {absence.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No absences recorded
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-6">
          {canEdit && (
            <Card>
              <CardHeader>
                <CardTitle>Upload Document</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileUpload}
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    disabled={uploadDocumentMutation.isPending}
                  />
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadDocumentMutation.isPending}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Supported: PDF, JPG, PNG, Word documents
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
              <CardDescription>All uploaded files</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Uploaded</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.length > 0 ? (
                    documents.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium">{doc.file_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{doc.file_type}</Badge>
                        </TableCell>
                        <TableCell>{new Date(doc.uploaded_at).toLocaleDateString()}</TableCell>
                        <TableCell>{(doc.file_size / 1024).toFixed(1)} KB</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDownloadDocument(doc.id)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            {canEdit && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => deleteDocumentMutation.mutate(doc.id)}
                                disabled={deleteDocumentMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No documents uploaded
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Activity Log
              </CardTitle>
              <CardDescription>All changes to this profile</CardDescription>
            </CardHeader>
            <CardContent>
              {activityLog && activityLog.logs.length > 0 ? (
                <div className="space-y-3">
                  {activityLog.logs.map((log) => (
                    <div key={log.id} className="flex items-start gap-3 py-2 border-b last:border-0">
                      <CheckCircle2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{log.action}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(log.timestamp).toLocaleString()}
                          </span>
                        </div>
                        {log.details && (
                          <p className="text-sm text-muted-foreground mt-1">
                            Changed: {Object.keys(log.details).join(", ")}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center py-8 text-muted-foreground">No activity recorded</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite {user?.name}</DialogTitle>
            <DialogDescription>
              Share this link with {user?.name} to invite them to sign up and claim their profile.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={inviteLink}
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(inviteLink);
                  toast({
                    title: "Copied!",
                    description: "Invite link copied to clipboard",
                  });
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              When they sign up using this link, their account will be automatically linked to this profile.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
