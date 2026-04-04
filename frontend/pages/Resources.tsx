import { ExternalLink, BookOpen, FileText, Link as LinkIcon, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const NOTION_URL = "https://invincible-treatment-d06.notion.site/Processes-Files-a2ab8be387bc44c9859a7ac41d227606";

const QUICK_LINKS = [
  {
    title: "Processes & Files",
    description: "How-to guides, useful links and reference documents",
    url: NOTION_URL,
    icon: FileText,
    colour: "text-indigo-500",
    bg: "bg-indigo-50 dark:bg-indigo-950/30",
  },
  // Add more links here as needed, e.g.:
  // {
  //   title: "SFRS Intranet",
  //   description: "Scottish Fire & Rescue Service internal portal",
  //   url: "https://intranet.firescotland.gov.uk",
  //   icon: LinkIcon,
  //   colour: "text-blue-500",
  //   bg: "bg-blue-50 dark:bg-blue-950/30",
  // },
];

export default function Resources() {
  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <BookOpen className="h-7 w-7 text-indigo-500 shrink-0" />
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            Resources & Guides
          </h1>
          <p className="text-muted-foreground mt-1">
            Quick access to processes, reference documents and useful links
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {QUICK_LINKS.map((link) => {
          const Icon = link.icon;
          return (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group block"
            >
              <Card className="h-full border-t-2 border-t-indigo-500 transition-all hover:shadow-md hover:border-indigo-400/60 group-focus-visible:ring-2 group-focus-visible:ring-indigo-500">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className={`p-2.5 rounded-lg ${link.bg} shrink-0`}>
                      <Icon className={`h-5 w-5 ${link.colour}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {link.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {link.description}
                      </p>
                      <span className="inline-flex items-center gap-1 text-xs text-indigo-500 mt-3 font-medium group-hover:gap-1.5 transition-all">
                        Open <ExternalLink className="h-3 w-3" />
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </a>
          );
        })}
      </div>
    </div>
  );
}
