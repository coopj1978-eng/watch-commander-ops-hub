import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CalendarEvent, EventType } from "~backend/calendar/types";

interface EventFormProps {
  date: Date;
  initialData?: CalendarEvent;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

export default function EventForm({
  date,
  initialData,
  onSubmit,
  onCancel,
}: EventFormProps) {
  const [formData, setFormData] = useState({
    title: initialData?.title || "",
    description: initialData?.description || "",
    event_type: (initialData?.event_type || "watch") as EventType,
    start_time: initialData?.start_time
      ? new Date(initialData.start_time).toISOString().slice(0, 16)
      : new Date(date.setHours(9, 0)).toISOString().slice(0, 16),
    end_time: initialData?.end_time
      ? new Date(initialData.end_time).toISOString().slice(0, 16)
      : new Date(date.setHours(10, 0)).toISOString().slice(0, 16),
    all_day: initialData?.all_day || false,
    location: initialData?.location || "",
    is_watch_event: initialData?.is_watch_event ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      start_time: new Date(formData.start_time),
      end_time: new Date(formData.end_time),
    });
  };

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => handleChange("title", e.target.value)}
          placeholder="Event title"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="event_type">Event Type *</Label>
        <Select
          value={formData.event_type}
          onValueChange={(value) => handleChange("event_type", value as EventType)}
        >
          <SelectTrigger id="event_type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="watch">Watch</SelectItem>
            <SelectItem value="personal">Personal</SelectItem>
            <SelectItem value="training">Training</SelectItem>
            <SelectItem value="meeting">Meeting</SelectItem>
            <SelectItem value="inspection">Inspection</SelectItem>
            <SelectItem value="maintenance">Maintenance</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="start_time">Start Time *</Label>
          <Input
            id="start_time"
            type="datetime-local"
            value={formData.start_time}
            onChange={(e) => handleChange("start_time", e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="end_time">End Time *</Label>
          <Input
            id="end_time"
            type="datetime-local"
            value={formData.end_time}
            onChange={(e) => handleChange("end_time", e.target.value)}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="location">Location</Label>
        <Input
          id="location"
          value={formData.location}
          onChange={(e) => handleChange("location", e.target.value)}
          placeholder="Event location"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => handleChange("description", e.target.value)}
          placeholder="Event description"
          rows={3}
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="all_day"
          checked={formData.all_day}
          onChange={(e) => handleChange("all_day", e.target.checked)}
          className="rounded border-border"
        />
        <Label htmlFor="all_day" className="cursor-pointer">
          All day event
        </Label>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="is_watch_event"
          checked={formData.is_watch_event}
          onChange={(e) => handleChange("is_watch_event", e.target.checked)}
          className="rounded border-border"
        />
        <Label htmlFor="is_watch_event" className="cursor-pointer">
          Watch event (visible to all)
        </Label>
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="submit" className="flex-1 bg-red-600 hover:bg-red-700">
          {initialData ? "Update Event" : "Create Event"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
      </div>
    </form>
  );
}
