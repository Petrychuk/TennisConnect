import { useState } from "react";
import { Link } from "wouter";
import {
  Facebook,
  Instagram,
  Mail,
  MapPin,
  Building2
} from "lucide-react";
import { TikTokIcon } from "@/components/icons/TikTokIcon";
//import { ThreadsIcon } from "@/components/icons/ThreadsIcon";
import { openCookieSettings } from "@/lib/cookieConsent";
import { useToast } from "@/hooks/use-toast";

export function Footer() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleNewsletterSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Couldn't subscribe",
          description: data.message || "Please check your email and try again.",
        });
        return;
      }

      toast({ title: data.message || "Thanks for subscribing!" });
      setEmail("");
    } catch {
      toast({
        variant: "destructive",
        title: "Couldn't subscribe",
        description: "Something went wrong. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <footer className="bg-black text-white border-t border-white/10">
      <div className="container mx-auto px-4 py-16">

        {/* Main Footer */}
        <div className="grid grid-cols-2 lg:grid-cols-5 md:portrait:grid-cols-4 gap-10 mb-12">

          {/* Brand */}
          <div className="col-span-2 lg:col-span-1 md:portrait:col-span-1 space-y-5">
           <div>
           <div className="flex flex-col items-center text-center gap-3">
              <h3 className="text-2xl font-display font-bold flex items-center gap-1">
                Tennis
                <span className="text-[hsl(var(--tennis-ball))]">
                  Connect
                </span>
                <div className="w-2 h-2 rounded-full bg-[hsl(var(--tennis-ball))] mt-1 animate-pulse" />
              </h3>

              <a
                href="https://sensepowerdigital.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                <img
                  src="/assets/images/sensepower_logo.webp"
                  alt="SensePower Digital"
                  className="h-10 w-10 rounded-xl object-cover hover:opacity-90 transition-opacity"
                />
              </a>

              <p className="text-[hsl(var(--tennis-ball))] text-sm font-medium">
                Powered by SensePower Digital
              </p>
            </div>
           </div>

            <p className="text-gray-400 text-sm leading-relaxed">
              Find tennis partners, coaches, clubs, tournaments and tennis
              services across Australia.
            </p>

            <div className="space-y-2 text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[hsl(var(--tennis-ball))]" />
                <span>Sydney, NSW, Australia</span>
              </div>

              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[hsl(var(--tennis-ball))]" />
                <a
                  href="mailto: makeinfosense@gmail.com"
                  className="hover:text-white transition-colors"
                >
                  makeinfosense@gmail.com
                </a>
              </div>

              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[hsl(var(--tennis-ball))]" />
                <span>ABN: 90 334 334 015</span>
              </div>
            </div>

            <div className="flex gap-4 pt-2">
              <a
                href="https://www.facebook.com/tennisconnect.au/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[hsl(var(--tennis-ball))] hover:scale-110 transition-all"
              >
                <Facebook className="w-8 h-8" />
              </a>

              <a
                href="https://www.instagram.com/tennisconnect.au/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[hsl(var(--tennis-ball))] hover:scale-110 transition-all"
              >
                <Instagram className="w-8 h-8" />
              </a>

              {/* TikTok/Threads accounts don't exist yet - links point at
                  the platform's homepage as a placeholder until they do. */}
              <a
                href="https://tiktok.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="TennisConnect on TikTok"
                className="text-[hsl(var(--tennis-ball))] hover:scale-110 transition-all"
              >
                <TikTokIcon className="w-8 h-8" />
              </a>

              {/* <a
                href="https://threads.net"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="TennisConnect on Threads"
                className="text-[hsl(var(--tennis-ball))] hover:scale-110 transition-all"
              >
                <ThreadsIcon className="w-8 h-8" />
              </a> */}
            </div>
          </div>

          {/* Platform */}
          <div>
            <h4 className="font-bold text-primary text-lg mb-6 mt-1">Platform</h4>

            <ul className="space-y-3 text-gray-400">
              <li>
                <Link
                  href="/players"
                  className="hover:text-primary transition-colors"
                >
                  Players
                </Link>
              </li>

              <li>
                <Link
                  href="/coaches"
                  className="hover:text-primary transition-colors"
                >
                  Coaches
                </Link>
              </li>

              <li>
                <Link
                  href="/clubs"
                  className="hover:text-primary transition-colors"
                >
                  Club Communities
                </Link>
              </li>

             {/*  <li>
                <Link
                  href="/tournaments"
                  className="hover:text-primary transition-colors"
                >
                  Tournaments
                </Link>
              </li> */}

              {/* <li>
                <Link href="/marketplace"
                  className="hover:text-primary transition-colors"
                >
                  Marketplace
                </Link>
              </li> */}

              <li>
                <Link
                  href="/travels"
                  className="hover:text-primary transition-colors"
                >
                  Travel
                </Link>
              </li>

              {/* <li>
                <Link
                  href="/recreation"
                  className="hover:text-primary transition-colors"
                >
                  Recreation
                </Link>
              </li> */}
              <li>
                <Link
                  href="/articles"
                  className="hover:text-primary transition-colors"
                >
                  Tennis IQ
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-bold text-primary text-lg mb-6 mt-1">Company</h4>

            <ul className="space-y-3 text-gray-400">
              {/* <li>
                <a
                  href="https://shop.tennisconnect.com.au"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary transition-colors"
                >
                  Shop
                </a>
              </li> */}
              <li>
                <a
                  href="/?section=about"
                  className="hover:text-primary transition-colors"
                >
                  About Us
                </a>
              </li>

              <li>
                <a
                  href="/?section=partnership"
                  className="hover:text-primary transition-colors"
                >
                  Partnerships
                </a>
              </li>

              <li>
                <a
                  href="mailto:makeinfosense@gmail.com"
                  className="hover:text-primary transition-colors"
                >
                  Contact Us
                </a>
              </li>

              <li>
                <button
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent("open-support-chat")
                    );
                  }}
                  className="hover:text-primary transition-colors text-left"
                >
                  Support
                </button>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-bold text-primary text-lg mb-6 mt-1">Legal</h4>

            <ul className="space-y-3 text-gray-400">
              <li>
                <Link
                  href="/articles/privacy-policy"
                  className="hover:text-primary transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>

              <li>
                <Link
                  href="/articles/terms-of-service"
                  className="hover:text-primary transition-colors"
                >
                  Terms of Service
                </Link>
              </li>

              <li>
                <Link
                  href="/articles/community-guidelines"
                  className="hover:text-primary transition-colors"
                >
                  Community Guidelines
                </Link>
              </li>

              <li>
                <Link
                  href="/articles/cookie-policy"
                  className="hover:text-primary transition-colors"
                >
                  Cookie Policy
                </Link>
              </li>
              <li>
                <button
                  onClick={openCookieSettings}
                  className="hover:text-primary transition-colors text-left"
                >
                  Manage Cookies
                </button>
              </li>
            </ul>
          </div>

          {/* Newsletter */}
          <div className="col-span-2 lg:col-span-1 md:portrait:col-span-full">
            <h4 className="font-bold text-primary text-lg mb-6 ">Newsletter</h4>

            <p className="text-gray-400 mb-4 text-sm">
              Get updates on tournaments, tennis events and platform news.
            </p>

            <form onSubmit={handleNewsletterSubmit} className="flex gap-2">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email"
                disabled={isSubmitting}
                className="bg-white/10 border border-white/10 rounded-lg px-4 py-2 w-full focus:ring-2 focus:ring-primary outline-none text-white placeholder:text-gray-500 disabled:opacity-60"
              />

              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-primary text-primary-foreground font-bold px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "..." : "OK"}
              </button>
            </form>
            
          </div>
        </div>

        {/* Bottom Bar */}

      <div className="border-t border-[hsl(var(--tennis-ball))]/30 pt-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">

          {/* Left */}

          <div className="text-center lg:text-left">
          <div className="text-xs text-white-700 mt-1">
              Founder & Product Owner:
              Nataliia Petrychuk 
               {/* <a
                href="https://sensepowerdigital.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white font-medium hover:text-primary transition-colors"
              >
                 SensePower Digital
              </a> */} 
            </div>
            <div className="text-sm text-gray-400">
              © {new Date().getFullYear()} TennisConnect.
              All rights reserved.
            </div>           
          </div>

          {/* Right */}

          <div className="text-center lg:text-left lg:max-w-2xl space-y-2">
            <p className="text-sm text-gray-400 leading-relaxed">
              TennisConnect is an independent platform connecting tennis players,
              coaches, clubs and tennis-related services across Australia. Participation in sporting activities, coaching sessions,
              tournaments and marketplace transactions is undertaken at the user's own risk.This platform operates under the laws of New South Wales, Australia
              and complies with applicable Australian Consumer Law. 
            </p>
          </div>

        </div>
      </div>

      </div>
    </footer>
  );
}