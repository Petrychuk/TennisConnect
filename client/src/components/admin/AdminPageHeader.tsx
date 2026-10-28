import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ADMIN_SECTIONS, type AdminSectionKey } from "@/lib/adminSections";
import { OrganiserBreadcrumb } from "@/components/organiser/ui/organiser-breadcrumb";

// Header of every Admin page in the Organiser Hub: the page is titled
// after the sidebar item the admin opened ("Articles", "Discovery", ...),
// with a one-line description and the page's actions.
//
// Responsive: phones stack title, description and full-width actions;
// from `sm` the actions sit on the right and wrap if they run out of room.
export function AdminPageHeader({ section, actions }: { section: AdminSectionKey; actions?: ReactNode }) {
  const { title, description } = ADMIN_SECTIONS[section];
  return (
    <>
    <OrganiserBreadcrumb current={title} testId="admin-page-breadcrumb" />
    <header className="mt-4 mb-6 md:mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between" data-testid="admin-page-header">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-2xl md:text-3xl font-display font-bold" data-testid="admin-page-title">
            {title}
          </h1>
          <Badge className="bg-primary text-foreground">
            <ShieldCheck className="w-3 h-3 mr-1" aria-hidden="true" /> Admin
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground max-w-2xl">{description}</p>
      </div>
      {actions && (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end sm:shrink-0 [&>*]:w-full sm:[&>*]:w-auto">
          {actions}
        </div>
      )}
    </header>
    </>
  );
}
