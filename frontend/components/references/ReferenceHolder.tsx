import { Link } from "react-router-dom";
import { BookMarked } from "lucide-react";
import { WatchDot } from "@/components/WatchBadge";
import { referenceHolders } from "@/lib/referenceRota";
import { useReferences } from "@/lib/references";
import { cn } from "@/lib/utils";

// "Ref 2 · Amber Watch" — who holds the station reference for this piece of
// work (hydrants, care homes, multi-storey, community safety…), shown where
// the work happens and linking to the reference's duties.

export function ReferenceHolder({ refNo, className }: { refNo: number; className?: string }) {
  const year = new Date().getFullYear();
  const { main, secondary } = referenceHolders(refNo, year);
  const { data } = useReferences();
  const title = data?.find((r) => r.ref === refNo)?.title;
  return (
    <Link
      to={`/references#ref-${refNo}`}
      title={`Reference ${refNo}${title ? ` — ${title}` : ""}. Main: ${main} Watch · secondary: ${secondary} Watch (covers it when ${main} Watch is off).`}
      className={cn("inline-flex items-center gap-1.5 rounded-md border border-border/70 px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground", className)}
    >
      <BookMarked className="h-3 w-3" />
      Ref {refNo}
      <span aria-hidden>·</span>
      <WatchDot watch={main} size="sm" /> {main} Watch
    </Link>
  );
}
