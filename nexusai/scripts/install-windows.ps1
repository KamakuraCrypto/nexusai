# Nexus AI - Windows Installation Script
# https://github.com/KamakuraCrypto/nexusai

param(
    [switch]$NoService = $false,
    [string]$InstallDir = "$env:USERPROFILE\nexusai",
    [string]$ProjectRoot = $PWD
)

# Colors for output
$Green = [System.ConsoleColor]::Green
$Red = [System.ConsoleColor]::Red
$Yellow = [System.ConsoleColor]::Yellow
$Blue = [System.ConsoleColor]::Blue

function Write-ColorText {
    param([string]$Text, [System.ConsoleColor]$Color = [System.ConsoleColor]::White)
    $originalColor = $Host.UI.RawUI.ForegroundColor
    $Host.UI.RawUI.ForegroundColor = $Color
    Write-Host $Text
    $Host.UI.RawUI.ForegroundColor = $originalColor
}

function Test-Command {
    param([string]$Command)
    try {
        Get-Command $Command -ErrorAction Stop | Out-Null
        return $true
    } catch {
        return $false
    }
}

# Configuration
$RepoUrl = "https://github.com/KamakuraCrypto/nexusai.git"

Write-ColorText "🧠 Nexus AI - Windows Installer" $Blue
Write-ColorText "=========================================================" $Blue
Write-Host ""

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")

if (-not $NoService -and -not $isAdmin) {
    Write-ColorText "⚠️  Running without administrator privileges" $Yellow
    Write-ColorText "Windows Service installation will not be available" $Yellow
    Write-ColorText "Run as Administrator to enable service installation" $Yellow
    Write-Host ""
}

# Check prerequisites
Write-ColorText "📋 Checking prerequisites..." $Yellow

# Check Node.js
if (-not (Test-Command "node")) {
    Write-ColorText "❌ Node.js not found" $Red
    Write-Host "Please install Node.js (v16.0.0 or higher) first:"
    Write-Host "  Download from: https://nodejs.org/"
    Write-Host "  Or use winget: winget install OpenJS.NodeJS"
    exit 1
}

$nodeVersion = node --version
$nodeMajor = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
if ($nodeMajor -lt 16) {
    Write-ColorText "❌ Node.js version $nodeVersion is too old" $Red
    Write-Host "Please upgrade to Node.js v16.0.0 or higher"
    exit 1
}

Write-ColorText "✅ Node.js $nodeVersion found" $Green

# Check npm
if (-not (Test-Command "npm")) {
    Write-ColorText "❌ npm not found" $Red
    Write-Host "Please install npm (usually comes with Node.js)"
    exit 1
}

$npmVersion = npm --version
Write-ColorText "✅ npm $npmVersion found" $Green

# Check git
if (-not (Test-Command "git")) {
    Write-ColorText "❌ git not found" $Red
    Write-Host "Please install git first:"
    Write-Host "  Download from: https://git-scm.com/"
    Write-Host "  Or use winget: winget install Git.Git"
    exit 1
}

Write-ColorText "✅ git found" $Green

# Check Windows Service capability
$serviceAvailable = $isAdmin -and (-not $NoService)
if ($serviceAvailable) {
    Write-ColorText "✅ Windows Service capability available" $Green
} else {
    Write-ColorText "⚠️  Windows Service not available (run as Administrator to enable)" $Yellow
}

Write-Host ""

# Clone or update repository
Write-ColorText "📦 Installing Nexus AI..." $Yellow

if (Test-Path $InstallDir) {
    Write-ColorText "📁 Nexus AI directory exists, updating..." $Yellow
    Set-Location $InstallDir
    git pull origin main
} else {
    Write-ColorText "📁 Cloning Nexus AI repository..." $Yellow
    git clone $RepoUrl $InstallDir
    Set-Location $InstallDir
}

# Install dependencies
Write-ColorText "📦 Installing dependencies..." $Yellow
npm install --production

Write-ColorText "✅ Nexus AI installed successfully" $Green
Write-Host ""

# Initialize in current project
Write-ColorText "🚀 Initializing Nexus AI in current project..." $Yellow
Set-Location $ProjectRoot

# Create batch file for nclaude command
$nexusBin = "$InstallDir\nexusai\bin\nclaude.js"
$localBat = ".\nclaude.bat"

