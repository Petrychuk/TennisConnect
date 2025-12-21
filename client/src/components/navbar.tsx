import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Menu, LogOut, User } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [location] = useLocation();
  const { user, logout, isAuthenticated } = useAuth();

  const navLinks = [
    { name: "Partners", href: "/#partners" },
    { name: "Coaches", href: "/coaches" },
    { name: "Marketplace", href: "/marketplace" },
    { name: "Clubs", href: "/clubs" },
    { name: "Reviews", href: "/#reviews" },
  ];

  if (location === "/auth") return null;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/40">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/">
          <a className="text-2xl font-display font-bold flex items-center gap-1">
            Tennis<span className="text-[hsl(var(--tennis-ball))]">Connect</span>
            <div className="w-2 h-2 rounded-full bg-[hsl(var(--tennis-ball))] mt-1 animate-pulse" />
          </a>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              className="text-sm font-medium hover:text-lime-600 transition-colors"
            >
              {link.name}
            </a>
          ))}
        </div>

        {/* CTA & Mobile Menu */}
        <div className="flex items-center gap-4">
          {isAuthenticated ? (
            <div className="hidden md:flex items-center gap-4">
              <Link href={user?.role === "coach" ? "/coach/profile" : "/player/profile"}>
                <Button variant="ghost" className="font-bold hover:text-lime-600 gap-2">
                  <User className="w-4 h-4" />
                  {user?.name || "My Profile"}
                </Button>
              </Link>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Avatar className="h-9 w-9 cursor-pointer border-2 border-primary/20 hover:border-primary transition-colors">
                    <AvatarImage src={user?.avatar} />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold">
                      {user?.name?.[0] || "U"}
                    </AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href={user?.role === "coach" ? "/coach/profile" : "/player/profile"}>Profile</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem>Settings</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <Link href="/auth">
              <Button className="hidden md:inline-flex bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-full px-6">
                Sign In
              </Button>
            </Link>
          )}

          {/* Mobile Menu */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="w-6 h-6" />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <div className="flex flex-col gap-6 mt-8">
                {isAuthenticated && (
                   <div className="flex items-center gap-3 pb-6 border-b">
                     <Avatar className="h-10 w-10">
                        <AvatarImage src={user?.avatar} />
                        <AvatarFallback>{user?.name?.[0] || "U"}</AvatarFallback>
                     </Avatar>
                     <div>
                       <p className="font-bold">{user?.name}</p>
                       <p className="text-sm text-muted-foreground capitalize">{user?.role}</p>
                     </div>
                   </div>
                )}

                {navLinks.map((link) => (
                  <a
                    key={link.name}
                    href={link.href}
                    className="text-lg font-medium hover:text-lime-600 transition-colors"
                    onClick={() => setIsOpen(false)}
                  >
                    {link.name}
                  </a>
                ))}
                
                {isAuthenticated ? (
                  <>
                    <Link href={user?.role === "coach" ? "/coach/profile" : "/player/profile"} onClick={() => setIsOpen(false)}>
                      <Button variant="outline" className="w-full font-bold rounded-full">
                        My Profile
                      </Button>
                    </Link>
                    <Button 
                      variant="ghost" 
                      className="w-full justify-start text-destructive hover:text-destructive"
                      onClick={() => {
                        logout();
                        setIsOpen(false);
                      }}
                    >
                      <LogOut className="mr-2 h-4 w-4" /> Sign Out
                    </Button>
                  </>
                ) : (
                  <Link href="/auth" onClick={() => setIsOpen(false)}>
                    <Button className="w-full bg-primary text-primary-foreground font-bold rounded-full">
                      Sign In
                    </Button>
                  </Link>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
