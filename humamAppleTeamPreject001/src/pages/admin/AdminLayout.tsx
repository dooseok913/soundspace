import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Music, Settings, LogOut, Home } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

const AdminLayout: React.FC = () => {
    const navigate = useNavigate();
    const { theme } = useTheme();

    // Admin-specific theme styles (Darker/Technical look)
    // We can leverage existing theme variables but maybe force a specific look or adapt
    const bgStyle = theme === 'jazz'
        ? 'bg-[#1A0B05] text-[#D4AF37]'
        : theme === 'soul'
            ? 'bg-[#0F172A] text-[#93C5FD]'
            : 'bg-slate-900 text-slate-100';

    const sidebarStyle = theme === 'jazz'
        ? 'bg-[#2C1F16]/90 border-[#D4AF37]/20'
        : theme === 'soul'
            ? 'bg-[#1E293B]/90 border-[#93C5FD]/20'
            : 'bg-slate-950/90 border-slate-800';

    const activeLinkStyle = theme === 'jazz'
        ? 'bg-[#D4AF37]/20 text-[#D4AF37] border-r-2 border-[#D4AF37]'
        : theme === 'soul'
            ? 'bg-[#93C5FD]/20 text-[#93C5FD] border-r-2 border-[#93C5FD]'
            : 'bg-cyan-500/20 text-cyan-400 border-r-2 border-cyan-500';

    const inactiveLinkStyle = theme === 'jazz'
        ? 'text-[#D4AF37]/60 hover:bg-[#D4AF37]/10 hover:text-[#D4AF37]'
        : theme === 'soul'
            ? 'text-[#93C5FD]/60 hover:bg-[#93C5FD]/10 hover:text-[#93C5FD]'
            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200';

    return (
        <div className={`flex h-screen w-full overflow-hidden ${bgStyle} transition-colors duration-500`}>
            {/* Admin Sidebar */}
            <aside className={`w-64 flex-shrink-0 border-r backdrop-blur-xl flex flex-col ${sidebarStyle} transition-colors duration-500`}>
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-8">
                        <div className={`p-2 rounded-lg ${theme === 'jazz' ? 'bg-[#D4AF37]' : theme === 'soul' ? 'bg-[#93C5FD]' : 'bg-cyan-500'}`}>
                            <LayoutDashboard className={`w-6 h-6 ${theme === 'jazz' ? 'text-[#1A0B05]' : theme === 'soul' ? 'text-[#0F172A]' : 'text-slate-950'}`} />
                        </div>
                        <span className="font-bold text-xl tracking-tight">Admin<span className="opacity-50 font-normal">Panel</span></span>
                    </div>

                    <nav className="space-y-2">
                        <NavLink to="/admin" end className={({ isActive }) =>
                            `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 ${isActive ? activeLinkStyle : inactiveLinkStyle}`
                        }>
                            <LayoutDashboard size={20} />
                            <span>Dashboard</span>
                        </NavLink>

                        <NavLink to="/admin/users" className={({ isActive }) =>
                            `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 ${isActive ? activeLinkStyle : inactiveLinkStyle}`
                        }>
                            <Users size={20} />
                            <span>Users</span>
                        </NavLink>

                        <NavLink to="/admin/content" className={({ isActive }) =>
                            `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 ${isActive ? activeLinkStyle : inactiveLinkStyle}`
                        }>
                            <Music size={20} />
                            <span>Content</span>
                        </NavLink>

                        <NavLink to="/admin/settings" className={({ isActive }) =>
                            `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 ${isActive ? activeLinkStyle : inactiveLinkStyle}`
                        }>
                            <Settings size={20} />
                            <span>Settings</span>
                        </NavLink>
                    </nav>
                </div>

                <div className="mt-auto p-6 border-t border-white/5 space-y-2">
                    <button
                        onClick={() => navigate('/music')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 ${inactiveLinkStyle}`}
                    >
                        <Home size={20} />
                        <span>Back to App</span>
                    </button>
                    <button
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 text-red-400 hover:bg-red-500/10 hover:text-red-300`}
                    >
                        <LogOut size={20} />
                        <span>Logout</span>
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto relative">
                {/* Background Gradients/Effects could go here */}
                <div className="p-8 pb-20">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default AdminLayout;
