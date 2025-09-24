@echo off
REM Nexus AI Claude Edition - Windows Installer
REM Usage: install.bat

echo.
echo   ███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗
echo   ████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝
echo   ██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗
echo   ██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║
echo   ██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║
echo   ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝
echo.
echo   🤖 Claude Edition - Never Lose Work Again
echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

REM Check for Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js is required but not installed.
    echo    Please install Node.js from: https://nodejs.org
    pause
    exit /b 1
)

for /f "delims=" %%i in ('node --version') do set NODE_VERSION=%%i
echo ✅ Node.js detected: %NODE_VERSION%

REM Check for npm
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ npm is required but not installed.
    pause
    exit /b 1
)

for /f "delims=" %%i in ('npm --version') do set NPM_VERSION=%%i
echo ✅ npm detected: %NPM_VERSION%
echo.

echo 📦 Installing dependencies...
call npm install --quiet --no-fund --no-audit

echo 🔗 Creating global command...
call npm link

echo.
echo ✨ Installation complete!
echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo 🚀 Quick Start:
echo.
echo   nclaude init      # Initialize in current project
echo   nclaude status    # Check Claude context usage
echo   nclaude help      # Show all commands
echo.
echo 📚 Documentation: https://github.com/nexus-framework/nexus-ai-claude
echo.
echo 💡 Tip: Run 'nclaude init' in any project to protect your Claude sessions
echo.
pause