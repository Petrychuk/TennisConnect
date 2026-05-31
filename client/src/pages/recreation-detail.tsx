import { useEffect, useState } from "react";
import { useRoute, Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, MapPin, Clock, Star, Phone, Mail, CheckCircle2 } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";

interface RecreationService {
  id: string;
  slug: string;
  name: string;
  type: string;
  provider: string;
  location: string;
  duration: string;
  price: number;
  currency: string;
  description: string;
  benefits: string[];
  coverImage: string;
  rating: string | null;
  phone: string | null;
  email: string | null;
}

export default function RecreationDetailPage() {
  const [, params] = useRoute("/recreation/:slug");
  const [svc, setSvc] = useState<RecreationService | null>(null);
  const [notFound, setNotFound] = useState(false);
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!params?.slug) return;
    window.scrollTo(0, 0);
    fetch(`/api/recreation/${params.slug}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setSvc)
      .catch(() => setNotFound(true));
  }, [params?.slug]);

  const handleBook = () => {
    if (!isAuthenticated) {
      toast({
        title: "Sign in required",
        description: "Sign in to book a session.",
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Booking request sent!",
      description: `${svc?.provider} will be in touch shortly.`,
    });
  };

  if (notFound) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-4">Service not found</h1>
            <Link href="/recreation"><Button className="bg-primary text-primary-foreground">Back</Button></Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }
  if (!svc) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-sans">
      <Navbar />

      <div className="relative h-[55vh] mt-16 overflow-hidden">
        <img src={svc.coverImage} alt={svc.name} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-linear-to-t from-background via-background/40 to-transparent" />
        <div className="absolute bottom-8 left-0 right-0 container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
            <Badge className="mb-3 bg-primary text-primary-foreground font-bold">{svc.type}</Badge>
            <h1 className="text-4xl md:text-6xl font-display font-bold text-white mb-2" data-testid="recreation-title">
              {svc.name}
            </h1>
            <p className="text-lg text-white/90">{svc.provider}</p>
          </motion.div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        <Link href="/recreation"><Button variant="ghost" className="mb-6 gap-2 cursor-pointer"><ArrowLeft className="w-4 h-4" /> All Services</Button></Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-display font-bold mb-4">About this service</h2>
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed">{svc.description}</p>

            {svc.benefits && svc.benefits.length > 0 && (
              <div>
                <h3 className="text-xl font-bold mb-4">Benefits</h3>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {svc.benefits.map((b) => (
                    <li key={b} className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div>
            <div className="sticky top-24 bg-gradient-to-br from-primary/10 to-primary/5 rounded-3xl p-6">
              {svc.rating && (
                <div className="flex items-center gap-1 mb-3 text-sm font-bold">
                  <Star className="w-4 h-4 fill-yellow-400 stroke-yellow-400" /> {svc.rating}
                </div>
              )}
              <p className="text-4xl font-display font-bold mb-1">
                ${svc.price}
                <span className="text-base text-muted-foreground font-normal ml-1">{svc.currency}</span>
              </p>
              <p className="text-sm text-muted-foreground mb-6">per session</p>

              <div className="space-y-3 mb-6 text-sm border-t pt-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> Duration</span>
                  <span className="font-bold">{svc.duration}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" /> Location</span>
                  <span className="font-bold">{svc.location}</span>
                </div>
                {svc.phone && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" /> Phone</span>
                    <a href={`tel:${svc.phone}`} className="font-bold hover:text-primary">{svc.phone}</a>
                  </div>
                )}
                {svc.email && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground flex items-center gap-1 shrink-0"><Mail className="w-3 h-3" /> Email</span>
                    <a href={`mailto:${svc.email}`} className="font-bold hover:text-primary text-right truncate">{svc.email}</a>
                  </div>
                )}
              </div>

              <Button
                onClick={handleBook}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-full cursor-pointer"
                data-testid="recreation-book-button"
              >
                Book Session
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
