import { motion } from "framer-motion";
import { Users, Trophy, GraduationCap, MapPin, Star, Plane, ShoppingBag, BookOpen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    icon: Users,
    title: "Playing Partners",
    description: "Find players at your level and organise your next hit",
    color: "bg-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    icon: GraduationCap,
    title: "Coaches",
    description: "Discover experienced coaches for private and group lessons.",
    color: "bg-primary",
    bgColor: "bg-primary/10",
  },
  {
    icon: Plane,
    title: "Travel Experiences",
    description: "Explore tennis holidays, retreats, and unique experiences.",
    color: "bg-purple-500",
    bgColor: "bg-purple-500/10",
  },
  {
    icon: Trophy,
    title: "Organiser Hub & Live Sessions",
    description: "Run sessions, manage players, and score matches live from your Organiser Hub.",
    color: "bg-yellow-500",
    bgColor: "bg-yellow-500/10",
  },
  {
    icon: MapPin,
    title: "Courts & Community",
    description: "Find courts near you and connect with the local tennis community.",
    color: "bg-pink-500",
    bgColor: "bg-pink-500/10",
  },
  {
    icon: BookOpen,
    title: "Tennis IQ",
    description: "Level up your game with tactics breakdowns, coaching insights, and community posts.",
    color: "bg-teal-500",
    bgColor: "bg-teal-500/10",
  },
  {
    icon: ShoppingBag,
    title: "Marketplace",
    description: "Buy, sell, and discover tennis gear within the community.",
    color: "bg-orange-500",
    bgColor: "bg-orange-500/10",
    // Hidden for now - not deleted, just not ready to show publicly yet.
    // Flip this back to false (or remove the flag) to bring it back.
    hidden: true,
  },
];

export function Features() {
  return (
    <section className="py-24 bg-secondary/50 relative overflow-hidden" id="features">
      {/* Decorative Elements */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-[1.8125rem] md:text-5xl font-display font-bold mb-4">
          Discover Your <span className="text-primary">Tennis World</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Whether you're looking for a playing partner, professional coach, local club, social session, tournament or your next tennis adventure, TennisConnect brings everything together in one platform.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.filter((feature) => !feature.hidden).map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="h-full border-none shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group bg-card overflow-hidden relative">
                <div className={`absolute top-0 left-0 w-full h-1 ${feature.color}`} />
                <CardContent className="p-6 pt-8">
                  <div className={`w-14 h-14 rounded-2xl ${feature.color}/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                    <feature.icon className={`w-7 h-7 ${feature.color === 'bg-primary' ? 'text-lime-700' : feature.color.replace('bg-', 'text-')}`} />
                  </div>
                  <h3 className="text-xl font-bold mb-3 font-display">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
