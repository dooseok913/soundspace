import React from 'react';
import { Settings, Save, RefreshCw, Power, ShieldAlert } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import ThemeConfig from './ThemeConfig';

const AdminSettings: React.FC = () => {
    const { theme } = useTheme();

    const sectionStyle = theme === 'jazz'
        ? 'bg-[#2C1F16]/30 border border-[#D4AF37]/20 p-6 rounded-2xl'
        : theme === 'soul'
            ? 'bg-[#1E293B]/30 border border-[#93C5FD]/20 p-6 rounded-2xl'
            : 'bg-slate-900/50 border border-slate-800 p-6 rounded-2xl';

    const headingColor = theme === 'jazz' ? 'text-[#D4AF37]' : theme === 'soul' ? 'text-[#93C5FD]' : 'text-slate-200';
    const subTextColor = theme === 'jazz' ? 'text-[#D4AF37]/60' : theme === 'soul' ? 'text-[#93C5FD]/60' : 'text-slate-500';

    return (
        <div className="space-y-8 max-w-4xl">
            <div>
                <h1 className={`text-3xl font-bold ${headingColor} mb-2`}>System Settings</h1>
                <p className={subTextColor}>Configure global application settings and preferences.</p>
            </div>

            {/* Theme Configuration Integration */}
            <div className={sectionStyle}>
                <div className="flex items-center gap-3 mb-6">
                    <RefreshCw className={theme === 'jazz' ? 'text-[#D4AF37]' : theme === 'soul' ? 'text-[#93C5FD]' : 'text-cyan-400'} />
                    <h2 className={`text-xl font-bold ${headingColor}`}>Theme Configuration</h2>
                </div>
                <div className="pl-4 border-l-2 border-white/5">
                    <ThemeConfig />
                </div>
            </div>

            {/* General System Settings */}
            <div className={sectionStyle}>
                <div className="flex items-center gap-3 mb-6">
                    <Settings className={theme === 'jazz' ? 'text-[#D4AF37]' : theme === 'soul' ? 'text-[#93C5FD]' : 'text-cyan-400'} />
                    <h2 className={`text-xl font-bold ${headingColor}`}>General Settings</h2>
                </div>

                <div className="space-y-6">
                    <div className="flex items-center justify-between p-4 rounded-xl bg-white/5">
                        <div>
                            <h3 className={`font-medium ${headingColor}`}>Maintenance Mode</h3>
                            <p className={`text-sm ${subTextColor}`}>Disable access for non-admin users</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" />
                            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
                        </label>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-xl bg-white/5">
                        <div>
                            <h3 className={`font-medium ${headingColor}`}>User Registration</h3>
                            <p className={`text-sm ${subTextColor}`}>Allow new users to sign up</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" defaultChecked />
                            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                    </div>
                </div>
            </div>

            {/* Danger Zone */}
            <div className={`p-6 rounded-2xl border border-red-500/30 bg-red-500/5`}>
                <div className="flex items-center gap-3 mb-6 text-red-400">
                    <ShieldAlert />
                    <h2 className="text-xl font-bold">Danger Zone</h2>
                </div>

                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-medium text-red-300">Reset System Data</h3>
                        <p className="text-sm text-red-400/60">This will delete all temporary caches and logs. Cannot be undone.</p>
                    </div>
                    <button className="px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-lg border border-red-500/50 transition-colors text-sm font-medium">
                        Reset Data
                    </button>
                </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-4">
                <button className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold shadow-lg transition-all hover:scale-105 ${theme === 'jazz'
                    ? 'bg-[#D4AF37] text-[#1A0B05] hover:shadow-[#D4AF37]/20'
                    : theme === 'soul'
                        ? 'bg-[#93C5FD] text-[#0F172A] hover:shadow-[#93C5FD]/20'
                        : 'bg-cyan-500 text-slate-950 hover:shadow-cyan-500/20'
                    }`}>
                    <Save size={20} />
                    Save Changes
                </button>
            </div>
        </div>
    );
};

export default AdminSettings;
