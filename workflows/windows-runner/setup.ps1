# Windows Automation Runner Setup Script
# 以管理员身份运行此脚本

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Windows 浏览器自动化 Runner 安装程序" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 创建目录结构
$baseDir = "C:\automation"
$dirs = @(
    "$baseDir",
    "$baseDir\profiles",
    "$baseDir\profiles\douyin",
    "$baseDir\profiles\weibo",
    "$baseDir\profiles\xiaohongshu",
    "$baseDir\profiles\shipinhao",
    "$baseDir\profiles\gongzhonghao",
    "$baseDir\profiles\zhihu",
    "$baseDir\profiles\toutiao_main",
    "$baseDir\profiles\toutiao_sub",
    "$baseDir\scripts",
    "$baseDir\logs"
)

Write-Host "[1/5] 创建目录结构..." -ForegroundColor Yellow
foreach ($dir in $dirs) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "  创建: $dir" -ForegroundColor Gray
    }
}
Write-Host "  ✓ 目录创建完成" -ForegroundColor Green

# 检查 Node.js
Write-Host ""
Write-Host "[2/5] 检查 Node.js..." -ForegroundColor Yellow
$nodeVersion = $null
try {
    $nodeVersion = node --version 2>$null
} catch {}

if ($nodeVersion) {
    Write-Host "  ✓ Node.js 已安装: $nodeVersion" -ForegroundColor Green
} else {
    Write-Host "  ✗ Node.js 未安装，正在下载..." -ForegroundColor Red
    $nodeInstaller = "$env:TEMP\node-installer.msi"
    Invoke-WebRequest -Uri "https://nodejs.org/dist/v20.10.0/node-v20.10.0-x64.msi" -OutFile $nodeInstaller
    Write-Host "  正在安装 Node.js..." -ForegroundColor Yellow
    Start-Process msiexec.exe -ArgumentList "/i", $nodeInstaller, "/quiet", "/norestart" -Wait
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    Write-Host "  ✓ Node.js 安装完成" -ForegroundColor Green
}

# 检查 Chrome
Write-Host ""
Write-Host "[3/5] 检查 Chrome..." -ForegroundColor Yellow
$chromePaths = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)
$chromePath = $null
foreach ($path in $chromePaths) {
    if (Test-Path $path) {
        $chromePath = $path
        break
    }
}

if ($chromePath) {
    Write-Host "  ✓ Chrome 已安装: $chromePath" -ForegroundColor Green
} else {
    Write-Host "  ✗ Chrome 未找到，请手动安装 Chrome 浏览器" -ForegroundColor Red
    Write-Host "  下载地址: https://www.google.com/chrome/" -ForegroundColor Yellow
}

# 复制文件并安装依赖
Write-Host ""
Write-Host "[4/5] 复制文件并安装依赖..." -ForegroundColor Yellow

# 复制当前目录的 JS 文件到 C:\automation
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$filesToCopy = @("runner.js", "llm-browser.js", "script-generator.js", "package.json")
foreach ($file in $filesToCopy) {
    $srcPath = Join-Path $scriptDir $file
    $dstPath = Join-Path $baseDir $file
    if (Test-Path $srcPath) {
        Copy-Item $srcPath $dstPath -Force
        Write-Host "  复制: $file" -ForegroundColor Gray
    }
}

# 安装 npm 依赖
Set-Location $baseDir
Write-Host "  安装 npm 依赖（这可能需要几分钟）..." -ForegroundColor Yellow
npm install 2>&1 | Out-Null
Write-Host "  ✓ 依赖安装完成" -ForegroundColor Green

# 创建配置文件
Write-Host ""
Write-Host "[5/5] 创建配置文件..." -ForegroundColor Yellow
$configPath = "$baseDir\config.json"
if (-not (Test-Path $configPath)) {
    $config = @{
        ANTHROPIC_API_KEY = "sk-ant-xxx（填入你的 Claude API Key）"
        RUNNER_API_KEY = "your-secret-key-change-this"
        CHROME_PATH = $chromePath
        PORT = 3000
        HEADLESS = $false
        TIMEOUT = 60000
        platforms = @{
            douyin = @{
                name = "抖音创作者"
                url = "https://creator.douyin.com"
                profile = "douyin"
            }
            weibo = @{
                name = "微博"
                url = "https://weibo.com"
                profile = "weibo"
            }
            xiaohongshu = @{
                name = "小红书创作者"
                url = "https://creator.xiaohongshu.com"
                profile = "xiaohongshu"
            }
            shipinhao = @{
                name = "视频号助手"
                url = "https://channels.weixin.qq.com"
                profile = "shipinhao"
            }
            gongzhonghao = @{
                name = "公众号后台"
                url = "https://mp.weixin.qq.com"
                profile = "gongzhonghao"
            }
            zhihu = @{
                name = "知乎创作者"
                url = "https://www.zhihu.com/creator"
                profile = "zhihu"
            }
            toutiao_main = @{
                name = "头条号主号"
                url = "https://mp.toutiao.com"
                profile = "toutiao_main"
            }
            toutiao_sub = @{
                name = "头条号副号"
                url = "https://mp.toutiao.com"
                profile = "toutiao_sub"
            }
        }
    }
    $config | ConvertTo-Json -Depth 10 | Set-Content $configPath -Encoding UTF8
    Write-Host "  ✓ 配置文件已创建: $configPath" -ForegroundColor Green
    Write-Host "  ⚠ 请编辑配置文件，填入你的 API Key！" -ForegroundColor Yellow
} else {
    Write-Host "  ✓ 配置文件已存在" -ForegroundColor Green
}

# 创建启动脚本
$startBat = "$baseDir\start_runner.bat"
@"
@echo off
cd /d C:\automation
node runner.js
pause
"@ | Set-Content $startBat -Encoding ASCII
Write-Host "  ✓ 启动脚本已创建: $startBat" -ForegroundColor Green

# 完成
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  安装完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "下一步操作：" -ForegroundColor Yellow
Write-Host "1. 编辑 C:\automation\config.json，填入你的 API Key" -ForegroundColor White
Write-Host "2. 运行 'node runner.js --login douyin' 登录各平台" -ForegroundColor White
Write-Host "3. 双击 start_runner.bat 启动服务" -ForegroundColor White
Write-Host ""
Write-Host "按任意键退出..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
