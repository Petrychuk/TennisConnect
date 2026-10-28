import { ChevronRight } from "lucide-react";
import { Link } from "wouter";

/*
  "Home > <page>" at the top of every Organiser Hub and Admin page, so
  there is always one click back to the dashboard (/organiser). Same
  markup the Players and Messages pages already used.
*/
export function OrganiserBreadcrumb({ current, testId }: { current: string; testId?: string }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm" data-testid={testId}>
      <Link href="/organiser" className="text-primary-text hover:underline">
        Home
      </Link>
      <ChevronRight aria-hidden="true" className="w-3.5 h-3.5 text-muted-foreground" />
      <span aria-current="page" className="text-muted-foreground">
        {current}
      </span>
    </nav>
  );
}
