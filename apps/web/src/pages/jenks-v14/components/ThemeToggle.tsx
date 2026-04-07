import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="relative w-10 h-10 flex items-center justify-center rounded-full bg-[#F8F6F1] dark:bg-[#1A1A1A] border border-[#1A1A1A]/10 dark:border-white/10 transition-all duration-300 hover:scale-110"
      aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
      title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
    >
      <div className="relative w-5 h-5">
        {/* Sun Icon */}
        <Sun 
          className={`absolute inset-0 w-5 h-5 text-[#E85A3C] transition-all duration-300 ${
            theme === 'dark' ? 'opacity-0 rotate-90 scale-0' : 'opacity-100 rotate-0 scale-100'
          }`}
        />
        {/* Moon Icon */}
        <Moon 
          className={`absolute inset-0 w-5 h-5 text-[#E85A3C] transition-all duration-300 ${
            theme === 'dark' ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-0'
          }`}
        />
      </div>
    </button>
  );
}
