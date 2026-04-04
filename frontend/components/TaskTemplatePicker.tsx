import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, Building2, Droplet, Users, Zap, CheckCircle2 } from "lucide-react";
import type { TaskCategory, TaskPriority, ChecklistItem } from "~backend/task/types";

interface TaskTemplate {
  id: string;
  name: string;
  description: string;
  category: TaskCategory;
  priority: TaskPriority;
  icon: typeof Building2;
  checklist: Omit<ChecklistItem, "done">[];
  estimatedDays: number;
  rrule?: string;
}

const TEMPLATES: TaskTemplate[] = [
  {
    id: "multi-storey-drill",
    name: "Multi-Storey Drill",
    description: "Complete training drill for high-rise building procedures",
    category: "Training",
    priority: "High",
    icon: Building2,
    estimatedDays: 7,
    checklist: [
      { label: "Pre-drill briefing with crew" },
      { label: "Equipment check (BA sets, lines, tools)" },
      { label: "Stairwell access and fire floor setup" },
      { label: "Internal stairwell attack practice" },
      { label: "Rescue scenario simulation" },
      { label: "Debrief and feedback session" },
      { label: "Record drill results in logbook" },
    ],
  },
  {
    id: "hydrant-route",
    name: "Hydrant Route Check",
    description: "Inspect and test all hydrants on assigned route",
    category: "Inspection",
    priority: "Med",
    icon: Droplet,
    estimatedDays: 3,
    rrule: "FREQ=MONTHLY;INTERVAL=1",
    checklist: [
      { label: "Review route map and hydrant locations" },
      { label: "Check hydrant accessibility (no obstructions)" },
      { label: "Test water flow and pressure" },
      { label: "Inspect caps, outlets, and threads" },
      { label: "Document any defects or maintenance needs" },
      { label: "Update hydrant database with findings" },
      { label: "Report critical issues to water dept" },
    ],
  },
  {
    id: "hfsv-blitz",
    name: "HFSV Blitz Week",
    description: "Concentrated Home Fire Safety Visit campaign",
    category: "HFSV",
    priority: "High",
    icon: Users,
    estimatedDays: 5,
    checklist: [
      { label: "Identify target area and book appointments" },
      { label: "Prepare HFSV kits (smoke alarms, leaflets)" },
      { label: "Conduct day 1 visits (target: 8-10 homes)" },
      { label: "Conduct day 2 visits" },
      { label: "Conduct day 3 visits" },
      { label: "Conduct day 4 visits" },
      { label: "Conduct day 5 visits" },
      { label: "Complete all HFSV forms and database entries" },
      { label: "Arrange follow-ups for vulnerable occupants" },
      { label: "Submit weekly HFSV report to SM" },
    ],
  },
];

interface TaskTemplatePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: TaskTemplate) => void;
}

export default function TaskTemplatePicker({
  isOpen,
  onClose,
  onSelectTemplate,
}: TaskTemplatePickerProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate | null>(null);

  if (!isOpen) return null;

  const handleSelect = (template: TaskTemplate) => {
    setSelectedTemplate(template);
  };

  const handleConfirm = () => {
    if (selectedTemplate) {
      onSelectTemplate(selectedTemplate);
      setSelectedTemplate(null);
      onClose();
    }
  };

  const getPriorityColor = (priority: TaskPriority) => {
    const colors: Record<TaskPriority, string> = {
      High: "bg-red-500/10 text-red-500 border-red-500/20",
      Med: "bg-orange-500/10 text-orange-500 border-orange-500/20",
      Low: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    };
    return colors[priority];
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Task Templates</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Quick-create common tasks with pre-filled checklists
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid gap-4 md:grid-cols-3">
            {TEMPLATES.map((template) => {
              const Icon = template.icon;
              const isSelected = selectedTemplate?.id === template.id;

              return (
                <Card
                  key={template.id}
                  className={`cursor-pointer transition-all hover:border-indigo-600 ${
                    isSelected ? "ring-2 ring-indigo-500 border-indigo-500" : ""
                  }`}
                  onClick={() => handleSelect(template)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between mb-2">
                      <Icon className="h-8 w-8 text-red-500" />
                      {template.rrule && (
                        <Badge variant="outline" className="text-xs">
                          <Zap className="h-3 w-3 mr-1" />
                          Repeating
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    <CardDescription>{template.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {template.category}
                      </Badge>
                      <Badge className={getPriorityColor(template.priority)} variant="outline">
                        {template.priority}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      📋 {template.checklist.length} checklist items
                    </div>
                    <div className="text-xs text-muted-foreground">
                      ⏱️ Est. {template.estimatedDays} days
                    </div>
                    {isSelected && (
                      <div className="pt-2 border-t border-border">
                        <p className="text-xs font-medium text-foreground mb-2">Checklist Preview:</p>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {template.checklist.slice(0, 5).map((item, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-xs text-muted-foreground">
                              <CheckCircle2 className="h-3 w-3 mt-0.5 flex-shrink-0" />
                              <span className="line-clamp-1">{item.label}</span>
                            </div>
                          ))}
                          {template.checklist.length > 5 && (
                            <p className="text-xs text-muted-foreground italic">
                              +{template.checklist.length - 5} more...
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between p-6 border-t border-border">
          <p className="text-sm text-muted-foreground">
            {selectedTemplate ? (
              <>
                Selected: <span className="font-medium text-foreground">{selectedTemplate.name}</span>
              </>
            ) : (
              "Select a template to continue"
            )}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700"
              disabled={!selectedTemplate}
              onClick={handleConfirm}
            >
              Use Template
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
