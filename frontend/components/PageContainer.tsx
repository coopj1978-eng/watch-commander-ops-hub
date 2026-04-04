import { ReactNode } from "react";

interface PageContainerProps {
  children: ReactNode;
  className?: string;
  title?: string;
  sidebarExpanded?: boolean;
}

export function PageContainer({ children, className = "", title, sidebarExpanded = false }: PageContainerProps) {
  return (
    <main className={`${sidebarExpanded ? "md:ml-56" : "md:ml-20"} print:ml-0 min-h-screen bg-gradient-to-br from-gray-50 via-indigo-50/30 to-purple-50/20 dark:from-slate-900 dark:via-slate-900/80 dark:to-indigo-950/20 transition-all duration-300 ease-in-out ${className}`}>
      <div className="p-4 md:p-8 pb-24 md:pb-8 space-y-6">
        {title && (
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">{title}</h1>
          </div>
        )}
        {children}
      </div>
    </main>
  );
}

export default PageContainer;
