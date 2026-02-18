import React, { createContext, useContext, useEffect, useState } from 'react';
import { settingsApi } from '../services/api/settings';

type Theme = 'default' | 'jazz' | 'soul';

interface ThemeContextType {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Initialize state from localStorage (fallback while API loads)
    const [theme, setThemeState] = useState<Theme>(() => {
        const savedTheme = localStorage.getItem('app-theme') as Theme;
        return (['default', 'jazz', 'soul'].includes(savedTheme)) ? savedTheme : 'default';
    });

    // Mount 시 DB에서 전역 테마 로드 (관리자가 설정한 테마)
    useEffect(() => {
        settingsApi.getTheme()
            .then(({ theme: globalTheme }) => {
                const valid = ['default', 'jazz', 'soul'];
                if (valid.includes(globalTheme)) {
                    setThemeState(globalTheme as Theme);
                    localStorage.setItem('app-theme', globalTheme);
                }
            })
            .catch(() => {
                // 네트워크 오류 시 localStorage 값 유지
            });
    }, []);

    // 테마 변경: localStorage 저장 + API 저장 (MASTER만 성공, 나머지 403 무시)
    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme);
        localStorage.setItem('app-theme', newTheme);
        settingsApi.setTheme(newTheme).catch(() => {
            // MASTER 아닌 경우 403 → 무시 (로컬에는 적용됨)
        });
    };

    // toggleTheme: setTheme 위임으로 localStorage 동기화 보장
    const toggleTheme = () => {
        const next: Theme = theme === 'default' ? 'jazz' : theme === 'jazz' ? 'soul' : 'default';
        setTheme(next);
    };

    // Side effect: Apply theme class to document root
    useEffect(() => {
        const root = document.documentElement;

        root.classList.remove('theme-default', 'theme-jazz', 'theme-soul');
        root.classList.add(`theme-${theme}`);
        root.setAttribute('data-theme', theme);

        // Soul Theme Background Rotation Logic
        let rotationInterval: NodeJS.Timeout;
        if (theme === 'soul') {
            const bgImages = [
                'soul_bg_new_1.png',
                'soul_bg_new_2.png',
                'soul_bg_new_3.png'
            ];
            let currentIndex = 0;

            const rotateBackground = () => {
                root.style.setProperty('--soul-bg-image', `url("/images/theme/${bgImages[currentIndex]}")`);
                currentIndex = (currentIndex + 1) % bgImages.length;
            };

            rotateBackground();
            rotationInterval = setInterval(rotateBackground, 15000);
        } else {
            root.style.removeProperty('--soul-bg-image');
        }

        return () => {
            if (rotationInterval) clearInterval(rotationInterval);
        };
    }, [theme]);

    return (
        <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
