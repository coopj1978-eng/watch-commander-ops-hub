import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CalendarEvent } from "~backend/calendar/types";

interface CalendarViewProps {
  events: CalendarEvent[];
  currentDate: Date;
  onDateChange: (date: Date) => void;
  view: "day" | "week" | "month";
  onViewChange: (view: "day" | "week" | "month") => void;
}

export default function CalendarView({
  events,
  currentDate,
  onDateChange,
  view,
  onViewChange,
}: CalendarViewProps) {
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = (firstDay.getDay() + 6) % 7;

    const days: Date[] = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(new Date(year, month, -startingDayOfWeek + i + 1));
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const previousMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() - 1);
    onDateChange(newDate);
  };

  const nextMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + 1);
    onDateChange(newDate);
  };

  const days = getDaysInMonth(currentDate);
  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const getEventsForDay = (date: Date) => {
    return events.filter((event) => {
      const eventDate = new Date(event.start_time);
      return (
        eventDate.getDate() === date.getDate() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getFullYear() === date.getFullYear()
      );
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={previousMonth}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 
            className="text-xl font-semibold text-foreground min-w-[200px] text-center"
            aria-live="polite"
            aria-atomic="true"
          >
            {currentDate.toLocaleString("default", { month: "long", year: "numeric" })}
          </h2>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={nextMonth}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex gap-2" role="group" aria-label="Calendar view options">
          <Button
            variant={view === "day" ? "default" : "outline"}
            onClick={() => onViewChange("day")}
            size="sm"
            aria-pressed={view === "day"}
          >
            Day
          </Button>
          <Button
            variant={view === "week" ? "default" : "outline"}
            onClick={() => onViewChange("week")}
            size="sm"
            aria-pressed={view === "week"}
          >
            Week
          </Button>
          <Button
            variant={view === "month" ? "default" : "outline"}
            onClick={() => onViewChange("month")}
            size="sm"
            aria-pressed={view === "month"}
          >
            Month
          </Button>
        </div>
      </div>

      {view === "month" && (
        <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
          {weekDays.map((day) => (
            <div
              key={day}
              className="bg-card p-2 text-center text-sm font-medium text-muted-foreground"
            >
              {day}
            </div>
          ))}
          {days.map((day, index) => {
            const isCurrentMonth = day.getMonth() === currentDate.getMonth();
            const dayEvents = getEventsForDay(day);
            return (
              <div
                key={index}
                className={`bg-card p-2 min-h-[100px] ${
                  !isCurrentMonth ? "opacity-50" : ""
                }`}
              >
                <div className="text-sm font-medium text-foreground mb-1">
                  {day.getDate()}
                </div>
                <div className="space-y-1">
                  {dayEvents.slice(0, 2).map((event) => (
                    <div
                      key={event.id}
                      className="text-xs p-1 rounded bg-red-600/10 text-red-500 truncate"
                    >
                      {event.title}
                    </div>
                  ))}
                  {dayEvents.length > 2 && (
                    <div className="text-xs text-muted-foreground">
                      +{dayEvents.length - 2} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === "week" && (
        <div className="text-center text-muted-foreground py-12">
          Week view coming soon
        </div>
      )}

      {view === "day" && (
        <div className="text-center text-muted-foreground py-12">
          Day view coming soon
        </div>
      )}
    </div>
  );
}
