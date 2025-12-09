import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [location] = useLocation();

  const navLinks = [
    { name: "Partners", href: "/#partners" },
    { name: "Coaches", href: "/#coaches" },
    { name: "Marketplace", href: "/#marketplace" },
    { name: "Reviews", href: "/#reviews" },
    { name: "Clubs", href: "/#clubs" },
  ];

  if (location === "/auth") return null;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/40">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/">
          <a className="text-2xl font-display font-bold flex items-center gap-1">
            Tennis<span className="text-primary">Connect</span>
            <div className="w-2 h-2 rounded-full bg-primary mt-1 animate-pulse" />
          </a>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              className="text-sm font-medium hover:text-primary transition-colors"
            >
              {link.name}
            </a>
          ))}
        </div>

        {/* CTA & Mobile Menu */}
        <div className="flex items-center gap-4">
          <Link href="/coach/profile">
            <Button variant="ghost" className="hidden md:inline-flex font-bold hover:text-primary">
              My Profile
            </Button>
          </Link>
          <Link href="/auth">
            <Button className="hidden md:inline-flex bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-full px-6">
              Sign In
            </Button>
          </Link>

          {/* Mobile Menu */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="w-6 h-6" />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <div className="flex flex-col gap-6 mt-8">
                {navLinks.map((link) => (
                  <a
                    key={link.name}
                    href={link.href}
                    className="text-lg font-medium hover:text-primary transition-colors"
                    onClick={() => setIsOpen(false)}
                  >
                    {link.name}
                  </a>
                ))}
                <Link href="/coach/profile" onClick={() => setIsOpen(false)}>
                  <Button variant="outline" className="w-full font-bold rounded-full">
                    My Profile
                  </Button>
                </Link>
                <Link href="/auth" onClick={() => setIsOpen(false)}>
                  <Button className="w-full bg-primary text-primary-foreground font-bold rounded-full">
                    Sign In
                  </Button>
                </Link>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
