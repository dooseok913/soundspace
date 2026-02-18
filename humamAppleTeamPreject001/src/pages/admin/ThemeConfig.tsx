import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import ThemeSwitcher from '../../components/common/ThemeSwitcher';

const ThemeConfig: React.FC = () => {
    const { theme } = useTheme();

    return (
        <div className="p-6 md:p-10 min-h-screen">
            <h1 className="text-3xl font-bold mb-8 text-hud-accent-primary">Theme Configuration</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Theme Selection Card */}
                <div className="hud-card p-6 rounded-xl">
                    <h2 className="text-xl font-semibold mb-4 border-b border-hud-border-secondary pb-2">Active Theme</h2>
                    <div className="flex items-center justify-between mb-6">
                        <span className="text-hud-text-secondary">Current Theme:</span>
                        <span className="text-hud-text-primary uppercase font-bold tracking-wider">{theme}</span>
                    </div>

                    <div className="flex justify-center py-4">
                        <ThemeSwitcher />
                    </div>

                    <p className="mt-4 text-sm text-hud-text-muted text-center">
                        Toggle to switch between Default (HUD), Jazz Cafe, and Soul modes.
                    </p>
                </div>

                {/* Preview / Debug Info Card */}
                <div className="hud-card p-6 rounded-xl">
                    <h2 className="text-xl font-semibold mb-4 border-b border-hud-border-secondary pb-2">Theme Tokens</h2>
                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                            <span className="text-hud-text-muted">Primary Background</span>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded-full bg-hud-bg-primary border border-hud-border-secondary"></div>
                                <span className="font-mono text-xs">var(--hud-bg-primary)</span>
                            </div>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-hud-text-muted">Card Background</span>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded-full bg-hud-bg-card border border-hud-border-secondary"></div>
                                <span className="font-mono text-xs">var(--hud-bg-card)</span>
                            </div>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-hud-text-muted">Primary Text</span>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded-full bg-hud-text-primary border border-hud-border-secondary"></div>
                                <span className="font-mono text-xs text-hud-text-primary">Aa</span>
                            </div>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-hud-text-muted">Primary Accent</span>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded-full bg-hud-accent-primary"></div>
                                <span className="font-mono text-xs text-hud-accent-primary">Color</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ThemeConfig;
