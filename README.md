# Moli TuTu 🖼️

一个集图片压缩与图床上传于一体的工具，支持智能压缩优化和 Cloudflare R2 存储服务。

## ✨ 特性

- 🎨 现代化的用户界面
- 🖼️ 支持拖拽上传图片
- 🗜️ **智能图片压缩** - 自动优化图片大小，节省存储空间
- ☁️ Cloudflare R2 存储集成
- 📋 一键复制图片链接
- 🔧 简单的配置管理
- 🚀 跨平台支持（Windows、macOS）
- ⚡ 快速批量处理

## 📦 安装

### 从 Release 下载

1. 前往 [Releases](https://github.com/gusibi/moli-tutu/releases) 页面
2. 下载对应平台的安装包：
   - **Windows**: `.msi` 文件
   - **macOS**: `.dmg` 文件（支持 Intel 和 Apple Silicon）
3. 双击安装包按提示安装

### 从源码构建

```bash
# 克隆仓库
git clone https://github.com/gusibi/moli-tutu.git
cd MoliTutu

# 安装依赖
npm install

# 开发模式运行
npm run tauri dev

# 构建应用
npm run tauri build
```

## 🔧 配置

首次运行时，点击"R2 配置"按钮，填入你的 Cloudflare R2 配置信息：

- **Endpoint**: R2 存储桶的端点 URL
- **Access Key ID**: R2 访问密钥 ID
- **Secret Access Key**: R2 秘密访问密钥
- **Bucket Name**: 存储桶名称
- **Region**: 区域（通常为 auto）

## 🚀 使用

1. 启动应用
2. 拖拽图片到上传区域，或点击选择文件
3. 应用会自动压缩图片以优化文件大小
4. 等待上传完成
5. 点击复制按钮获取图片链接

### 📸 图片压缩功能

- **自动压缩**: 上传时自动优化图片大小，减少存储成本
- **智能算法**: 在保持图片质量的同时最大化压缩效果
- **多格式支持**: 支持 JPEG、PNG、WebP 等常见图片格式
- **批量处理**: 可同时处理多张图片
- **压缩预览**: 显示压缩前后的文件大小对比

## 🛠️ 技术栈

- **前端**: React + TypeScript + Tailwind CSS + DaisyUI
- **后端**: Rust + Tauri
- **存储**: Cloudflare R2
- **构建**: Vite + Tauri CLI

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📞 支持

如有问题，请在 [Issues](https://github.com/gusibi/moli-tutu/issues) 页面提交。