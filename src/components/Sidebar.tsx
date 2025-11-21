import React from 'react';
import {
    CloudUpload,
    History,
    Zap,
    Settings,
    Moon,
    Sun
} from 'lucide-react';

interface SidebarProps {
    theme: string;
    activeTab: 'upload' | 'history' | 'config' | 'compress' | 'compress-history';
    onThemeChange: (theme: string) => void;
    onTabChange: (tab: 'upload' | 'history' | 'config' | 'compress' | 'compress-history') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
    theme,
    activeTab,
    onThemeChange,
    onTabChange
}) => {
    const menuItems = [
        { id: 'upload', label: '上传图片', icon: CloudUpload },
        { id: 'history', label: '上传记录', icon: History },
        { type: 'divider' },
        { id: 'compress', label: '图片压缩', icon: Zap },
        { id: 'compress-history', label: '压缩记录', icon: History },
        { type: 'divider' },
        { id: 'config', label: '图床配置', icon: Settings },
    ];

    return (
        <aside className="mac-sidebar drag-region">
            {/* App Title / Logo Area */}
            <div className="px-6 mb-6 mt-2 flex items-center gap-3 no-drag">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-content shadow-md">
                    <CloudUpload className="w-5 h-5" />
                </div>
                <h1 className="font-bold text-lg tracking-tight">Moli TuTu</h1>
            </div>

            {/* Navigation Menu */}
            <nav className="flex-1 px-2 space-y-1 overflow-y-auto no-drag">
                {menuItems.map((item, index) => {
                    if (item.type === 'divider') {
                        return <div key={`divider-${index}`} className="h-px bg-base-300 mx-4 my-3" />;
                    }

                    const Icon = item.icon as React.ElementType;
                    const isActive = activeTab === item.id;

                    return (
                        <button
                            key={item.id}
                            onClick={() => onTabChange(item.id as any)}
                            className={`sidebar-item w-full ${isActive ? 'active' : ''}`}
                        >
                            <Icon className={`w-4 h-4 ${isActive ? '' : 'opacity-70'}`} />
                            <span>{item.label}</span>
                        </button>
                    );
                })}
            </nav>

            {/* Bottom Actions */}
            <div className="p-4 border-t border-base-300 no-drag">
                <button
                    onClick={() => onThemeChange(theme === 'dark' ? 'light' : 'dark')}
                    className="flex items-center gap-3 px-3 py-2 w-full rounded-md text-sm font-medium text-base-content/70 hover:bg-base-200 hover:text-base-content transition-colors"
                >
                    {theme === 'dark' ? (
                        <>
                            <Sun className="w-4 h-4" />
                            <span>浅色模式</span>
                        </>
                    ) : (
                        <>
                            <Moon className="w-4 h-4" />
                            <span>深色模式</span>
                        </>
                    )}
                </button>
            </div>
        </aside>
    );
};
