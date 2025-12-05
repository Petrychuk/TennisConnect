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
              Australia's modern platform for tennis enthusiasts. Find a partner, book a court, buy gear, and start playing today.
            </p>
          </div>
          
          <div>
            <h4 className="font-bold text-lg mb-6">Platform</h4>
            <ul className="space-y-3 text-gray-400">
              <li><a href="#" className="hover:text-primary transition-colors">Find Partners</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Coaches</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Marketplace</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Tournaments</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-bold text-lg mb-6">Company</h4>
            <ul className="space-y-3 text-gray-400">
              <li><a href="#" className="hover:text-primary transition-colors">About Us</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Blog</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Careers</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Contact</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-bold text-lg mb-6">Newsletter</h4>
            <p className="text-gray-400 mb-4">Get updates on tournaments and gear deals in Sydney.</p>
            <div className="flex gap-2">
              <input 
                type="email" 
                placeholder="Email address" 
                className="bg-white/10 border-none rounded-lg px-4 py-2 w-full focus:ring-2 focus:ring-primary outline-none text-white placeholder:text-gray-500"
              />
              <button className="bg-primary text-primary-foreground font-bold px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors">
                OK
              </button>
            </div>
          </div>
        </div>
        
        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-gray-500 text-sm">
          <div className="flex flex-col md:flex-row gap-2 md:items-center text-center md:text-left">
            <span>&copy; 2025 TennisConnect Australia. All rights reserved.</span>
            <span className="hidden md:inline text-gray-700">|</span>
            <span className="text-gray-400">
              Made by <span className="text-white font-medium hover:text-primary transition-colors cursor-pointer">SensePower Digital</span> digital studio
            </span>
          </div>
          <div className="flex gap-6 justify-center">
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
          </div>
        </div>

        {/* Australian Legal Disclaimer */}
        <div className="border-t border-white/5 mt-8 pt-8 text-xs text-gray-600 text-center max-w-4xl mx-auto leading-relaxed">
          <p className="mb-2">
            <strong>Disclaimer:</strong> The information provided on this website is for general informational purposes only. 
            TennisConnect Australia assumes no responsibility for errors or omissions in the contents on the Service. 
            Users participate in sporting activities and transactions at their own risk.
          </p>
          <p>
            This website operates under the laws of New South Wales, Australia. 
            Our goods and services come with guarantees that cannot be excluded under the Australian Consumer Law.
            TennisConnect Australia is not liable for any disputes arising between users, coaches, or clubs.
          </p>
        </div>
      </div>
    </footer>
  );
}
