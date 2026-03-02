import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/App";
import backend from "@/lib/backend";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { 
  User, 
  Mail, 
  Phone, 
  MapPin,
  Shield,
  Edit,
  Save,
  X,
  Calendar,
  Award,
  AlertCircle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function MyProfile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const [phone, setPhone] = useState("");

  const { data: profile, isLoading } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      return await backend.profile.getByUser({ user_id: user.id });
    },
    enabled: !!user,
  });

  const { data: userData } = useQuery({
    queryKey: ["my-user", user?.id],
    queryFn: async () => {
      if (!user) return null;
      return await backend.user.get(user.id);
    },
    enabled: !!user,
  });

  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      if (!profile) throw new Error("No profile found");
      return await backend.profile.update({
        id: profile.id,
        phone: phone || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-profile", user?.id] });
      toast({
        title: "Profile updated",
        description: "Your phone number has been updated",
      });
      setEditMode(false);
    },
    onError: (error) => {
      console.error("Failed to update profile:", error);
      toast({
        title: "Update failed",
        description: "Failed to update your profile",
        variant: "destructive",
      });
    },
  });

  const handleEdit = () => {
    setPhone(profile?.phone || "");
    setEditMode(true);
  };

  const handleSave = () => {
    updateProfileMutation.mutate();
  };

  const handleCancel = () => {
    setEditMode(false);
    setPhone(profile?.phone || "");
  };

  const getTrainingStatus = () => {
    if (!profile?.next_one_to_one_date) return null;
    
    const nextDate = new Date(profile.next_one_to_one_date);
    const today = new Date();
    const daysUntil = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntil < 0) {
      return { status: "overdue", message: "Overdue", color: "text-red-500" };
    } else if (daysUntil <= 7) {
      return { status: "due-soon", message: `Due in ${daysUntil} days`, color: "text-yellow-500" };
    } else {
      return { status: "scheduled", message: `Scheduled`, color: "text-green-500" };
    }
  };

  const trainingStatus = getTrainingStatus();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">My Profile</h2>
          <p className="text-muted-foreground mt-1">
            View and update your information
          </p>
        </div>
        {!editMode && (
          <Button
            onClick={handleEdit}
            variant="outline"
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit Contact
          </Button>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Personal Information
            </CardTitle>
            <CardDescription>Your basic details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-muted-foreground">Full Name</Label>
              <p className="text-foreground font-medium mt-1">{user?.name || "Not set"}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Email</Label>
              <div className="flex items-center gap-2 mt-1">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <p className="text-foreground">{user?.email}</p>
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground">Phone</Label>
              {editMode ? (
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Your phone number"
                  className="mt-1"
                />
              ) : (
                <div className="flex items-center gap-2 mt-1">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <p className="text-foreground">{profile?.phone || "Not set"}</p>
                </div>
              )}
            </div>
            {editMode && (
              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleSave}
                  disabled={updateProfileMutation.isPending}
                  className="bg-red-600 hover:bg-red-700"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
                <Button
                  onClick={handleCancel}
                  variant="outline"
                  disabled={updateProfileMutation.isPending}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Service Details
            </CardTitle>
            <CardDescription>Your role and assignment</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {profile?.service_number && (
              <div>
                <Label className="text-muted-foreground">Service Number</Label>
                <p className="text-foreground font-medium mt-1">{profile.service_number}</p>
              </div>
            )}
            {profile?.station && (
              <div>
                <Label className="text-muted-foreground">Station</Label>
                <div className="flex items-center gap-2 mt-1">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <p className="text-foreground">{profile.station}</p>
                </div>
              </div>
            )}
            {profile?.shift && (
              <div>
                <Label className="text-muted-foreground">Shift</Label>
                <p className="text-foreground mt-1">
                  <Badge variant="outline">{profile.shift}</Badge>
                </p>
              </div>
            )}
            {profile?.rank && (
              <div>
                <Label className="text-muted-foreground">Rank</Label>
                <p className="text-foreground mt-1">
                  <Badge>{profile.rank}</Badge>
                </p>
              </div>
            )}
            {userData?.role && (
              <div>
                <Label className="text-muted-foreground">System Role</Label>
                <p className="text-foreground mt-1">
                  <Badge variant="outline">{userData.role}</Badge>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Qualifications
            </CardTitle>
            <CardDescription>Your certifications and skills</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>PRPS Qualified</Label>
              <Badge variant={profile?.prps ? "default" : "outline"}>
                {profile?.prps ? "Yes" : "No"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <Label>BA Qualified</Label>
              <Badge variant={profile?.ba ? "default" : "outline"}>
                {profile?.ba ? "Yes" : "No"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <Label>LGV Driver</Label>
              <Badge variant={profile?.driver?.lgv ? "default" : "outline"}>
                {profile?.driver?.lgv ? "Yes" : "No"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <Label>ERD Driver</Label>
              <Badge variant={profile?.driver?.erd ? "default" : "outline"}>
                {profile?.driver?.erd ? "Yes" : "No"}
              </Badge>
            </div>
            {profile?.certifications && profile.certifications.length > 0 && (
              <div>
                <Label className="text-muted-foreground mb-2 block">Certifications</Label>
                <div className="flex flex-wrap gap-2">
                  {profile.certifications.map((cert, i) => (
                    <Badge key={i} variant="outline">{cert}</Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Training & Development
            </CardTitle>
            <CardDescription>One-to-one meetings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {profile?.last_one_to_one_date && (
              <div>
                <Label className="text-muted-foreground">Last 1:1 Meeting</Label>
                <p className="text-foreground mt-1">
                  {new Date(profile.last_one_to_one_date).toLocaleDateString()}
                </p>
              </div>
            )}
            {profile?.next_one_to_one_date ? (
              <div>
                <Label className="text-muted-foreground">Next 1:1 Meeting</Label>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-foreground">
                    {new Date(profile.next_one_to_one_date).toLocaleDateString()}
                  </p>
                  {trainingStatus && (
                    <Badge className={trainingStatus.status === "overdue" ? "bg-red-500/10 text-red-500" : trainingStatus.status === "due-soon" ? "bg-yellow-500/10 text-yellow-500" : "bg-green-500/10 text-green-500"}>
                      {trainingStatus.message}
                    </Badge>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 p-4 rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900">
                <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-900 dark:text-yellow-200">
                    No 1:1 scheduled
                  </p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                    Contact your supervisor to schedule your next one-to-one meeting
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
