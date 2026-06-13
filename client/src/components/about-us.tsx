import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, Heart, Target, Award } from "lucide-react";

const values = [
  {
    icon: Users,
    title: "Community",
    description: "Bringing tennis players together across Australia"
  },
  {
    icon: Heart,
    title: "Passion for the Game",
    description: "Celebrating the sport that connects people of all backgrounds and skill levels"
  },
  {
    icon: Target,
    title: "Accessibility",
    description: "Helping players find partners, coaches, clubs, and events near them"
  },
  {
    icon: Award,
    title: "Quality",
    description: "Supporting trusted coaches, clubs, and tennis services"
  },
];

export function AboutUs() {
  const [stats, setStats] = useState({
    players: 0,
    coaches: 0,
    clubs: 0,
    tournaments: 0,
  });
  
  useEffect(() => {
    async function loadStats() {
      try {
        const res = await fetch("/api/stats");
  
        if (!res.ok) return;
  
        const data = await res.json();
  
        setStats(data);
      } catch (error) {
        console.error("Failed to load stats", error);
      }
    }
  
    loadStats();
  }, []);
  
  const statsCards = [
    {
      number: stats.players,
      label: "Players",
    },
    {
      number: stats.coaches,
      label: "Coaches",
    },
    {
      number: stats.clubs,
      label: "Clubs",
    },
    {
      number: stats.tournaments,
      label: "Tournaments",
    },
  ];

  return (
    <section className="py-24 bg-background relative overflow-hidden" id="about">
      <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl -translate-y-1/2 -translate-x-1/2 pointer-events-none" />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary border border-primary/20 mb-6">
              <Target className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">
                OUR STORY
              </span>
            </div>
            
            <h2 className="text-3xl md:text-5xl font-display font-bold mb-6 leading-tight">
              TennisConnect — Your Gateway to <span className="text-primary">Tennis</span>
            </h2>
            
            <p className="text-muted-foreground text-lg leading-relaxed mb-8">
             Launched in Sydney in 2026, TennisConnect was created to bring tennis players, coaches, clubs, and events together in one community-driven platform.
            </p>
            
            <p className="text-muted-foreground text-lg leading-relaxed">
             Whether you're looking for a hitting partner, a professional coach, local tournaments, or new tennis experiences, TennisConnect helps you discover opportunities both on and off the court.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="grid grid-cols-2 gap-4"
          >
            {values.map((value, index) => (
              <motion.div
                key={value.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 + index * 0.1 }}
                className="bg-card border rounded-2xl p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <value.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-bold text-lg mb-2">{value.title}</h3>
                <p className="text-sm text-muted-foreground">{value.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6"
        >
          {statsCards.map((stat) => (
            <div key={stat.label} className="text-center p-6 rounded-2xl bg-primary/10 border border-primary/10">
              <div className="text-4xl md:text-5xl font-display font-bold text-primary mb-2">
                {stat.number}
              </div>
              <div className="text-muted-foreground font-medium">{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
