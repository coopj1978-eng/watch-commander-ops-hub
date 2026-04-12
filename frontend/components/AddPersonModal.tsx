import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { STATION_OPTIONS } from "@/lib/constants";

interface AddPersonModalProps {
  isOpen: boolean;
  onClose: () => void;
}

import { WatchDot } from "./WatchBadge";

const WATCH_OPTIONS = ["Green", "Red", "White", "Blue", "Amber"];
const RANK_OPTIONS = [
  { value: "Watch Commander", label: "Watch Commander" },
  { value: "Crew Commander", label: "Crew Commander" },
  { value: "Leading Firefighter", label: "Leading Firefighter" },
  { value: "Firefighter", label: "Firefighter" },
];

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
  const [station, setStation] = useState("B10 Springburn");
  const [serviceNumber, setServiceNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [niNumber, setNiNumber] = useState("");
  const [driverPathwayStatus, setDriverPathwayStatus] = useState("");
  const [lgvPassedDate, setLgvPassedDate] = useState("");

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const client = useBackend();

  const createPersonMutation = useMutation({
    mutationFn: async () => {
      return await client.profile.createPerson({
        name,
        email,
        service_number: serviceNumber || undefined,
        rank: (rank && rank !== "_none") ? rank : undefined,
        watch_unit: (watch && watch !== "_none") ? watch : undefined,
        phone: phone || undefined,
        station: station || undefined,
      });
    },
    onSuccess: async (data) => {
      if (driverPathwayStatus || niNumber) {
        try {
          const updateData: any = {};
          if (driverPathwayStatus) {
            updateData.driverPathway = {
              status: driverPathwayStatus,
              lgvPassedDate: lgvPassedDate || undefined,
            };
          }
          if (niNumber) {
            updateData.customFields = { niNumber };
          }

          if (data.profile?.id) {
            await client.profile.update(data.profile.id, updateData);
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
    setStation("B10 Springburn");
    setServiceNumber("");
    setPhone("");
    setNiNumber("");
    setDriverPathwayStatus("");
    setLgvPassedDate("");
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !email.trim() || !rank || rank === "_none" || !serviceNumber.trim()) {
      toast({
        title: "Missing required fields",
        description: "Name, Email, Rank, and Staff Number are required.",
        variant: "destructive",
      });
      return;
    }

    createPersonMutation.mutate();
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
              <Label htmlFor="watch">Watch</Label>
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
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
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
              <Label htmlFor="station">Station or Area</Label>
              <Select value={station} onValueChange={setStation}>
                <SelectTrigger>
                  <SelectValue placeholder="Select station or area" />
                </SelectTrigger>
                <SelectContent>
                  {STATION_OPTIONS.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

          </div>

          <p className="text-xs text-muted-foreground">
            Skills & certifications can be added with full renewal tracking from the person's profile after creation.
          </p>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700"
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
