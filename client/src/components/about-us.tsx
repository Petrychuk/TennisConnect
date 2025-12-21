import { motion } from "framer-motion";
import { Users, Heart, Target, Award } from "lucide-react";

const stats = [
  { number: "5000+", label: "Активных игроков" },
  { number: "200+", label: "Тренеров" },
  { number: "50+", label: "Клубов-партнеров" },
  { number: "100+", label: "Турниров в год" },
];

const values = [
  {
    icon: Users,
    title: "Сообщество",
    description: "Мы объединяем людей, которые любят теннис, независимо от возраста и уровня подготовки."
  },
  {
    icon: Heart,
    title: "Страсть к игре",
    description: "Теннис — это не просто спорт, это стиль жизни и путь к здоровью."
  },
  {
    icon: Target,
    title: "Доступность",
    description: "Мы делаем теннис доступным для каждого, помогая найти партнеров и тренеров рядом с вами."
  },
  {
    icon: Award,
    title: "Качество",
    description: "Все тренеры и клубы проходят проверку для гарантии высокого уровня услуг."
  },
];

export function AboutUs() {
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
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 mb-6">
              <span className="text-xs font-bold uppercase tracking-wider">О нас</span>
            </div>
            
            <h2 className="text-3xl md:text-5xl font-display font-bold mb-6 leading-tight">
              TennisConnect — ваш путь в мир <span className="text-primary">большого тенниса</span>
            </h2>
            
            <p className="text-muted-foreground text-lg leading-relaxed mb-8">
              Мы создали платформу, которая объединяет теннисное сообщество Австралии. 
              Наша миссия — помочь каждому найти идеального партнера для игры, 
              профессионального тренера или удобный корт рядом с домом.
            </p>
            
            <p className="text-muted-foreground text-lg leading-relaxed">
              С 2020 года мы помогаем тысячам игроков развивать свои навыки, 
              находить друзей и наслаждаться любимым спортом. Присоединяйтесь к нашему сообществу!
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
          {stats.map((stat, index) => (
            <div key={stat.label} className="text-center p-6 rounded-2xl bg-secondary/50">
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
