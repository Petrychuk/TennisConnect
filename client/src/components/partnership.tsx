import { motion } from "framer-motion";
import { Handshake, Building2, Users, TrendingUp, Mail, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

const partnerBenefits = [
  {
    icon: Users,
    title: "Новые клиенты",
    description: "Получите доступ к тысячам активных теннисистов в вашем регионе"
  },
  {
    icon: TrendingUp,
    title: "Рост бизнеса",
    description: "Увеличьте загрузку кортов и записи на тренировки"
  },
  {
    icon: Building2,
    title: "Продвижение",
    description: "Ваш клуб будет представлен в нашем каталоге с премиум-размещением"
  },
];

export function Partnership() {
  return (
    <section className="py-24 bg-gradient-to-br from-black via-gray-900 to-black text-white relative overflow-hidden" id="partnership">
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
              <span className="text-sm font-bold uppercase tracking-wider">Партнерство</span>
            </div>
            
            <h2 className="text-3xl md:text-5xl font-display font-bold mb-6 leading-tight">
              Станьте нашим <span className="text-primary">партнером</span>
            </h2>
            
            <p className="text-gray-300 text-lg leading-relaxed mb-8">
              Приглашаем теннисные клубы, тренеров и организаторов турниров к сотрудничеству. 
              Вместе мы сможем развивать теннисное сообщество и привлекать новых игроков.
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
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
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
                  Связаться с нами
                </a>
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="border-white/30 text-white hover:bg-white/10 font-bold rounded-full cursor-pointer"
                asChild
              >
                <Link href="/clubs">
                  Посмотреть партнеров <ArrowRight className="w-4 h-4 ml-2" />
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
              <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 to-primary/5 rounded-3xl blur-xl" />
              <div className="relative bg-gradient-to-br from-gray-800 to-gray-900 rounded-3xl p-8 border border-white/10">
                <h3 className="text-2xl font-bold mb-6">Что мы предлагаем</h3>
                <ul className="space-y-4">
                  {[
                    "Размещение в каталоге клубов с полным описанием",
                    "Интеграция системы бронирования кортов",
                    "Продвижение ваших турниров и мероприятий",
                    "Доступ к аналитике и статистике",
                    "Маркетинговая поддержка и совместные акции",
                    "Приоритетная техническая поддержка"
                  ].map((item, index) => (
                    <li key={index} className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <span className="text-gray-300">{item}</span>
                    </li>
                  ))}
                </ul>
                
                <div className="mt-8 p-4 rounded-xl bg-primary/10 border border-primary/20">
                  <p className="text-primary font-bold text-lg mb-1">Бесплатный пробный период</p>
                  <p className="text-sm text-gray-400">30 дней полного доступа для новых партнеров</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
