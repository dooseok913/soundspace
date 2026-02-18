import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

const ThemeSwitcher: React.FC = () => {
    const { theme, toggleTheme } = useTheme();

    // Helper to get button style based on theme
    const getButtonStyle = () => {
        switch (theme) {
            case 'jazz':
                return 'bg-[#2C1F16] border border-[#D4AF37] text-[#D4AF37] hover:bg-[#3C2A1E]';
            case 'soul':
                return 'bg-[#1E293B] border border-[#93C5FD] text-[#93C5FD] hover:bg-[#334155] shadow-[0_0_15px_rgba(147,197,253,0.3)]';
            default:
                return 'bg-[#141B2D] border border-[#00FFCC] text-[#00FFCC] hover:bg-[#1E293B]';
        }
    };

    const getThemeLabel = () => {
        switch (theme) {
            case 'jazz':
                return (
                    <div className="flex items-center gap-2">
                        <span className="text-lg">🎷</span>
                        <span className="text-sm font-medium">Jazz Mode</span>
                    </div>
                );
            case 'soul':
                return (
                    <div className="flex items-center gap-2">
                        <span className="text-lg">☁️</span>
                        <span className="text-sm font-medium">Soul Mode</span>
                    </div>
                );
            default:
                return (
                    <div className="flex items-center gap-2">
                        <span className="text-lg">💻</span>
                        <span className="text-sm font-medium">HUD Mode</span>
                    </div>
                );
        }
    };

    return (
        <button
            onClick={toggleTheme}
            className={`
                relative inline-flex items-center justify-center p-2 rounded-lg transition-all duration-300 w-32
                ${getButtonStyle()}
            `}
            title={`Current Theme: ${theme.charAt(0).toUpperCase() + theme.slice(1)}`}
        >
            {getThemeLabel()}
        </button>
    );
};

export default ThemeSwitcher;
