import { useState } from "react";
import { X, Plus, Calendar, Clock, MapPin, Users, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { CalendarEvent } from "~backend/calendar/types";
import type { Task } from "~backend/task/types";
import type { Inspection } from "~backend/inspection/types";
import EventForm from "./EventForm";

interface CalendarItem {
  id: number;
  title: string;
  date: Date;
  type: "event" | "task" | "inspection" | "training";
  color: string;
  data: CalendarEvent | Task | Inspection;
}

interface DayModalProps {
  date: Date;
  items: CalendarItem[];
  isOpen: boolean;
  onClose: () => void;
  onCreateEvent?: (data: any) => void;
  onUpdateEvent?: (id: number, data: any) => void;
  onDeleteEvent?: (id: number) => void;
}

export default function DayModal({
  date,
  items,
  isOpen,
  onClose,
  onCreateEvent,
  onUpdateEvent,
  onDeleteEvent,
}: DayModalProps) {
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingItem, setEditingItem] = useState<CalendarItem | null>(null);

  if (!isOpen) return null;

  const handleEdit = (item: CalendarItem) => {
    setEditingItem(item);
    setShowEventForm(true);
  };

  const handleCreate = () => {
    setEditingItem(null);
    setShowEventForm(true);
  };

  const handleFormClose = () => {
    setShowEventForm(false);
    setEditingItem(null);
  };

  const handleFormSubmit = (data: any) => {
    if (editingItem && onUpdateEvent) {
      onUpdateEvent(editingItem.id, data);
    } else if (onCreateEvent) {
      onCreateEvent(data);
    }
    handleFormClose();
  };

  const renderEventDetails = (item: CalendarItem) => {
    if (item.type === "event" || item.type === "training") {
      const event = item.data as CalendarEvent;
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>
              {new Date(event.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} -{" "}
              {new Date(event.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          {event.location && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{event.location}</span>
            </div>
          )}
          {event.attendees && event.attendees.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{event.attendees.length} attendees</span>
            </div>
          )}
          {event.description && (
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4 mt-0.5" />
              <span>{event.description}</span>
            </div>
          )}
        </div>
      );
    } else if (item.type === "task") {
      const task = item.data as Task;
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline">{task.category}</Badge>
            <Badge variant="outline">{task.status}</Badge>
            <Badge variant="outline">{task.priority}</Badge>
          </div>
          {task.description && (
            <p className="text-sm text-muted-foreground">{task.description}</p>
          )}
          {task.checklist && task.checklist.length > 0 && (
            <div className="text-sm text-muted-foreground">
              {task.checklist.filter((item) => item.done).length} / {task.checklist.length} items completed
            </div>
          )}
        </div>
      );
    } else if (item.type === "inspection") {
      const inspection = item.data as Inspection;
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline">{inspection.type}</Badge>
            <Badge variant="outline">{inspection.status}</Badge>
            <Badge variant="outline">{inspection.priority}</Badge>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span>{inspection.address}</span>
          </div>
          {inspection.notes && (
            <p className="text-sm text-muted-foreground">{inspection.notes}</p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-2xl font-bold text-foreground">
              {date.toLocaleDateString("default", { weekday: "long", month: "long", day: "numeric" })}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {items.length} {items.length === 1 ? "item" : "items"} scheduled
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCreate}
              className="bg-red-600 hover:bg-red-700 text-white border-red-600"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Event
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {showEventForm ? (
            <EventForm
              date={date}
              initialData={editingItem?.data as CalendarEvent}
              onSubmit={handleFormSubmit}
              onCancel={handleFormClose}
            />
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <div
                  key={`${item.type}-${item.id}`}
                  className="p-4 rounded-lg border border-border hover:border-red-600 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-3 h-3 rounded-full ${item.color} mt-1.5`} />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-foreground">{item.title}</h3>
                          <p className="text-sm text-muted-foreground capitalize">{item.type}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(item)}
                        >
                          Edit
                        </Button>
                      </div>
                      {renderEventDetails(item)}
                    </div>
                  </div>
                </div>
              ))}

              {items.length === 0 && (
                <div className="text-center py-12">
                  <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No items scheduled for this day</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={handleCreate}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Event
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
