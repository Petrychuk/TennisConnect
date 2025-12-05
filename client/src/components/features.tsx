import { motion } from "framer-motion";
import { Users, Trophy, MapPin, Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    icon: Users,
    title: "Спарринг-партнеры",
    description: "Найди игрока своего уровня в твоем районе. Фильтр по рейтингу NTRP.",
    color: "bg-blue-500",
  },
  {
    icon: Star,
    title: "Профессиональные тренеры",
    description: "Индивидуальные и групповые тренировки для детей и взрослых.",
    color: "bg-primary",
  },
  {
    icon: Trophy,
    title: "Любительские турниры",
    description: "Участвуй в соревнованиях, повышай рейтинг и выигрывай призы.",
    color: "bg-purple-500",
  },
  {
    icon: MapPin,
    title: "Бронирование кортов",
    description: "Удобный поиск свободных кортов и быстрое бронирование онлайн.",
    color: "bg-orange-500",
  },
];

export function Features() {
  return (
    <section className="py-24 bg-secondary/50 relative overflow-hidden" id="features">
      {/* Decorative Elements */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-display font-bold mb-4">
            Всё для тенниса в <span className="text-primary">одном месте</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Мы создали экосистему, которая помогает развиваться игрокам любого уровня.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
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
