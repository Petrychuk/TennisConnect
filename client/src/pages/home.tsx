import { useEffect } from "react";
import { Navbar } from "@/components/navbar";
import { Hero } from "@/components/hero";
import { Features } from "@/components/features";
import { AboutUs } from "@/components/about-us";
import { ProShop } from "@/components/pro-shop";
import { BrandMarquee } from "@/components/brand-marquee";
import { Marketplace } from "@/components/marketplace";
import { Partnership } from "@/components/partnership";
import { Gallery } from "@/components/gallery";
import { Testimonials } from "@/components/testimonials";
import { Footer } from "@/components/footer";
import { HomeArticles } from "@/components/home-articles";
import { HomeTravel } from "@/components/home-travel";
import { HomeRecreation } from "@/components/home-recreation";
import { HomeTournaments } from "@/components/home-tournaments";
import { HomeClubs } from "@/components/home-clubs";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Link } from "wouter";
import SEO from "@/components/seo";

export default function Home() {
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const section = params.get("section");
  
    if (!section) return;
  
    const element = document.getElementById(section);
  
    if (element) {
      element.scrollIntoView({
        behavior: "auto",
        block: "start",
      });
    }
  }, []);

  return (
    <>
    <SEO
      title="TennisConnect - Find Tennis Partners in Australia"
      description="Connect with tennis players, coaches, clubs and tournaments across Australia."
      canonical="/"
      tags={[
        "tennis",
        "tennis partners",
        "tennis coaches",
        "tennis clubs",
        "tennis tournaments",
        "Australia",
        "Sydney tennis",
      ]}
    />
    
    <div className="min-h-screen bg-background font-sans">
      <Navbar />
      
      <main>
        <Hero />       
        <AboutUs />
        <HomeClubs />
        <HomeArticles />
        <ProShop />
        <BrandMarquee />
        <HomeTravel />
        <HomeRecreation />
        <HomeTournaments variant="upcoming" />
        <Gallery />
        <Marketplace />
        <Testimonials /> 
        <Features />          
        <Partnership />
        
        {/* CTA Section */}
        <section className="py-24 px-4 relative overflow-hidden">
          <div className="absolute inset-0 bg-primary/10 -skew-y-3 transform origin-top-left scale-110 z-0" />
          
          <div className="container mx-auto relative z-10">
            <div className="bg-black rounded-3xl p-8 md:p-16 text-center overflow-hidden relative">
              {/* Background pattern */}
              <div className="absolute inset-0 opacity-20" 
                   style={{ backgroundImage: 'radial-gradient(#DFFF00 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
              </div>
              
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="relative z-10"
              >
                <h2 className="text-3xl md:text-5xl font-display font-bold text-white mb-6">
                  Ready to Hit the Court?
                </h2>
                <p className="text-xl text-gray-300 max-w-2xl mx-auto mb-10">
                  Create your profile in 2 minutes, set your skill level, and start receiving match invitations today.
                </p>
                <Link href="/auth">
                  <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-lg h-14 px-10 rounded-full shadow-[0_0_20px_rgba(223,255,0,0.4)] hover:shadow-[0_0_30px_rgba(223,255,0,0.6)] transition-all duration-300 transform hover:-translate-y-1 cursor-pointer">
                    Create Profile
                  </Button>
                </Link>
              </motion.div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
     </div>
    </>
  );
}
