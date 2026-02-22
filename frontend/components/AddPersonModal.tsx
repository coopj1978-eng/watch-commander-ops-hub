import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { useBackend } from "@/lib/rbac";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

interface AddPersonModalProps {
  isOpen: boolean;
  onClose: () => void;
}

import { WatchDot } from "./WatchBadge";

const WATCH_OPTIONS = ["Green", "Red", "White", "Blue", "Amber"];
const RANK_OPTIONS = ["SC", "WC", "CC", "FF"];

const DRIVER_PATHWAY_OPTIONS = [
  { value: "medical_due", label: "Medical Due" },
  { value: "application_sent", label: "Application Sent" },
  { value: "awaiting_theory", label: "Awaiting Theory" },
  { value: "awaiting_course", label: "Awaiting Course" },
  { value: "passed_LGV", label: "Passed LGV" },
  { value: "awaiting_ERD", label: "Awaiting ERD" },
  { value: "passed", label: "Passed" },
];

export default function AddPersonModal({ isOpen, onClose }: AddPersonModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [watch, setWatch] = useState("");
  const [rank, setRank] = useState("");
  const [serviceNumber, setServiceNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [niNumber, setNiNumber] = useState("");
  const [station, setStation] = useState("");
  const [shift, setShift] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
  const [skillInput, setSkillInput] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [driverPathwayStatus, setDriverPathwayStatus] = useState("");
  const [lgvPassedDate, setLgvPassedDate] = useState("");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const client = useBackend();

  const { data: skillsData } = useQuery({
    queryKey: ["dictionaries", "skills"],
    queryFn: async () => {
      const result = await client.dictionary.list({ type: "skill" });
      return result.items;
    },
  });

  const availableSkills = skillsData?.map(s => s.value) || [];

  const createPersonMutation = useMutation({
    mutationFn: async () => {
      return await client.profile.createPerson({
        name,
        email,
        service_number: serviceNumber || undefined,
        rank: (rank && rank !== "_none") ? rank : undefined,
        watch_unit: (watch && watch !== "_none") ? watch : undefined,
        phone: phone || undefined,
      });
    },
    onSuccess: async (data) => {
      const hasAdditionalFields = skills.length > 0 || driverPathwayStatus || niNumber || station || shift || emergencyContactName || emergencyContactPhone;
      if (hasAdditionalFields) {
        try {
          const updateData: any = {};
          if (skills.length > 0) updateData.skills = skills;
          if (driverPathwayStatus) {
            updateData.driverPathway = {
              status: driverPathwayStatus,
              lgvPassedDate: lgvPassedDate || undefined,
            };
          }
          if (niNumber) {
            updateData.customFields = { niNumber };
          }
          if (station) updateData.station = station;
          if (shift) updateData.shift = shift;
          if (emergencyContactName) updateData.emergency_contact_name = emergencyContactName;
          if (emergencyContactPhone) updateData.emergency_contact_phone = emergencyContactPhone;

          if (data.profile?.id) {
            await client.profile.update({ id: data.profile.id, ...updateData });
          }
        } catch (error) {
          console.error("Failed to update profile with additional fields:", error);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["people"] });
      toast({
        title: "Person added",
        description: `${name} has been added successfully and the list has been refreshed.`,
      });
      handleClose();
    },
    onError: (error) => {
      console.error("Failed to create person:", error);
      toast({
        title: "Failed to add person",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    },
  });

  const handleClose = () => {
    setName("");
    setEmail("");
    setWatch("");
    setRank("");
    setServiceNumber("");
    setPhone("");
    setNiNumber("");
    setStation("");
    setShift("");
    setEmergencyContactName("");
    setEmergencyContactPhone("");
    setSkills([]);
    setSkillInput("");
    setDriverPathwayStatus("");
    setLgvPassedDate("");
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !email.trim() || !watch || watch === "_none" || !rank || rank === "_none" || !serviceNumber.trim()) {
      toast({
        title: "Missing required fields",
        description: "Name, Watch, Email, Rank, and Staff Number are required.",
        variant: "destructive",
      });
      return;
    }

    createPersonMutation.mutate();
  };

  const addSkill = (skill: string) => {
    const trimmed = skill.trim();
    if (trimmed && !skills.includes(trimmed)) {
      setSkills([...skills, trimmed]);
      setSkillInput("");
    }
  };

  const removeSkill = (skill: string) => {
    setSkills(skills.filter(s => s !== skill));
  };

  const handleSkillKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addSkill(skillInput);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Person</DialogTitle>
          <DialogDescription>
            Create a new person record. Fields marked with * are required.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Smith"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">
                Email <span className="text-red-500">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john.smith@fire.gov.uk"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="watch">
                Watch <span className="text-red-500">*</span>
              </Label>
              <Select value={watch} onValueChange={setWatch}>
                <SelectTrigger>
                  <SelectValue placeholder="Select watch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Select watch</SelectItem>
                  {WATCH_OPTIONS.map(w => (
                    <SelectItem key={w} value={w}>
                      <div className="flex items-center gap-2">
                        <WatchDot watch={w} />
                        {w}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rank">
                Rank <span className="text-red-500">*</span>
              </Label>
              <Select value={rank} onValueChange={setRank}>
                <SelectTrigger>
                  <SelectValue placeholder="Select rank" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Select rank</SelectItem>
                  {RANK_OPTIONS.map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="serviceNumber">
                Staff Number <span className="text-red-500">*</span>
              </Label>
              <Input
                id="serviceNumber"
                value={serviceNumber}
                onChange={(e) => setServiceNumber(e.target.value)}
                placeholder="FF-001234"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+44 7700 900123"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="niNumber">NI Number</Label>
              <Input
                id="niNumber"
                value={niNumber}
                onChange={(e) => setNiNumber(e.target.value)}
                placeholder="AB123456C"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="station">Station</Label>
              <Input
                id="station"
                value={station}
                onChange={(e) => setStation(e.target.value)}
                placeholder="e.g. Station 1"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="shift">Shift</Label>
              <Input
                id="shift"
                value={shift}
                onChange={(e) => setShift(e.target.value)}
                placeholder="e.g. Day / Night"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="emergencyContactName">Emergency Contact Name</Label>
              <Input
                id="emergencyContactName"
                value={emergencyContactName}
                onChange={(e) => setEmergencyContactName(e.target.value)}
                placeholder="Jane Smith"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="emergencyContactPhone">Emergency Contact Phone</Label>
              <Input
                id="emergencyContactPhone"
                type="tel"
                value={emergencyContactPhone}
                onChange={(e) => setEmergencyContactPhone(e.target.value)}
                placeholder="+44 7700 900456"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="driverPathway">Driver Pathway Status</Label>
              <Select value={driverPathwayStatus} onValueChange={setDriverPathwayStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value=" ">None</SelectItem>
                  {DRIVER_PATHWAY_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(driverPathwayStatus === "passed_LGV" || driverPathwayStatus === "awaiting_ERD" || driverPathwayStatus === "passed") && (
              <div className="space-y-2">
                <Label htmlFor="lgvPassedDate">LGV Passed Date</Label>
                <Input
                  id="lgvPassedDate"
                  type="date"
                  value={lgvPassedDate}
                  onChange={(e) => setLgvPassedDate(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="skills">Skills</Label>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    id="skills"
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={handleSkillKeyDown}
                    placeholder="Type a skill and press Enter"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => addSkill(skillInput)}
                  >
                    Add
                  </Button>
                </div>
                {availableSkills.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {availableSkills.slice(0, 10).map(skill => (
                      <Badge
                        key={skill}
                        variant="outline"
                        className="cursor-pointer hover:bg-muted"
                        onClick={() => addSkill(skill)}
                      >
                        {skill}
                      </Badge>
                    ))}
                  </div>
                )}
                {skills.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-2 border rounded-md">
                    {skills.map((skill, idx) => (
                      <Badge key={idx} className="flex items-center gap-1">
                        {skill}
                        <X
                          className="h-3 w-3 cursor-pointer"
                          onClick={() => removeSkill(skill)}
                        />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-red-600 hover:bg-red-700"
              disabled={createPersonMutation.isPending}
            >
              {createPersonMutation.isPending ? "Adding..." : "Add Person"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
