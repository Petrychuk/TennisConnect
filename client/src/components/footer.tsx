import { Link } from "wouter";

export function Footer() {
  return (
    <footer className="bg-black text-white py-16 border-t border-white/10">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          <div className="space-y-4">
            <h3 className="text-2xl font-display font-bold flex items-center gap-1">
              Tennis<span className="text-[hsl(var(--tennis-ball))]">Connect</span>
            </h3>
            <p className="text-gray-400 leading-relaxed">
              Современная платформа для любителей тенниса в Австралии. Найди партнера, забронируй корт, купи снаряжение и начни играть уже сегодня.
            </p>
          </div>
          
          <div>
            <h4 className="font-bold text-lg mb-6">Платформа</h4>
            <ul className="space-y-3 text-gray-400">
              <li><Link href="/partners" className="hover:text-primary transition-colors cursor-pointer">Найти партнеров</Link></li>
              <li><Link href="/coaches" className="hover:text-primary transition-colors cursor-pointer">Тренеры</Link></li>
              <li><Link href="/marketplace" className="hover:text-primary transition-colors cursor-pointer">Маркетплейс</Link></li>
              <li><Link href="/tournaments" className="hover:text-primary transition-colors cursor-pointer">Турниры</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-bold text-lg mb-6">Компания</h4>
            <ul className="space-y-3 text-gray-400">
              <li><a href="#about" className="hover:text-primary transition-colors cursor-pointer">О нас</a></li>
              <li><Link href="/clubs" className="hover:text-primary transition-colors cursor-pointer">Клубы</Link></li>
              <li><a href="#partnership" className="hover:text-primary transition-colors cursor-pointer">Партнерство</a></li>
              <li><a href="mailto:info@tennisconnect.au" className="hover:text-primary transition-colors cursor-pointer">Контакты</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-bold text-lg mb-6">Рассылка</h4>
            <p className="text-gray-400 mb-4">Получайте новости о турнирах и акциях в Сиднее.</p>
            <div className="flex gap-2">
              <input 
                type="email" 
                placeholder="Ваш email" 
                className="bg-white/10 border-none rounded-lg px-4 py-2 w-full focus:ring-2 focus:ring-primary outline-none text-white placeholder:text-gray-500"
              />
              <button className="bg-primary text-primary-foreground font-bold px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors cursor-pointer">
                OK
              </button>
            </div>
          </div>
        </div>
        
        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-gray-500 text-sm">
          <div className="flex flex-col md:flex-row gap-2 md:items-center text-center md:text-left">
            <span>&copy; 2025 TennisConnect Australia. Все права защищены.</span>
            <span className="hidden md:inline text-gray-700">|</span>
            <span className="text-gray-400">
              Разработано студией <span className="text-white font-medium hover:text-primary transition-colors cursor-pointer">SensePower Digital</span>
            </span>
          </div>
          <div className="flex gap-6 justify-center">
            <a href="#" className="hover:text-white transition-colors cursor-pointer">Политика конфиденциальности</a>
            <a href="#" className="hover:text-white transition-colors cursor-pointer">Условия использования</a>
          </div>
        </div>

        {/* Australian Legal Disclaimer */}
        <div className="border-t border-white/5 mt-8 pt-8 text-xs text-gray-600 text-center max-w-4xl mx-auto leading-relaxed">
          <p className="mb-2">
            <strong>Отказ от ответственности:</strong> Информация на этом сайте предоставлена только в ознакомительных целях. 
            TennisConnect Australia не несет ответственности за ошибки или упущения в содержании сервиса. 
            Пользователи участвуют в спортивных мероприятиях и сделках на свой страх и риск.
          </p>
          <p>
            Данный сайт работает в соответствии с законодательством штата Новый Южный Уэльс, Австралия. 
            На наши товары и услуги распространяются гарантии, которые не могут быть исключены согласно австралийскому законодательству о защите прав потребителей.
            TennisConnect Australia не несет ответственности за споры между пользователями, тренерами или клубами.
          </p>
        </div>
      </div>
    </footer>
  );
}
