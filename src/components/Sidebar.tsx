import React from 'react';
import {
    CloudUpload,
    History,
    Zap,
    Settings,
    Moon,
    Sun,
    Globe
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { Language, languages } from '../i18n';

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
    const { language, setLanguage, t } = useLanguage();

    const menuItems = [
        { id: 'upload', label: t.sidebar.imageUpload, icon: CloudUpload },
        { id: 'history', label: t.sidebar.uploadHistory, icon: History },
        { type: 'divider' },
        { id: 'compress', label: t.sidebar.imageCompression, icon: Zap },
        { id: 'compress-history', label: t.sidebar.compressionHistory, icon: History },
        { type: 'divider' },
        { id: 'config', label: t.sidebar.settings, icon: Settings },
    ];

    const toggleLanguage = () => {
        const newLang: Language = language === 'en' ? 'zh' : 'en';
        setLanguage(newLang);
    };

    return (
        <aside className="w-60 flex-shrink-0 bg-gray-50 dark:bg-gray-900/50 p-4 border-r border-gray-200 dark:border-gray-800 flex flex-col h-full drag-region">
            {/* App Title / Logo Area */}
            <div className="flex items-center gap-3 px-3 mb-6 mt-2 no-drag">
                <img src="/molitutu_logo.png" alt="Moli TuTu Logo" className="h-8 w-8 rounded-lg shadow-sm object-cover" />
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
            <div className="pt-4 mt-auto border-t border-gray-200 dark:border-gray-800 no-drag space-y-1">
                {/* Language Toggle */}
                <button
                    onClick={toggleLanguage}
                    className="flex items-center gap-3 px-3 py-2 w-full rounded-md text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800/60 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                    <Globe className="w-5 h-5 opacity-70" />
                    <span>{languages[language]}</span>
                </button>

                {/* Theme Toggle */}
                <button
                    onClick={() => onThemeChange(theme === 'dark' ? 'light' : 'dark')}
                    className="flex items-center gap-3 px-3 py-2 w-full rounded-md text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800/60 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                    {theme === 'dark' ? (
                        <>
                            <Sun className="w-5 h-5 opacity-70" />
                            <span>{t.sidebar.lightMode}</span>
                        </>
                    ) : (
                        <>
                            <Moon className="w-5 h-5 opacity-70" />
                            <span>{t.sidebar.darkMode}</span>
                        </>
                    )}
                </button>
            </div>
        </aside>
    );
};
