import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import backend from "~backend/client";
import type { FirefighterProfile, UpdateProfileRequest } from "~backend/profile/types";
import type { AbsenceType } from "~backend/absence/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Calendar,
  Award,
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
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { useCanEditProfiles, useIsWC, useUserRole } from "@/lib/rbac";
import { useUser } from "@clerk/clerk-react";

export default function ProfileDetail() {
  const { userId } = useParams<{ userId: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser } = useUser();
  const canEdit = useCanEditProfiles();
  const isWC = useIsWC();
  const userRole = useUserRole();
  const isViewingOwnProfile = currentUser?.id === userId;
  const [editMode, setEditMode] = useState(false);
  const [editedProfile, setEditedProfile] = useState<Partial<FirefighterProfile>>({});

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

  const { data: absenceStats } = useQuery({
    queryKey: ["absence-stats", userId],
    queryFn: async () => backend.absence.getStats({ user_id: userId! }),
    enabled: !!userId,
  });

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => backend.settings.get(),
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
    },
    onError: (error) => {
      console.error("Failed to update profile:", error);
      toast({
        title: "Failed to update profile",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    },
  });

  const [newAbsence, setNewAbsence] = useState({
    type: "sickness" as AbsenceType,
    start_date: "",
    end_date: "",
    reason: "",
  });
  const [showAbsenceForm, setShowAbsenceForm] = useState(false);

  const createAbsenceMutation = useMutation({
    mutationFn: async () => {
      return await backend.absence.create({
        user_id: userId!,
        type: newAbsence.type,
        start_date: new Date(newAbsence.start_date),
        end_date: new Date(newAbsence.end_date),
        reason: newAbsence.reason,
      });
    },
    onSuccess: async (data) => {
      if (currentUser?.id) {
        try {
          await backend.admin.createActivityLog({
            actor_user_id: currentUser.id,
            action: "create_absence",
            entity_type: "absence",
            entity_id: data.id.toString(),
            metadata: { user_id: userId, type: newAbsence.type },
          });
        } catch (error) {
          console.error("Failed to log activity:", error);
        }
      }
      
      queryClient.invalidateQueries({ queryKey: ["absences", userId] });
      queryClient.invalidateQueries({ queryKey: ["absence-stats", userId] });
      toast({
        title: "Absence recorded",
        description: "Absence has been created successfully",
      });
      setShowAbsenceForm(false);
      setNewAbsence({
        type: "sickness",
        start_date: "",
        end_date: "",
        reason: "",
      });
    },
    onError: (error) => {
      console.error("Failed to create absence:", error);
      toast({
        title: "Failed to create absence",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    },
  });

  const handleSaveProfile = () => {
    const updates: UpdateProfileRequest = {};
    
    if (editedProfile.service_number !== undefined) updates.service_number = editedProfile.service_number;
    if (editedProfile.station !== undefined) updates.station = editedProfile.station;
    if (editedProfile.shift !== undefined) updates.shift = editedProfile.shift;
    if (editedProfile.rank !== undefined) updates.rank = editedProfile.rank;
    if (editedProfile.phone !== undefined) updates.phone = editedProfile.phone;
    if (editedProfile.emergency_contact_name !== undefined) updates.emergency_contact_name = editedProfile.emergency_contact_name;
    if (editedProfile.emergency_contact_phone !== undefined) updates.emergency_contact_phone = editedProfile.emergency_contact_phone;
    if (editedProfile.skills !== undefined) updates.skills = editedProfile.skills;
    if (editedProfile.certifications !== undefined) updates.certifications = editedProfile.certifications;
    if (editedProfile.driver !== undefined) updates.driver = editedProfile.driver;
    if (editedProfile.prps !== undefined) updates.prps = editedProfile.prps;
    if (editedProfile.ba !== undefined) updates.ba = editedProfile.ba;
    if (editedProfile.notes !== undefined) updates.notes = editedProfile.notes;
    if (editedProfile.last_one_to_one_date !== undefined) updates.last_one_to_one_date = editedProfile.last_one_to_one_date;
    if (editedProfile.next_one_to_one_date !== undefined) updates.next_one_to_one_date = editedProfile.next_one_to_one_date;

    updateProfileMutation.mutate(updates);
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    setEditedProfile({});
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
      const ffEditableFields = ["phone", "emergency_contact_name", "emergency_contact_phone"];
      return ffEditableFields.includes(fieldName);
    }
    
    return false;
  };

  const isFieldLocked = (fieldName: string): boolean => {
    return editMode && !canEditField(fieldName);
  };

  const handleSkillToggle = (skill: string) => {
    const currentSkills = getDisplayValue("skills") || [];
    const newSkills = currentSkills.includes(skill)
      ? currentSkills.filter(s => s !== skill)
      : [...currentSkills, skill];
    setEditedProfile({ ...editedProfile, skills: newSkills });
  };

  const handleCertToggle = (cert: string) => {
    const currentCerts = getDisplayValue("certifications") || [];
    const newCerts = currentCerts.includes(cert)
      ? currentCerts.filter(c => c !== cert)
      : [...currentCerts, cert];
    setEditedProfile({ ...editedProfile, certifications: newCerts });
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
              <p>Only Watch Commander can edit this field</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return renderInput();
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-red-600 flex items-center justify-center text-white text-2xl font-bold">
            {user?.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">{user?.name}</h1>
            <p className="text-muted-foreground mt-1">{user?.email}</p>
            {profile?.service_number && (
              <p className="text-sm text-muted-foreground">Service #{profile.service_number}</p>
            )}
          </div>
        </div>
        {(canEdit || (userRole === "FF" && isViewingOwnProfile)) && (
          <div className="flex gap-2">
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
          <TabsTrigger value="skills">Skills & Certifications</TabsTrigger>
          <TabsTrigger value="absences">Absences</TabsTrigger>
          <TabsTrigger value="notes">Notes & 1:1s</TabsTrigger>
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
                  <div className="mt-1">
                    <Badge>{user?.role}</Badge>
                  </div>
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
                      <Input
                        value={getDisplayValue("rank") || ""}
                        onChange={(e) => setEditedProfile({ ...editedProfile, rank: e.target.value })}
                        placeholder="Rank"
                        className="mt-1"
                      />
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
                  <p className="text-foreground font-medium mt-1">{user?.watch_unit || "-"}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Qualifications
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>PRPS</Label>
                  {editMode && canEditField("prps") ? (
                    <Checkbox
                      checked={getDisplayValue("prps") || false}
                      onCheckedChange={(checked) =>
                        setEditedProfile({ ...editedProfile, prps: !!checked })
                      }
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <Badge variant={profile?.prps ? "default" : "outline"}>
                        {profile?.prps ? "Qualified" : "Not qualified"}
                      </Badge>
                      {isFieldLocked("prps") && <Lock className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <Label>BA</Label>
                  {editMode && canEditField("ba") ? (
                    <Checkbox
                      checked={getDisplayValue("ba") || false}
                      onCheckedChange={(checked) =>
                        setEditedProfile({ ...editedProfile, ba: !!checked })
                      }
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <Badge variant={profile?.ba ? "default" : "outline"}>
                        {profile?.ba ? "Qualified" : "Not qualified"}
                      </Badge>
                      {isFieldLocked("ba") && <Lock className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <Label>LGV Driver</Label>
                  {editMode && canEditField("driver") ? (
                    <Checkbox
                      checked={getDisplayValue("driver")?.lgv || false}
                      onCheckedChange={(checked) =>
                        setEditedProfile({
                          ...editedProfile,
                          driver: { lgv: !!checked, erd: getDisplayValue("driver")?.erd || false },
                        })
                      }
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <Badge variant={profile?.driver?.lgv ? "default" : "outline"}>
                        {profile?.driver?.lgv ? "Qualified" : "Not qualified"}
                      </Badge>
                      {isFieldLocked("driver") && <Lock className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <Label>ERD Driver</Label>
                  {editMode && canEditField("driver") ? (
                    <Checkbox
                      checked={getDisplayValue("driver")?.erd || false}
                      onCheckedChange={(checked) =>
                        setEditedProfile({
                          ...editedProfile,
                          driver: { lgv: getDisplayValue("driver")?.lgv || false, erd: !!checked },
                        })
                      }
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <Badge variant={profile?.driver?.erd ? "default" : "outline"}>
                        {profile?.driver?.erd ? "Qualified" : "Not qualified"}
                      </Badge>
                      {isFieldLocked("driver") && <Lock className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {absenceStats && (
              <Card>
                <CardHeader>
                  <CardTitle>Absence Summary</CardTitle>
                  <CardDescription>6-month rolling period</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Days</span>
                    <span className="font-medium text-foreground">
                      {absenceStats.six_month_total}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sick Days</span>
                    <span className="font-medium text-foreground">
                      {absenceStats.sick_days}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Annual Leave</span>
                    <span className="font-medium text-foreground">
                      {absenceStats.vacation_days}
                    </span>
                  </div>
                  {absenceStats.stage_alert && (
                    <div className="mt-4">
                      <Badge
                        className={
                          absenceStats.stage_alert.includes("Critical")
                            ? "bg-red-500/10 text-red-500"
                            : absenceStats.stage_alert.includes("Warning")
                            ? "bg-yellow-500/10 text-yellow-500"
                            : "bg-blue-500/10 text-blue-500"
                        }
                      >
                        {absenceStats.stage_alert}
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

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
          </div>
        </TabsContent>

        <TabsContent value="skills" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Skills
                </CardTitle>
                <CardDescription>Technical and operational skills</CardDescription>
              </CardHeader>
              <CardContent>
                {editMode && canEditField("skills") ? (
                  <div className="space-y-3">
                    {settings?.skills_dictionary && settings.skills_dictionary.length > 0 ? (
                      <div className="space-y-2">
                        {settings.skills_dictionary.map((skill) => (
                          <div key={skill} className="flex items-center gap-2">
                            <Checkbox
                              id={`skill-${skill}`}
                              checked={getDisplayValue("skills")?.includes(skill) || false}
                              onCheckedChange={() => handleSkillToggle(skill)}
                            />
                            <Label htmlFor={`skill-${skill}`} className="cursor-pointer">
                              {skill}
                            </Label>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm">No skills configured in settings</p>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {profile?.skills && profile.skills.length > 0 ? (
                      profile.skills.map((skill, index) => (
                        <Badge key={index} variant="outline">
                          {skill}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-muted-foreground text-sm">No skills recorded</p>
                    )}
                    {isFieldLocked("skills") && (
                      <div className="w-full mt-2 flex items-center gap-2 text-muted-foreground text-sm">
                        <Lock className="h-4 w-4" />
                        <span>Locked - WC access required</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Certifications
                </CardTitle>
                <CardDescription>Professional certifications</CardDescription>
              </CardHeader>
              <CardContent>
                {editMode && canEditField("certifications") ? (
                  <div className="space-y-3">
                    {settings?.certifications_dictionary && settings.certifications_dictionary.length > 0 ? (
                      <div className="space-y-2">
                        {settings.certifications_dictionary.map((cert) => (
                          <div key={cert} className="flex items-center gap-2">
                            <Checkbox
                              id={`cert-${cert}`}
                              checked={getDisplayValue("certifications")?.includes(cert) || false}
                              onCheckedChange={() => handleCertToggle(cert)}
                            />
                            <Label htmlFor={`cert-${cert}`} className="cursor-pointer">
                              {cert}
                            </Label>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm">No certifications configured in settings</p>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {profile?.certifications && profile.certifications.length > 0 ? (
                      profile.certifications.map((cert, index) => (
                        <Badge key={index} variant="outline">
                          {cert}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-muted-foreground text-sm">No certifications recorded</p>
                    )}
                    {isFieldLocked("certifications") && (
                      <div className="w-full mt-2 flex items-center gap-2 text-muted-foreground text-sm">
                        <Lock className="h-4 w-4" />
                        <span>Locked - WC access required</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
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

          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Absence History</h3>
              <p className="text-sm text-muted-foreground">
                All recorded absences
                {profile && (
                  <span className="ml-2">
                    • Rolling 6-month sickness: <strong>{profile.rolling_sick_episodes} episodes</strong>, <strong>{profile.rolling_sick_days} days</strong>
                  </span>
                )}
              </p>
            </div>
            {canEdit && (
              <Button
                className="bg-red-600 hover:bg-red-700"
                onClick={() => setShowAbsenceForm(!showAbsenceForm)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Record Absence
              </Button>
            )}
          </div>

          {showAbsenceForm && (
            <Card>
              <CardHeader>
                <CardTitle>Record New Absence</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Type</Label>
                    <Select
                      value={newAbsence.type}
                      onValueChange={(value: AbsenceType) =>
                        setNewAbsence({ ...newAbsence, type: value })
                      }
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sickness">Sickness</SelectItem>
                        <SelectItem value="AL">Annual Leave</SelectItem>
                        <SelectItem value="TOIL">TOIL</SelectItem>
                        <SelectItem value="parental">Parental</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Reason</Label>
                    <Input
                      value={newAbsence.reason}
                      onChange={(e) => setNewAbsence({ ...newAbsence, reason: e.target.value })}
                      placeholder="Brief description"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Start Date</Label>
                    <Input
                      type="date"
                      value={newAbsence.start_date}
                      onChange={(e) => setNewAbsence({ ...newAbsence, start_date: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>End Date</Label>
                    <Input
                      type="date"
                      value={newAbsence.end_date}
                      onChange={(e) => setNewAbsence({ ...newAbsence, end_date: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    className="bg-red-600 hover:bg-red-700"
                    onClick={() => createAbsenceMutation.mutate()}
                    disabled={
                      !newAbsence.start_date ||
                      !newAbsence.end_date ||
                      !newAbsence.reason ||
                      createAbsenceMutation.isPending
                    }
                  >
                    Save Absence
                  </Button>
                  <Button variant="outline" onClick={() => setShowAbsenceForm(false)}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
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
          </Card>
        </TabsContent>

        <TabsContent value="notes" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  One-to-One Meetings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-muted-foreground">Last 1:1 Date</Label>
                  {editMode && canEditField("last_one_to_one_date") ? (
                    <Input
                      type="date"
                      value={
                        getDisplayValue("last_one_to_one_date")
                          ? new Date(getDisplayValue("last_one_to_one_date")!).toISOString().split("T")[0]
                          : ""
                      }
                      onChange={(e) =>
                        setEditedProfile({
                          ...editedProfile,
                          last_one_to_one_date: e.target.value ? new Date(e.target.value) : undefined,
                        })
                      }
                      className="mt-1"
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="text-foreground font-medium mt-1">
                        {profile?.last_one_to_one_date
                          ? new Date(profile.last_one_to_one_date).toLocaleDateString()
                          : "Not scheduled"}
                      </p>
                      {isFieldLocked("last_one_to_one_date") && <Lock className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  )}
                </div>
                <div>
                  <Label className="text-muted-foreground">Next 1:1 Date</Label>
                  {editMode && canEditField("next_one_to_one_date") ? (
                    <Input
                      type="date"
                      value={
                        getDisplayValue("next_one_to_one_date")
                          ? new Date(getDisplayValue("next_one_to_one_date")!).toISOString().split("T")[0]
                          : ""
                      }
                      onChange={(e) =>
                        setEditedProfile({
                          ...editedProfile,
                          next_one_to_one_date: e.target.value ? new Date(e.target.value) : undefined,
                        })
                      }
                      className="mt-1"
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="text-foreground font-medium mt-1">
                        {profile?.next_one_to_one_date
                          ? new Date(profile.next_one_to_one_date).toLocaleDateString()
                          : "Not scheduled"}
                      </p>
                      {isFieldLocked("next_one_to_one_date") && <Lock className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Notes
                </CardTitle>
                <CardDescription>Personal notes and observations</CardDescription>
              </CardHeader>
              <CardContent>
                {editMode && canEditField("notes") ? (
                  <Textarea
                    value={getDisplayValue("notes") || ""}
                    onChange={(e) => setEditedProfile({ ...editedProfile, notes: e.target.value })}
                    placeholder="Add notes about this person..."
                    rows={6}
                  />
                ) : (
                  <div>
                    <p className="text-foreground whitespace-pre-wrap">
                      {profile?.notes || (
                        <span className="text-muted-foreground text-sm">No notes recorded</span>
                      )}
                    </p>
                    {isFieldLocked("notes") && (
                      <div className="mt-2 flex items-center gap-2 text-muted-foreground text-sm">
                        <Lock className="h-4 w-4" />
                        <span>Locked - WC access required</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
