/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                // HUD Theme Colors
                hud: {
                    bg: {
                        primary: 'var(--hud-bg-primary)',
                        secondary: 'var(--hud-bg-secondary)',
                        card: 'var(--hud-bg-card)',
                        hover: 'var(--hud-bg-hover)',
                    },
                    accent: {
                        primary: 'var(--hud-accent-primary)',
                        secondary: 'var(--hud-accent-secondary)',
                        warning: 'var(--hud-accent-warning)',
                        info: 'var(--hud-accent-info)',
                        success: 'var(--hud-accent-success)',
                        danger: 'var(--hud-accent-error)',
                    },
                    text: {
                        primary: 'var(--hud-text-primary)',
                        secondary: 'var(--hud-text-secondary)',
                        muted: 'var(--hud-text-muted)',
                    },
                    border: {
                        primary: 'var(--hud-border-primary)',
                        secondary: 'var(--hud-border-secondary)',
                    }
                },
                // Music PMS Theme Colors (Purple/Pink)
                music: {
                    primary: '#667eea',
                    secondary: '#764ba2',
                    accent: '#f093fb',
                    pink: '#f5576c',
                    bg: {
                        primary: '#0f0c29',
                        secondary: '#302b63',
                        tertiary: '#24243e',
                    }
                },
                // Music EMS Theme Colors (Amber/Yellow)
                ems: {
                    primary: '#eab308',
                    secondary: '#f59e0b',
                    bg: {
                        primary: '#1a1a2e',
                        secondary: '#16213e',
                        tertiary: '#0f3460',
                    }
                }
            },
            fontFamily: {
                sans: ['Inter', 'Roboto', 'system-ui', 'sans-serif'],
                mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
            },
            boxShadow: {
                'hud': '0 0 20px var(--hud-border-primary)', // changed from 0.1 opacity to variable (0.3) but close enough or I can add another var
                'hud-glow': '0 0 30px var(--hud-border-primary)',
                'hud-pink': '0 0 20px rgba(255, 20, 147, 0.3)', // keeping hardcoded for specific pink glow or add variable if needed
            },
            animation: {
                'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
                'fade-in': 'fadeIn 0.3s ease-out',
                'slide-in': 'slideIn 0.3s ease-out',
            },
            keyframes: {
                'pulse-glow': {
                    '0%, 100%': { boxShadow: '0 0 20px var(--hud-border-primary)' },
                    '50%': { boxShadow: '0 0 40px var(--hud-border-primary)' },
                },
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideIn: {
                    '0%': { transform: 'translateX(-10px)', opacity: '0' },
                    '100%': { transform: 'translateX(0)', opacity: '1' },
                },
            },
            backgroundImage: {
                'hud-grid': `
          linear-gradient(var(--hud-border-secondary) 1px, transparent 1px),
          linear-gradient(90deg, var(--hud-border-secondary) 1px, transparent 1px)
        `,
            },
            backgroundSize: {
                'grid': '50px 50px',
            },
        },
    },
    plugins: [],
}