if (Test-Path $localBat) {
    Remove-Item $localBat -Force
}

@"
@echo off
node "$nexusBin" %*
"@ | Out-File -FilePath $localBat -Encoding ASCII

Write-ColorText "✅ Created nclaude.bat command" $Green

# Initialize the system
Write-ColorText "🔧 Initializing memory system..." $Yellow
& node $nexusBin init --memory-only

# Setup Windows Service (optional)
if ($serviceAvailable) {
    Write-Host ""
    Write-ColorText "⚙️  Windows Service Setup" $Yellow
    $installService = Read-Host "Do you want to install the Windows Service for 24/7 file monitoring? (y/N)"
    
    if ($installService -eq "y" -or $installService -eq "Y") {
        Write-ColorText "📋 Installing Windows Service..." $Yellow
        
        try {
            # Create service wrapper script
            $serviceScript = "$InstallDir\nexusai\services\nexus-service-wrapper.bat"
            @"
@echo off
cd /d "$ProjectRoot"
node "$InstallDir\nexusai\daemon\nexus-watcher.js"
"@ | Out-File -FilePath $serviceScript -Encoding ASCII
            
            # Install service using sc command
            $serviceName = "NexusAI-Watcher-$env:USERNAME"
            $displayName = "Nexus AI File Watcher ($env:USERNAME)"
            $description = "Nexus AI Everlasting Memory System - File Monitoring Service"
            
            & sc.exe create $serviceName binPath= $serviceScript start= auto DisplayName= $displayName
            & sc.exe description $serviceName $description
            
            # Start service
            Write-ColorText "🚀 Starting Nexus AI service..." $Yellow
            & sc.exe start $serviceName
            
            # Check status
            $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
            if ($service -and $service.Status -eq "Running") {
                Write-ColorText "✅ Windows Service installed and started successfully" $Green
            } else {
                Write-ColorText "❌ Windows Service failed to start" $Red
                Write-Host "Check Event Viewer for details"
            }
            
        } catch {
            Write-ColorText "❌ Failed to install Windows Service: $_" $Red
        }
    } else {
        Write-ColorText "⏭️  Skipping Windows Service installation" $Yellow
        Write-Host "You can start the daemon manually with:"
        Write-Host "  .\nexus-memory.bat daemon start --background"
    }
}

Write-Host ""
Write-ColorText "🎉 Installation Complete!" $Green
Write-ColorText "========================" $Green
Write-Host ""
Write-ColorText "📚 Getting Started:" $Blue
Write-Host ""
Write-Host "1. Check system status:"
Write-Host "   .\nclaude.bat status"
Write-Host ""
Write-Host "2. View change timeline:"
Write-Host "   .\nclaude.bat timeline"
Write-Host ""
Write-Host "3. Start daemon manually (if not using Windows Service):"
Write-Host "   .\nclaude.bat daemon start --background"
Write-Host ""
Write-Host "4. Generate context for Claude:"
Write-Host "   .\nclaude.bat memory context"
Write-Host ""
Write-ColorText "📖 Documentation:" $Blue
Write-Host "   Full documentation: $InstallDir\README.md"
Write-Host "   CLI reference: .\nclaude.bat --help"
Write-Host "   GitHub: $RepoUrl"
Write-Host ""
Write-ColorText "🛠️  System Files:" $Blue
Write-Host "   Installation: $InstallDir"
Write-Host "   Project data: $ProjectRoot\.nexus\"
Write-Host "   Master context: $ProjectRoot\CLAUDE.md"
Write-Host ""

if ($serviceAvailable -and ($installService -eq "y" -or $installService -eq "Y")) {
    Write-ColorText "🔧 Service Management:" $Blue
    Write-Host "   Check status: Get-Service NexusAI-Watcher-$env:USERNAME"
    Write-Host "   Stop service: Stop-Service NexusAI-Watcher-$env:USERNAME"
    Write-Host "   Start service: Start-Service NexusAI-Watcher-$env:USERNAME"
    Write-Host "   Remove service: sc.exe delete NexusAI-Watcher-$env:USERNAME"
    Write-Host ""
}

Write-ColorText "🧠 Nexus AI is now protecting your project context!" $Green
Write-ColorText "Never lose context again! 🚀" $Green