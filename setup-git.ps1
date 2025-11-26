# Git Setup Script for MyReactNativeApp
# Run this after installing Git

Write-Host "Setting up Git repository..." -ForegroundColor Cyan

# Configure Git (update with your info)
git config --global user.name "cryptoaccess"
git config --global user.email "malachiking@gmail.com"

# Initialize repository
git init

# Add all files
git add .

# Create initial commit
git commit -m "StockfinderAI automates stock research and find the best stocks to buy"

Write-Host "`nGit repository initialized successfully!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Create a repository on GitHub (https://github.com/new)"
Write-Host "2. Run these commands to push:"
Write-Host "   git remote add origin https://github.com/cryptoaccess/stockfinderai.git"
Write-Host "   git branch -M main"
Write-Host "   git push -u origin main"
