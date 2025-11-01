import React from 'react';
import { 
  CloudUpload, 
  Upload, 
  History, 
  Zap, 
  Settings, 
  ChevronDown
} from 'lucide-react';

interface NavigationProps {
  theme: string;
  activeTab: 'upload' | 'history' | 'config' | 'compress' | 'compress-history';
  onThemeChange: (theme: string) => void;
  onTabChange: (tab: 'upload' | 'history' | 'config' | 'compress' | 'compress-history') => void;
}

const Navigation: React.FC<NavigationProps> = ({
  theme,
  activeTab,
  onThemeChange,
  onTabChange
}) => {
  return (
    <div className="navbar bg-base-100 shadow-sm">
      <div className="navbar-start">
        <div className="flex items-center gap-3">
          <CloudUpload className="w-8 h-8 text-primary" />
          <h1 className="text-xl font-bold text-base-content">Moli TuTu</h1>
        </div>
      </div>
      
      <div className="navbar-end">
        <div className="flex items-center gap-4">
          {/* daisyUI 主题切换组件 */}
          <label className="toggle text-base-content">
            <input 
              type="checkbox" 
              checked={theme === 'dark'}
              onChange={(e) => onThemeChange(e.target.checked ? 'dark' : 'light')}
              className="theme-controller" 
            />

            <svg aria-label="sun" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <g strokeLinejoin="round" strokeLinecap="round" strokeWidth="2" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="4"></circle>
                <path d="M12 2v2"></path>
                <path d="M12 20v2"></path>
                <path d="m4.93 4.93 1.41 1.41"></path>
                <path d="m17.66 17.66 1.41 1.41"></path>
                <path d="M2 12h2"></path>
                <path d="M20 12h2"></path>
                <path d="m6.34 17.66-1.41 1.41"></path>
                <path d="m19.07 4.93-1.41 1.41"></path>
              </g>
            </svg>

            <svg aria-label="moon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <g strokeLinejoin="round" strokeLinecap="round" strokeWidth="2" fill="none" stroke="currentColor">
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>
              </g>
            </svg>
          </label>
          
          {/* 导航菜单 */}
          <div className="flex items-center gap-2">
            {/* 上传功能下拉菜单 */}
            <div className="dropdown dropdown-end">
              <div 
                tabIndex={0} 
                role="button" 
                className={`btn btn-ghost gap-2 ${(activeTab === 'upload' || activeTab === 'history') ? 'btn-active' : ''}`}
              >
                <Upload className="w-4 h-4 text-base-content" />
                <span className="text-base-content">上传</span>
                <ChevronDown className="w-4 h-4 text-base-content" />
              </div>
              <ul tabIndex={0} className="dropdown-content menu bg-base-100 rounded-box z-[1] w-52 p-2 shadow">
                <li>
                  <button
                    onClick={() => onTabChange('upload')}
                    className={`gap-2 ${activeTab === 'upload' ? 'active' : ''}`}
                  >
                    <Upload className="w-4 h-4" />
                    上传图片
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => onTabChange('history')}
                    className={`gap-2 ${activeTab === 'history' ? 'active' : ''}`}
                  >
                    <History className="w-4 h-4" />
                    上传记录
                  </button>
                </li>
              </ul>
            </div>

            {/* 图片压缩下拉菜单 */}
            <div className="dropdown dropdown-end">
              <div 
                tabIndex={0} 
                role="button" 
                className={`btn btn-ghost gap-2 ${(activeTab === 'compress' || activeTab === 'compress-history') ? 'btn-active' : ''}`}
              >
                <Zap className="w-4 h-4 text-base-content" />
                <span className="text-base-content">压缩</span>
                <ChevronDown className="w-4 h-4 text-base-content" />
              </div>
              <ul tabIndex={0} className="dropdown-content menu bg-base-100 rounded-box z-[1] w-52 p-2 shadow">
                <li>
                  <button
                    onClick={() => onTabChange('compress')}
                    className={`gap-2 ${activeTab === 'compress' ? 'active' : ''}`}
                  >
                    <Zap className="w-4 h-4" />
                    图片压缩
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => onTabChange('compress-history')}
                    className={`gap-2 ${activeTab === 'compress-history' ? 'active' : ''}`}
                  >
                    <History className="w-4 h-4" />
                    压缩记录
                  </button>
                </li>
              </ul>
            </div>

            {/* 设置下拉菜单 */}
            <div className="dropdown dropdown-end">
              <div 
                tabIndex={0} 
                role="button" 
                className={`btn btn-ghost gap-2 ${activeTab === 'config' ? 'btn-active' : ''}`}
              >
                <Settings className="w-4 h-4 text-base-content" />
                <span className="text-base-content">设置</span>
                <ChevronDown className="w-4 h-4 text-base-content" />
              </div>
              <ul tabIndex={0} className="dropdown-content menu bg-base-100 rounded-box z-[1] w-52 p-2 shadow">
                <li>
                  <button
                    onClick={() => onTabChange('config')}
                    className={`gap-2 ${activeTab === 'config' ? 'active' : ''}`}
                  >
                    <CloudUpload className="w-4 h-4" />
                    图床配置
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Navigation;