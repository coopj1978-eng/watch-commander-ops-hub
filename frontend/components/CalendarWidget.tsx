import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Download, Calendar as CalendarIcon } from "lucide-react";
import type { CalendarEvent } from "~backend/calendar/types";
import type { Task } from "~backend/task/types";
import type { Inspection } from "~backend/inspection/types";

type CalendarViewType = "day" | "week" | "month" | "3month" | "year" | "custom";

interface CalendarItem {
  id: number;
  title: string;
  date: Date;
  type: "event" | "task" | "inspection" | "training";
  color: string;
  data: CalendarEvent | Task | Inspection;
}

interface CalendarWidgetProps {
  events?: CalendarEvent[];
  tasks?: Task[];
  inspections?: Inspection[];
  currentDate: Date;
  onDateChange: (date: Date) => void;
  view: CalendarViewType;
  onViewChange: (view: CalendarViewType) => void;
  onDayClick?: (date: Date, items: CalendarItem[]) => void;
  onExport?: () => void;
}

export default function CalendarWidget({
  events = [],
  tasks = [],
  inspections = [],
  currentDate,
  onDateChange,
  view,
  onViewChange,
  onDayClick,
  onExport,
}: CalendarWidgetProps) {
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [showCustomDialog, setShowCustomDialog] = useState(false);

  const getItemColor = (type: string): string => {
    const colors: Record<string, string> = {
      task: "bg-blue-500",
      inspection: "bg-orange-500",
      training: "bg-green-500",
      event: "bg-purple-500",
    };
    return colors[type] || "bg-red-500";
  };

  const getAllItems = (): CalendarItem[] => {
    const items: CalendarItem[] = [];

    events.forEach((event) => {
      const type = event.event_type === "training" ? "training" : "event";
      items.push({
        id: event.id,
        title: event.title,
        date: new Date(event.start_time),
        type,
        color: getItemColor(type),
        data: event,
      });
    });

    tasks.forEach((task) => {
      if (task.due_at) {
        items.push({
          id: task.id,
          title: task.title,
          date: new Date(task.due_at),
          type: "task",
          color: getItemColor("task"),
          data: task,
        });
      }
    });

    inspections.forEach((inspection) => {
      items.push({
        id: inspection.id,
        title: `${inspection.type} - ${inspection.address}`,
        date: new Date(inspection.scheduled_for),
        type: "inspection",
        color: getItemColor("inspection"),
        data: inspection,
      });
    });

    return items;
  };

  const allItems = getAllItems();

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: Date[] = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(new Date(year, month, -startingDayOfWeek + i + 1));
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const getWeekDays = (date: Date) => {
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay());
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      days.push(new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() + i));
    }
    return days;
  };

  const get3MonthDays = (date: Date) => {
    const months: Date[][] = [];
    for (let i = 0; i < 3; i++) {
      const monthDate = new Date(date.getFullYear(), date.getMonth() + i, 1);
      months.push(getDaysInMonth(monthDate));
    }
    return months;
  };

  const getYearMonths = (date: Date) => {
    const months: Date[] = [];
    for (let i = 0; i < 12; i++) {
      months.push(new Date(date.getFullYear(), i, 1));
    }
    return months;
  };

  const getItemsForDay = (date: Date): CalendarItem[] => {
    return allItems.filter((item) => {
      const itemDate = item.date;
      return (
        itemDate.getDate() === date.getDate() &&
        itemDate.getMonth() === date.getMonth() &&
        itemDate.getFullYear() === date.getFullYear()
      );
    });
  };

  const getItemsForMonth = (month: number, year: number): CalendarItem[] => {
    return allItems.filter((item) => {
      return item.date.getMonth() === month && item.date.getFullYear() === year;
    });
  };

  const previousPeriod = () => {
    const newDate = new Date(currentDate);
    if (view === "day") {
      newDate.setDate(newDate.getDate() - 1);
    } else if (view === "week") {
      newDate.setDate(newDate.getDate() - 7);
    } else if (view === "month") {
      newDate.setMonth(newDate.getMonth() - 1);
    } else if (view === "3month") {
      newDate.setMonth(newDate.getMonth() - 3);
    } else if (view === "year") {
      newDate.setFullYear(newDate.getFullYear() - 1);
    }
    onDateChange(newDate);
  };

  const nextPeriod = () => {
    const newDate = new Date(currentDate);
    if (view === "day") {
      newDate.setDate(newDate.getDate() + 1);
    } else if (view === "week") {
      newDate.setDate(newDate.getDate() + 7);
    } else if (view === "month") {
      newDate.setMonth(newDate.getMonth() + 1);
    } else if (view === "3month") {
      newDate.setMonth(newDate.getMonth() + 3);
    } else if (view === "year") {
      newDate.setFullYear(newDate.getFullYear() + 1);
    }
    onDateChange(newDate);
  };

  const getHeaderText = () => {
    if (view === "day") {
      return currentDate.toLocaleDateString("default", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    } else if (view === "week") {
      const weekDays = getWeekDays(currentDate);
      return `${weekDays[0].toLocaleDateString("default", { month: "short", day: "numeric" })} - ${weekDays[6].toLocaleDateString("default", { month: "short", day: "numeric", year: "numeric" })}`;
    } else if (view === "month") {
      return currentDate.toLocaleString("default", { month: "long", year: "numeric" });
    } else if (view === "3month") {
      return `${currentDate.toLocaleString("default", { month: "long" })} - ${new Date(currentDate.getFullYear(), currentDate.getMonth() + 2, 1).toLocaleString("default", { month: "long", year: "numeric" })}`;
    } else if (view === "year") {
      return currentDate.getFullYear().toString();
    } else if (view === "custom") {
      if (customStartDate && customEndDate) {
        return `${new Date(customStartDate).toLocaleDateString("default", { month: "short", day: "numeric" })} - ${new Date(customEndDate).toLocaleDateString("default", { month: "short", day: "numeric", year: "numeric" })}`;
      }
      return "Custom Range";
    }
    return "";
  };

  const handleCustomRangeSubmit = () => {
    if (customStartDate && customEndDate) {
      onViewChange("custom");
      setShowCustomDialog(false);
    }
  };

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const handleDayClick = (date: Date) => {
    const items = getItemsForDay(date);
    if (onDayClick) {
      onDayClick(date, items);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={previousPeriod}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-xl font-semibold text-foreground min-w-[280px] text-center">
            {getHeaderText()}
          </h2>
          <Button variant="outline" size="icon" onClick={nextPeriod}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex gap-2">
          <Button
            variant={view === "day" ? "default" : "outline"}
            onClick={() => onViewChange("day")}
            size="sm"
          >
            Day
          </Button>
          <Button
            variant={view === "week" ? "default" : "outline"}
            onClick={() => onViewChange("week")}
            size="sm"
          >
            Week
          </Button>
          <Button
            variant={view === "month" ? "default" : "outline"}
            onClick={() => onViewChange("month")}
            size="sm"
          >
            Month
          </Button>
          <Button
            variant={view === "3month" ? "default" : "outline"}
            onClick={() => onViewChange("3month")}
            size="sm"
          >
            3-Month
          </Button>
          <Button
            variant={view === "year" ? "default" : "outline"}
            onClick={() => onViewChange("year")}
            size="sm"
          >
            Year
          </Button>
          <Dialog open={showCustomDialog} onOpenChange={setShowCustomDialog}>
            <DialogTrigger asChild>
              <Button
                variant={view === "custom" ? "default" : "outline"}
                size="sm"
              >
                <CalendarIcon className="h-4 w-4 mr-2" />
                Custom
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Select Custom Date Range</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="start-date">Start Date</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-date">End Date</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                  />
                </div>
                <Button
                  className="w-full bg-red-600 hover:bg-red-700"
                  onClick={handleCustomRangeSubmit}
                  disabled={!customStartDate || !customEndDate}
                >
                  Apply Range
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          {onExport && (
            <Button variant="outline" size="sm" onClick={onExport}>
              <Download className="h-4 w-4 mr-2" />
              Export .ics
            </Button>
          )}
        </div>
      </div>

      {view === "day" && (
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground mb-4">
            {getItemsForDay(currentDate).length} items scheduled
          </div>
          <div className="space-y-2">
            {getItemsForDay(currentDate).map((item) => (
              <div
                key={`${item.type}-${item.id}`}
                className="p-3 rounded-lg border border-border hover:border-red-600 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-3 h-3 rounded-full ${item.color} mt-1`} />
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{item.title}</p>
                    <p className="text-sm text-muted-foreground capitalize">{item.type}</p>
                  </div>
                </div>
              </div>
            ))}
            {getItemsForDay(currentDate).length === 0 && (
              <p className="text-center text-muted-foreground py-8">No items scheduled</p>
            )}
          </div>
        </div>
      )}

      {view === "week" && (
        <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
          {getWeekDays(currentDate).map((day, index) => {
            const dayItems = getItemsForDay(day);
            const isToday = day.toDateString() === new Date().toDateString();
            return (
              <div key={index} className="bg-card">
                <div className={`p-2 text-center border-b border-border ${isToday ? "bg-red-600/10" : ""}`}>
                  <div className="text-xs text-muted-foreground">{weekDays[day.getDay()]}</div>
                  <div className={`text-sm font-medium ${isToday ? "text-red-500" : "text-foreground"}`}>
                    {day.getDate()}
                  </div>
                </div>
                <div className="p-2 min-h-[200px] space-y-1">
                  {dayItems.map((item) => (
                    <div
                      key={`${item.type}-${item.id}`}
                      className={`text-xs p-1 rounded ${item.color}/10 border border-current cursor-pointer hover:opacity-80`}
                      style={{ color: item.color.replace("bg-", "") }}
                      onClick={() => handleDayClick(day)}
                    >
                      <div className="truncate">{item.title}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

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
          {getDaysInMonth(currentDate).map((day, index) => {
            const isCurrentMonth = day.getMonth() === currentDate.getMonth();
            const dayItems = getItemsForDay(day);
            const isToday = day.toDateString() === new Date().toDateString();
            return (
              <div
                key={index}
                className={`bg-card p-2 min-h-[100px] cursor-pointer hover:bg-muted/50 transition-colors ${
                  !isCurrentMonth ? "opacity-50" : ""
                } ${isToday ? "ring-2 ring-red-500" : ""}`}
                onClick={() => handleDayClick(day)}
              >
                <div className={`text-sm font-medium mb-2 ${isToday ? "text-red-500" : "text-foreground"}`}>
                  {day.getDate()}
                </div>
                <div className="flex flex-wrap gap-1">
                  {dayItems.slice(0, 3).map((item) => (
                    <div
                      key={`${item.type}-${item.id}`}
                      className={`w-2 h-2 rounded-full ${item.color}`}
                      title={item.title}
                    />
                  ))}
                  {dayItems.length > 3 && (
                    <div className="text-xs text-muted-foreground">
                      +{dayItems.length - 3}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === "3month" && (
        <div className="grid grid-cols-3 gap-4">
          {get3MonthDays(currentDate).map((monthDays, monthIndex) => {
            const monthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + monthIndex, 1);
            const monthItems = getItemsForMonth(monthDate.getMonth(), monthDate.getFullYear());
            return (
              <div key={monthIndex} className="space-y-2">
                <h3 className="text-lg font-semibold text-foreground text-center">
                  {monthDate.toLocaleString("default", { month: "long" })}
                </h3>
                <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden text-xs">
                  {weekDays.map((day) => (
                    <div
                      key={day}
                      className="bg-card p-1 text-center text-xs text-muted-foreground"
                    >
                      {day.slice(0, 1)}
                    </div>
                  ))}
                  {monthDays.map((day, dayIndex) => {
                    const isCurrentMonth = day.getMonth() === monthDate.getMonth();
                    const dayItems = getItemsForDay(day);
                    return (
                      <div
                        key={dayIndex}
                        className={`bg-card p-1 min-h-[40px] cursor-pointer hover:bg-muted/50 ${
                          !isCurrentMonth ? "opacity-30" : ""
                        }`}
                        onClick={() => handleDayClick(day)}
                      >
                        <div className="text-foreground text-center">{day.getDate()}</div>
                        {dayItems.length > 0 && (
                          <div className="flex justify-center mt-1">
                            <div className="w-1 h-1 rounded-full bg-red-500" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="text-xs text-muted-foreground text-center">
                  {monthItems.length} items
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === "year" && (
        <div className="grid grid-cols-4 gap-4">
          {getYearMonths(currentDate).map((month, monthIndex) => {
            const monthItems = getItemsForMonth(monthIndex, currentDate.getFullYear());
            return (
              <div
                key={monthIndex}
                className="p-4 rounded-lg border border-border hover:border-red-600 transition-colors cursor-pointer"
                onClick={() => {
                  const newDate = new Date(currentDate);
                  newDate.setMonth(monthIndex);
                  onDateChange(newDate);
                  onViewChange("month");
                }}
              >
                <h3 className="text-base font-semibold text-foreground mb-2">
                  {month.toLocaleString("default", { month: "long" })}
                </h3>
                <div className="text-sm text-muted-foreground">
                  {monthItems.length} items
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {monthItems.slice(0, 5).map((item, idx) => (
                    <div
                      key={idx}
                      className={`w-2 h-2 rounded-full ${item.color}`}
                      title={item.title}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === "custom" && customStartDate && customEndDate && (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Showing {allItems.filter((item) => {
              const itemDate = item.date;
              return itemDate >= new Date(customStartDate) && itemDate <= new Date(customEndDate);
            }).length} items in custom range
          </div>
          <div className="space-y-2">
            {allItems
              .filter((item) => {
                const itemDate = item.date;
                return itemDate >= new Date(customStartDate) && itemDate <= new Date(customEndDate);
              })
              .sort((a, b) => a.date.getTime() - b.date.getTime())
              .map((item) => (
                <div
                  key={`${item.type}-${item.id}`}
                  className="p-3 rounded-lg border border-border hover:border-red-600 transition-colors cursor-pointer"
                  onClick={() => handleDayClick(item.date)}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-3 h-3 rounded-full ${item.color} mt-1`} />
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-foreground">{item.title}</p>
                          <p className="text-sm text-muted-foreground capitalize">{item.type}</p>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {item.date.toLocaleDateString("default", { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            {allItems.filter((item) => {
              const itemDate = item.date;
              return itemDate >= new Date(customStartDate) && itemDate <= new Date(customEndDate);
            }).length === 0 && (
              <p className="text-center text-muted-foreground py-8">No items in this date range</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
