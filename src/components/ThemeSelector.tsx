import React from "react";
import { Sun, Moon, Palette, Check } from "lucide-react";

interface ThemeSelectorProps {
  currentTheme: string;
  onThemeChange: (theme: string) => void;
}

const themes = [
  { name: 'light', label: '亮色', icon: Sun },
  { name: 'dark', label: '暗色', icon: Moon },
  { name: 'cupcake', label: '纸杯蛋糕', icon: Palette },
  { name: 'bumblebee', label: '大黄蜂', icon: Palette },
  { name: 'emerald', label: '翡翠', icon: Palette },
  { name: 'corporate', label: '企业', icon: Palette },
  { name: 'synthwave', label: '合成波', icon: Palette },
  { name: 'retro', label: '复古', icon: Palette },
  { name: 'cyberpunk', label: '赛博朋克', icon: Palette },
  { name: 'valentine', label: '情人节', icon: Palette },
  { name: 'halloween', label: '万圣节', icon: Palette },
  { name: 'garden', label: '花园', icon: Palette },
  { name: 'forest', label: '森林', icon: Palette },
  { name: 'aqua', label: '水蓝', icon: Palette },
  { name: 'lofi', label: 'Lo-Fi', icon: Palette },
  { name: 'pastel', label: '粉彩', icon: Palette },
  { name: 'fantasy', label: '幻想', icon: Palette },
  { name: 'wireframe', label: '线框', icon: Palette },
  { name: 'black', label: '黑色', icon: Palette },
  { name: 'luxury', label: '奢华', icon: Palette },
  { name: 'dracula', label: '德古拉', icon: Palette },
  { name: 'cmyk', label: 'CMYK', icon: Palette },
  { name: 'autumn', label: '秋天', icon: Palette },
  { name: 'business', label: '商务', icon: Palette },
  { name: 'acid', label: '酸性', icon: Palette },
  { name: 'lemonade', label: '柠檬水', icon: Palette },
  { name: 'night', label: '夜晚', icon: Palette },
  { name: 'coffee', label: '咖啡', icon: Palette },
  { name: 'winter', label: '冬天', icon: Palette },
];

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({ currentTheme, onThemeChange }) => {
  const currentThemeData = themes.find(t => t.name === currentTheme) || themes[0];
  const CurrentIcon = currentThemeData.icon;

  return (
    <div className="dropdown dropdown-end">
      <div
        tabIndex={0}
        role="button"
        className="btn btn-ghost btn-circle"
        title="选择主题"
      >
        <CurrentIcon className="w-5 h-5 text-base-content" />
      </div>

      <ul
        tabIndex={0}
        className="dropdown-content menu bg-base-100 rounded-box z-[1] w-52 p-2 shadow-lg border border-base-300 max-h-96 overflow-y-auto"
      >
        <li className="menu-title">
          <span className="text-base-content">选择主题</span>
        </li>
        {themes.map((theme) => {
          const IconComponent = theme.icon;
          return (
            <li key={theme.name}>
              <button
                className={`flex items-center gap-3 ${currentTheme === theme.name ? 'active' : ''}`}
                onClick={() => onThemeChange(theme.name)}
              >
                <IconComponent className="w-4 h-4 text-base-content" />
                <span className="flex-1 text-base-content">{theme.label}</span>
                {currentTheme === theme.name && (
                  <Check className="w-4 h-4 text-base-content" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};