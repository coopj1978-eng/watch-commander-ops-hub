import { ReactNode } from "react";

interface PageContainerProps {
  children: ReactNode;
  className?: string;
  title?: string;
}

export function PageContainer({ children, className = "", title }: PageContainerProps) {
  return (
    <main className={`ml-20 min-h-screen bg-gradient-to-br from-gray-50 via-indigo-50/30 to-purple-50/20 ${className}`}>
      <div className="p-8 space-y-6">
        {title && (
          <div>
            <h1 className="text-3xl font-bold text-foreground">{title}</h1>
          </div>
        )}
        {children}
      </div>
    </main>
  );
}

export default PageContainer;
