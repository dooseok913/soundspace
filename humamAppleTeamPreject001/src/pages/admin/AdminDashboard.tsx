import React from 'react';
import { Users, Music, Disc, Activity, TrendingUp } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

const AdminDashboard: React.FC = () => {
    const { theme } = useTheme();

    // Mock Data
    const stats = [
        { title: 'Total Users', value: '1,234', change: '+12%', icon: Users, color: 'text-blue-400', bg: 'bg-blue-400/10' },
        { title: 'Total Tracks', value: '45.2k', change: '+5.3%', icon: Music, color: 'text-green-400', bg: 'bg-green-400/10' },
        { title: 'Playlists', value: '892', change: '+24%', icon: Disc, color: 'text-purple-400', bg: 'bg-purple-400/10' },
        { title: 'Active Now', value: '128', change: '+8%', icon: Activity, color: 'text-orange-400', bg: 'bg-orange-400/10' },
    ];

    const cardStyle = theme === 'jazz'
        ? 'bg-[#2C1F16]/80 border-[#D4AF37]/20 backdrop-blur-md shadow-lg shadow-[#1A0B05]/50'
        : theme === 'soul'
            ? 'bg-[#1E293B]/80 border-[#93C5FD]/20 backdrop-blur-md shadow-lg shadow-[#0F172A]/50'
            : 'bg-slate-800/50 border-slate-700 backdrop-blur-md';

    const headingColor = theme === 'jazz'
        ? 'text-[#D4AF37]'
        : theme === 'soul'
            ? 'text-[#93C5FD]'
            : 'text-white';

    return (
        <div className="space-y-8">
            <div>
                <h1 className={`text-3xl font-bold ${headingColor} mb-2`}>Dashboard</h1>
                <p className="text-white/50">Overview of your MusicSpace platform.</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, index) => (
                    <div key={index} className={`p-6 rounded-2xl border ${cardStyle} transition-transform hover:scale-[1.02]`}>
                        <div className="flex justify-between items-start mb-4">
                            <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                                <stat.icon size={24} />
                            </div>
                            <span className="flex items-center gap-1 text-green-400 text-sm font-medium bg-green-400/10 px-2 py-1 rounded-full">
                                <TrendingUp size={12} />
                                {stat.change}
                            </span>
                        </div>
                        <h3 className="text-white/60 text-sm font-medium">{stat.title}</h3>
                        <p className={`text-2xl font-bold mt-1 ${headingColor}`}>{stat.value}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Activity Mockup */}
                <div className={`p-6 rounded-2xl border ${cardStyle} min-h-[300px]`}>
                    <h2 className={`text-xl font-bold mb-6 ${headingColor}`}>Recent Activity</h2>
                    <div className="space-y-4">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="flex items-center gap-4 p-3 rounded-lg hover:bg-white/5 transition-colors">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center text-xs">
                                    User
                                </div>
                                <div>
                                    <p className={`text-sm font-medium ${theme === 'jazz' ? 'text-[#D4AF37]/90' : 'text-slate-200'}`}>
                                        New playlist created by User#{100 + i}
                                    </p>
                                    <p className="text-xs text-white/40">2 minutes ago</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* System Health / Storage Mockup */}
                <div className={`p-6 rounded-2xl border ${cardStyle} min-h-[300px]`}>
                    <h2 className={`text-xl font-bold mb-6 ${headingColor}`}>System Status</h2>
                    <div className="space-y-6">
                        <div>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-white/70">Database Storage</span>
                                <span className="text-white/90">45%</span>
                            </div>
                            <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 w-[45%]" />
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-white/70">Memory Usage</span>
                                <span className="text-white/90">62%</span>
                            </div>
                            <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full bg-amber-500 w-[62%]" />
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-white/70">CPU Load</span>
                                <span className="text-white/90">28%</span>
                            </div>
                            <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 w-[28%]" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
