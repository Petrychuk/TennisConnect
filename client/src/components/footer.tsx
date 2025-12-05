import { Link } from "wouter";

export function Footer() {
  return (
    <footer className="bg-black text-white py-16 border-t border-white/10">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          <div className="space-y-4">
            <h3 className="text-2xl font-display font-bold flex items-center gap-1">
              Tennis<span className="text-primary">Connect</span>
            </h3>
            <p className="text-gray-400 leading-relaxed">
              Современная платформа для любителей тенниса. Найди партнера, забронируй корт и начни играть уже сегодня.
            </p>
          </div>
          
          <div>
            <h4 className="font-bold text-lg mb-6">Платформа</h4>
            <ul className="space-y-3 text-gray-400">
              <li><a href="#" className="hover:text-primary transition-colors">Поиск партнеров</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Тренеры</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Корты</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Турниры</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-bold text-lg mb-6">Компания</h4>
            <ul className="space-y-3 text-gray-400">
              <li><a href="#" className="hover:text-primary transition-colors">О нас</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Блог</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Карьера</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Контакты</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-bold text-lg mb-6">Подпишись</h4>
            <p className="text-gray-400 mb-4">Получай новости о турнирах и специальных предложениях.</p>
            <div className="flex gap-2">
              <input 
                type="email" 
                placeholder="Email" 
                className="bg-white/10 border-none rounded-lg px-4 py-2 w-full focus:ring-2 focus:ring-primary outline-none text-white placeholder:text-gray-500"
              />
              <button className="bg-primary text-primary-foreground font-bold px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors">
                OK
              </button>
            </div>
          </div>
        </div>
        
        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-gray-500 text-sm">
          <p>&copy; 2024 TennisConnect. Все права защищены.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-white transition-colors">Конфиденциальность</a>
            <a href="#" className="hover:text-white transition-colors">Условия использования</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
