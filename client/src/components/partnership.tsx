import { motion } from "framer-motion";
import { Handshake, Building2, Users, TrendingUp, Mail, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

const partnerBenefits = [
  {
    icon: Users,
    title: "New Clients",
    description: "Get access to thousands of active tennis players in your area"
  },
  {
    icon: TrendingUp,
    title: "Business Growth",
    description: "Increase court utilization and training bookings"
  },
  {
    icon: Building2,
    title: "Promotion",
    description: "Your club will be featured in our catalog with premium placement"
  },
];

export function Partnership() {
  return (
    <section className="py-24 bg-linear-to-br from-black via-gray-900 to-black text-white relative overflow-hidden" id="partnership">
      <div className="absolute inset-0 opacity-10" 
           style={{ backgroundImage: 'radial-gradient(#DFFF00 1px, transparent 1px)', backgroundSize: '30px 30px' }}>
      </div>
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/20 text-primary border border-primary/30 mb-6">
              <Handshake className="w-4 h-4" />
              <span className="text-sm font-bold uppercase tracking-wider">Partnership</span>
            </div>
            
            <h2 className="text-3xl md:text-5xl font-display font-bold mb-6 leading-tight">
              Become Our <span className="text-primary">Partner</span>
            </h2>
            
            <p className="text-gray-300 text-lg leading-relaxed mb-8">
              We invite tennis clubs, coaches, and tournament organizers to collaborate. 
              Together we can grow the tennis community and attract new players.
            </p>

            <div className="space-y-4 mb-8">
              {partnerBenefits.map((benefit, index) => (
                <motion.div
                  key={benefit.title}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 + index * 0.1 }}
                  className="flex items-start gap-4 p-4 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                    <benefit.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold mb-1">{benefit.title}</h3>
                    <p className="text-sm text-gray-400">{benefit.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button 
                size="lg" 
                className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-full cursor-pointer"
                asChild
              >
                <a href="mailto:partners@tennisconnect.au">
                  <Mail className="w-4 h-4 mr-2" />
                  Contact Us
                </a>
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="border-white/30 text-white hover:bg-white/10 font-bold rounded-full cursor-pointer"
                asChild
              >
                <Link href="/clubs">
                  View Partners <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="hidden lg:block"
          >
            <div className="relative">
              <div className="absolute -inset-4 bg-linear-to-r from-primary/20 to-primary/5 rounded-3xl blur-xl" />
              <div className="relative bg-linear-to-br from-gray-800 to-gray-900 rounded-3xl p-8 border border-white/10">
                <h3 className="text-2xl font-bold mb-6">What We Offer</h3>
                <ul className="space-y-4">
                  {[
                    "Club catalog listing with full description",
                    "Court booking system integration",
                    "Tournament and event promotion",
                    "Access to analytics and statistics",
                    "Marketing support and joint promotions",
                    "Priority technical support"
                  ].map((item, index) => (
                    <li key={index} className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <span className="text-gray-300">{item}</span>
                    </li>
                  ))}
                </ul>
                
                <div className="mt-8 p-4 rounded-xl bg-primary/10 border border-primary/20">
                  <p className="text-sm text-gray-300">
                    <span className="text-primary font-bold">50+ clubs</span> are already growing their business with TennisConnect
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
