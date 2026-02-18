import React, { useState } from 'react';
import { Search, Music, Disc, MoreVertical, Play, Trash2, EyeOff } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface ContentItem {
    id: number;
    title: string;
    artist: string;
    type: 'TRACK' | 'PLAYLIST';
    status: 'PUBLIC' | 'HIDDEN';
    addedBy: string;
    date: string;
}

const ContentManagement: React.FC = () => {
    const { theme } = useTheme();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<'ALL' | 'TRACK' | 'PLAYLIST'>('ALL');

    // Mock Data
    const [content] = useState<ContentItem[]>([
        { id: 1, title: 'Summer Vibes 2024', artist: 'Various Artists', type: 'PLAYLIST', status: 'PUBLIC', addedBy: 'Admin User', date: '2024-05-01' },
        { id: 2, title: 'Jazz Night Essentials', artist: 'Miles Davis', type: 'TRACK', status: 'PUBLIC', addedBy: 'Jazz Cat', date: '2024-05-02' },
        { id: 3, title: 'Unknown Track #404', artist: 'Unknown', type: 'TRACK', status: 'HIDDEN', addedBy: 'System', date: '2024-04-20' },
        { id: 4, title: 'Workout Mix', artist: 'Gym Rat', type: 'PLAYLIST', status: 'PUBLIC', addedBy: 'John Doe', date: '2024-05-05' },
        { id: 5, title: 'Midnight Soul', artist: 'Aretha Franklin', type: 'TRACK', status: 'PUBLIC', addedBy: 'Soul Sister', date: '2024-05-10' },
    ]);

    const filteredContent = content.filter(item => {
        const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.artist.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = filterType === 'ALL' || item.type === filterType;
        return matchesSearch && matchesType;
    });

    const tableHeaderStyle = theme === 'jazz'
        ? 'bg-[#D4AF37]/10 text-[#D4AF37]'
        : theme === 'soul'
            ? 'bg-[#93C5FD]/10 text-[#93C5FD]'
            : 'bg-slate-800 text-slate-300';

    const rowStyle = theme === 'jazz'
        ? 'border-b border-[#D4AF37]/10 hover:bg-[#D4AF37]/5'
        : theme === 'soul'
            ? 'border-b border-[#93C5FD]/10 hover:bg-[#93C5FD]/5'
            : 'border-b border-slate-800 hover:bg-slate-800/50';

    const textColor = theme === 'jazz' ? 'text-[#D4AF37]' : theme === 'soul' ? 'text-[#93C5FD]' : 'text-slate-200';
    const subTextColor = theme === 'jazz' ? 'text-[#D4AF37]/60' : theme === 'soul' ? 'text-[#93C5FD]/60' : 'text-slate-500';

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className={`text-3xl font-bold ${textColor}`}>Content Management</h1>
                    <p className={subTextColor}>Manage tracks, playlists, and reported content.</p>
                </div>
            </div>

            {/* Controls: Search & Filter */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${subTextColor}`} />
                    <input
                        type="text"
                        placeholder="Search content..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className={`w-full pl-12 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 transition-all ${theme === 'jazz'
                                ? 'bg-[#2C1F16]/50 border border-[#D4AF37]/20 text-[#D4AF37] placeholder-[#D4AF37]/40 focus:ring-[#D4AF37]/50'
                                : theme === 'soul'
                                    ? 'bg-[#1E293B]/50 border border-[#93C5FD]/20 text-[#93C5FD] placeholder-[#93C5FD]/40 focus:ring-[#93C5FD]/50'
                                    : 'bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-500 focus:ring-cyan-500/50'
                            }`}
                    />
                </div>

                <div className={`flex rounded-xl p-1 border ${theme === 'jazz' ? 'bg-[#2C1F16]/50 border-[#D4AF37]/20' :
                        theme === 'soul' ? 'bg-[#1E293B]/50 border-[#93C5FD]/20' :
                            'bg-slate-800 border-slate-700'
                    }`}>
                    {(['ALL', 'TRACK', 'PLAYLIST'] as const).map((type) => (
                        <button
                            key={type}
                            onClick={() => setFilterType(type)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filterType === type
                                    ? (theme === 'jazz' ? 'bg-[#D4AF37] text-[#1A0B05]' : theme === 'soul' ? 'bg-[#93C5FD] text-[#0F172A]' : 'bg-cyan-500 text-slate-950')
                                    : (theme === 'jazz' ? 'text-[#D4AF37]/60 hover:text-[#D4AF37]' : theme === 'soul' ? 'text-[#93C5FD]/60 hover:text-[#93C5FD]' : 'text-slate-400 hover:text-slate-200')
                                }`}
                        >
                            {type}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Table */}
            <div className={`rounded-xl border overflow-hidden ${theme === 'jazz' ? 'border-[#D4AF37]/20 bg-[#2C1F16]/30' :
                    theme === 'soul' ? 'border-[#93C5FD]/20 bg-[#1E293B]/30' :
                        'border-slate-800 bg-slate-900/50'
                }`}>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className={tableHeaderStyle}>
                                <th className="px-6 py-4 font-medium">Title / Artist</th>
                                <th className="px-6 py-4 font-medium">Type</th>
                                <th className="px-6 py-4 font-medium">Status</th>
                                <th className="px-6 py-4 font-medium">Added By</th>
                                <th className="px-6 py-4 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredContent.map((item) => (
                                <tr key={item.id} className={`transition-colors ${rowStyle}`}>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${theme === 'jazz' ? 'bg-[#D4AF37]/10 text-[#D4AF37]' :
                                                    theme === 'soul' ? 'bg-[#93C5FD]/10 text-[#93C5FD]' :
                                                        'bg-slate-700 text-slate-300'
                                                }`}>
                                                {item.type === 'PLAYLIST' ? <Disc size={20} /> : <Music size={20} />}
                                            </div>
                                            <div>
                                                <div className={`font-medium ${textColor}`}>{item.title}</div>
                                                <div className={`text-xs ${subTextColor}`}>{item.artist}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`text-xs font-medium px-2 py-1 rounded border ${item.type === 'PLAYLIST'
                                                ? (theme === 'jazz' ? 'border-[#D4AF37]/30 text-[#D4AF37]' : 'border-purple-500/30 text-purple-400')
                                                : (theme === 'jazz' ? 'border-[#C5A028]/30 text-[#C5A028]' : 'border-cyan-500/30 text-cyan-400')
                                            }`}>
                                            {item.type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${item.status === 'PUBLIC'
                                                ? 'bg-emerald-500/10 text-emerald-400'
                                                : 'bg-slate-500/10 text-slate-400'
                                            }`}>
                                            {item.status}
                                        </span>
                                    </td>
                                    <td className={`px-6 py-4 text-sm ${subTextColor}`}>
                                        <div className="flex flex-col">
                                            <span>{item.addedBy}</span>
                                            <span className="text-xs opacity-50">{item.date}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button className={`p-2 rounded-lg transition-colors ${theme === 'jazz' ? 'hover:bg-[#D4AF37]/20 text-[#D4AF37]' : 'hover:bg-slate-700 text-slate-400'
                                                }`} title="Preview">
                                                <Play size={16} />
                                            </button>
                                            <button className={`p-2 rounded-lg transition-colors ${theme === 'jazz' ? 'hover:bg-[#D4AF37]/20 text-[#D4AF37]' : 'hover:bg-slate-700 text-slate-400'
                                                }`} title="Hide">
                                                <EyeOff size={16} />
                                            </button>
                                            <button className="p-2 rounded-lg transition-colors hover:bg-red-500/20 text-red-400" title="Delete">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ContentManagement;
