import React, { useState } from 'react';
import { Search, User, MoreVertical, Shield, Ban, CheckCircle } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface UserData {
    id: number;
    name: string;
    email: string;
    role: 'MASTER' | 'ADMIN' | 'USER';
    grade: '1' | '2' | '3' | '4' | '5'; // 1등급 ~ 5등급
    status: 'ACTIVE' | 'INACTIVE';
    joinDate: string;
}

const UserManagement: React.FC = () => {
    const { theme } = useTheme();
    const [searchTerm, setSearchTerm] = useState('');

    // Mock User Data
    const [users] = useState<UserData[]>([
        { id: 1, name: 'Jo Woo Sung', email: 'jowoosung@gmail.com', role: 'MASTER', grade: '1', status: 'ACTIVE', joinDate: '2023-01-01' },
        { id: 2, name: 'Admin User', email: 'admin@musicspace.com', role: 'ADMIN', grade: '2', status: 'ACTIVE', joinDate: '2023-01-05' },
        { id: 3, name: 'John Doe', email: 'john@example.com', role: 'USER', grade: '3', status: 'ACTIVE', joinDate: '2023-05-15' },
        { id: 4, name: 'Jane Smith', email: 'jane@example.com', role: 'USER', grade: '4', status: 'INACTIVE', joinDate: '2023-06-20' },
        { id: 5, name: 'Music Lover', email: 'lover@music.com', role: 'USER', grade: '5', status: 'ACTIVE', joinDate: '2023-07-02' },
        { id: 6, name: 'Jazz Cat', email: 'jazz@cat.com', role: 'USER', grade: '3', status: 'ACTIVE', joinDate: '2023-08-10' },
    ]);

    const filteredUsers = users.filter(user =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

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
                    <h1 className={`text-3xl font-bold ${textColor}`}>User Management</h1>
                    <p className={subTextColor}>Manage platform users and permissions.</p>
                </div>
                <button className={`px-4 py-2 rounded-lg font-medium transition-colors ${theme === 'jazz'
                    ? 'bg-[#D4AF37] text-[#1A0B05] hover:bg-[#C5A028]'
                    : theme === 'soul'
                        ? 'bg-[#93C5FD] text-[#0F172A] hover:bg-[#60A5FA]'
                        : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
                    }`}>
                    Add New User
                </button>
            </div>

            {/* Search Bar */}
            <div className="relative">
                <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${subTextColor}`} />
                <input
                    type="text"
                    placeholder="Search users..."
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

            {/* Users Table */}
            <div className={`rounded-xl border overflow-hidden ${theme === 'jazz' ? 'border-[#D4AF37]/20 bg-[#2C1F16]/30' :
                theme === 'soul' ? 'border-[#93C5FD]/20 bg-[#1E293B]/30' :
                    'border-slate-800 bg-slate-900/50'
                }`}>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className={tableHeaderStyle}>
                                <th className="px-6 py-4 font-medium">User</th>
                                <th className="px-6 py-4 font-medium">Role</th>
                                <th className="px-6 py-4 font-medium">Status</th>
                                <th className="px-6 py-4 font-medium">Joined</th>
                                <th className="px-6 py-4 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map((user) => (
                                <tr key={user.id} className={`transition-colors ${rowStyle}`}>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${theme === 'jazz' ? 'bg-[#D4AF37]/20 text-[#D4AF37]' :
                                                theme === 'soul' ? 'bg-[#93C5FD]/20 text-[#93C5FD]' :
                                                    'bg-slate-700 text-slate-300'
                                                }`}>
                                                <User size={20} />
                                            </div>
                                            <div>
                                                <div className={`font-medium ${textColor}`}>{user.name}</div>
                                                <div className={`text-xs ${subTextColor}`}>{user.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${user.role === 'ADMIN'
                                            ? (theme === 'jazz' ? 'bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/30' : 'bg-purple-500/20 text-purple-400 border-purple-500/30')
                                            : (theme === 'jazz' ? 'bg-white/5 text-[#D4AF37]/70 border-white/5' : 'bg-slate-800 text-slate-400 border-slate-700')
                                            }`}>
                                            {user.role === 'ADMIN' && <Shield size={12} />}
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${user.status === 'ACTIVE'
                                            ? 'bg-emerald-500/10 text-emerald-400'
                                            : 'bg-red-500/10 text-red-400'
                                            }`}>
                                            {user.status === 'ACTIVE' ? <CheckCircle size={12} /> : <Ban size={12} />}
                                            {user.status}
                                        </span>
                                    </td>
                                    <td className={`px-6 py-4 text-sm ${subTextColor}`}>
                                        {user.joinDate}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button className={`p-2 rounded-lg transition-colors ${theme === 'jazz' ? 'hover:bg-[#D4AF37]/20 text-[#D4AF37]' : 'hover:bg-slate-700 text-slate-400'
                                            }`}>
                                            <MoreVertical size={18} />
                                        </button>
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

export default UserManagement;
