#!/usr/bin/env node
// Organiser Hub, phone. Run after apply-hub-mobile.mjs. Idempotent, --check supported.
//  1. "More" in the bottom menu was a dead placeholder. It now opens the full hub menu
//     (same panel as the tablet menu button) and closes after you pick a page.
//  2. Dashboard stat cards on phones are all the same height (before: a card whose label
//     wrapped to 2 lines was taller than its neighbours).
import fs from "node:fs";
import path from "node:path";
const CHECK = process.argv.includes("--check");
const P = (...a) => path.join(process.cwd(), ...a);
const files = new Map();
function load(p) {
  if (!files.has(p)) { const raw = fs.readFileSync(p, "utf8"); files.set(p, { crlf: raw.includes("\r\n"), text: raw.replace(/\r\n/g, "\n") }); }
  return files.get(p);
}
const fail = (m) => { console.error("ERROR: " + m + "\nNothing was changed."); process.exit(1); };
const plan = [];
function swap(file, o, n, label, done) {
  const f = load(P(...file));
  if (f.text.includes(done)) { plan.push(label + ": already applied"); return; }
  if (f.text.split(o).length !== 2) fail(`${file.at(-1)}: "${label}" anchor not found exactly once`);
  f.text = f.text.replace(o, () => n); plan.push(label + ": done");
}
const NAV = ["client","src","components","organiser","ui","organiser-mobile-nav.tsx"];
swap(NAV, `import { cn } from "@/lib/utils";\n`,
`import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth-context";
import { mockOrganiser } from "@/lib/organiser-hub-mock-data";
import { OrganiserSidebarNav } from "@/components/organiser/ui/organiser-sidebar";
`, "more: imports", "OrganiserSidebarNav");
swap(NAV, `  const [location] = useLocation();\n`,
`  const [location] = useLocation();
  const { user } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  // Close the menu once a page has been picked.
  useEffect(() => { setMoreOpen(false); }, [location]);
  const profileHref = user ? \`/\${user.role}/\${user.slug}\` : "/";
  const organiser = user ? { ...mockOrganiser, name: user.name, avatar: user.avatar ?? null, isAdmin: user.isAdmin ?? false } : mockOrganiser;
`, "more: state", "const [moreOpen");
swap(NAV, `isActive ? "text-primary" : item.href ? "text-muted-foreground" : "text-muted-foreground opacity-60"`,
`isActive || (item.key === "more" && moreOpen) ? "text-primary" : "text-muted-foreground"`, "more: colours", `item.key === "more" && moreOpen`);
swap(NAV, `          <div key={item.key} className={sharedClasses} data-testid={\`organiser-mobile-nav-\${item.key}\`} title="Coming soon">
            {content}
          </div>`,
`          <button
            key={item.key}
            type="button"
            onClick={() => setMoreOpen(true)}
            className={sharedClasses}
            data-testid={\`organiser-mobile-nav-\${item.key}\`}
            aria-label="Open full menu"
          >
            {content}
          </button>`, "more: button", `onClick={() => setMoreOpen(true)}`);
swap(NAV, `  return (\n    <nav\n`, `  return (\n    <>\n    <nav\n`, "more: fragment open", `    <>\n    <nav\n`);
swap(NAV, `    </nav>\n  );\n}`,
`    </nav>
    <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
      <SheetContent side="left" className="p-0 w-72">
        <SheetTitle className="sr-only">Organiser Hub navigation</SheetTitle>
        <OrganiserSidebarNav organiser={organiser} profileHref={profileHref} />
      </SheetContent>
    </Sheet>
    </>
  );
}`, "more: sheet", `<Sheet open={moreOpen}`);

const HERO = ["client","src","components","organiser","dashboard","dashboard-hero.tsx"];
swap(HERO, `<Link href={stat.href} data-testid={\`organiser-stat-strip-\${stat.key}\`}>
        <Card className="shadow-sm hover:shadow-md hover:border-primary/40 transition-all cursor-pointer">`,
`<Link href={stat.href} className="block h-full" data-testid={\`organiser-stat-strip-\${stat.key}\`}>
        <Card className="h-full shadow-sm hover:shadow-md hover:border-primary/40 transition-all cursor-pointer">`, "stat cards equal height (link)", `className="block h-full"`);
swap(HERO, `<Card className="shadow-sm hover:shadow-md transition-shadow" data-testid={\`organiser-stat-strip-\${stat.key}\`}>`,
`<Card className="h-full shadow-sm hover:shadow-md transition-shadow" data-testid={\`organiser-stat-strip-\${stat.key}\`}>`, "stat cards equal height (plain)", `<Card className="h-full shadow-sm hover:shadow-md transition-shadow"`);
console.log(plan.join("\n"));
if (CHECK) { console.log("(--check: nothing written)"); process.exit(0); }
for (const [p, f] of files) fs.writeFileSync(p, f.crlf ? f.text.replace(/\n/g, "\r\n") : f.text);
console.log("Applied.");
