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
        { id: 'upload', label: 'Image Upload', icon: CloudUpload },
        { id: 'history', label: 'Upload History', icon: History },
        { type: 'divider' },
        { id: 'compress', label: 'Image Compression', icon: Zap },
        { id: 'compress-history', label: 'Compression History', icon: History },
        { type: 'divider' },
        { id: 'config', label: 'Settings', icon: Settings },
    ];

    return (
        <aside className="w-60 flex-shrink-0 bg-gray-50 dark:bg-gray-900/50 p-4 border-r border-gray-200 dark:border-gray-800 flex flex-col h-full drag-region">
            {/* App Title / Logo Area */}
            <div className="flex items-center gap-3 px-3 mb-6 mt-2 no-drag">
                <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-white shadow-sm">
                    <CloudUpload className="w-5 h-5" />
                </div>
                <h1 className="font-bold text-lg text-gray-900 dark:text-white tracking-tight">Moli TuTu</h1>
            </div>

            {/* Navigation Menu */}
            <nav className="flex-1 flex flex-col space-y-1 overflow-y-auto no-drag">
                {menuItems.map((item, index) => {
                    if (item.type === 'divider') {
                        return <div key={`divider-${index}`} className="h-px bg-gray-200 dark:bg-gray-800 mx-3 my-3" />;
                    }

                    const Icon = item.icon as React.ElementType;
                    const isActive = activeTab === item.id;

                    return (
                        <button
                            key={item.id}
                            onClick={() => onTabChange(item.id as any)}
                            className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors w-full text-left ${isActive
                                    ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-white font-semibold'
                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800/60 hover:text-gray-900 dark:hover:text-white'
                                }`}
                        >
                            <Icon className={`w-5 h-5 ${isActive ? '' : 'opacity-70'}`} />
                            <span>{item.label}</span>
                        </button>
                    );
                })}
            </nav>

            {/* Bottom Actions */}
            <div className="pt-4 mt-auto border-t border-gray-200 dark:border-gray-800 no-drag">
                <button
                    onClick={() => onThemeChange(theme === 'dark' ? 'light' : 'dark')}
                    className="flex items-center gap-3 px-3 py-2 w-full rounded-md text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800/60 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                    {theme === 'dark' ? (
                        <>
                            <Sun className="w-5 h-5 opacity-70" />
                            <span>Light Mode</span>
                        </>
                    ) : (
                        <>
                            <Moon className="w-5 h-5 opacity-70" />
                            <span>Dark Mode</span>
                        </>
                    )}
                </button>
            </div>
        </aside>
    );
};
