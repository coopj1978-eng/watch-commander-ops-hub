import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { MessageSquare } from "lucide-react";
import backend from "@/lib/backend";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Back to work interviews still to do for this WC/CC's watch — each name opens
// the person's profile, where the interview is recorded as done. Hidden when
// there are none.
export function BackToWorkDueCard() {
  const { data } = useQuery({
    queryKey: ["back-to-work", "due"],
    queryFn: () => backend.absence.listBackToWork({}),
    staleTime: 60_000,
  });
  const due = data?.interviews ?? [];
  if (due.length === 0) return null;

  return (
    <Card className="border-t-2 border-t-amber-500">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Back to work interviews</CardTitle>
        <MessageSquare className="h-4 w-4 text-amber-500" />
      </CardHeader>
      <CardContent>
        <ul className="space-y-1">
          {due.map((i) => (
            <li key={i.absence_id}>
              <Link to={`/people/${i.user_id}`} className="flex items-center justify-between gap-2 rounded-md px-1 py-0.5 text-sm hover:bg-muted/60 hover:text-primary transition-colors">
                <span className="truncate font-medium">{i.name ?? "Unknown"}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{i.shift_label}</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">Record each one on their profile when it's done.</p>
      </CardContent>
    </Card>
  );
}
