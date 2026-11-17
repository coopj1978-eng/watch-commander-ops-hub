import { NavLink, Navigate } from "react-router-dom";
import { LIBRARY_TABS, useNav } from "@/lib/navigation";

/**
 * The Library's tabs — Guides, Links, Documents — across the top of each of
 * the three pages. Only the ones this person may open are shown, and the row
 * goes away when there's just one.
 */
export default function LibraryTabs() {
  const { allowed } = useNav();
  const tabs = LIBRARY_TABS.filter(allowed);
  if (tabs.length < 2) return null;
  return (
    <nav aria-label="Library" className="-mx-1 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none]">
      <div className="inline-flex gap-1 rounded-xl bg-muted p-1">
        {tabs.map((t) => (
          <NavLink
            key={t.path}
            to={t.path}
            className={({ isActive }) =>
              `inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-lg px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 sm:min-h-9 ${
                isActive ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`
            }
          >
            <t.icon className="h-4 w-4" aria-hidden="true" />
            {t.name}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

/** "/library": the first tab this person may open. */
export function LibraryIndex() {
  const { allowed } = useNav();
  const first = LIBRARY_TABS.find(allowed);
  return <Navigate to={first?.path ?? "/"} replace />;
}
