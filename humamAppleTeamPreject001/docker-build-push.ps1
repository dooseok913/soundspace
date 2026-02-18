# MusicSpace Docker Hub Build & Push Script
# Usage: .\docker-build-push.ps1 [all|frontend|spring|fastapi|node]

param(
    [string]$Target = "all"
)

$DOCKER_USER = "johae201"
$REPO = "music_space_place"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "MusicSpace Docker Build & Push" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

function Build-Frontend {
    Write-Host "`n[Frontend] Building..." -ForegroundColor Yellow
    Set-Location "c:\Final_team_project\humamAppleTeamPreject001"
    npm run build
    docker build -t "${DOCKER_USER}/${REPO}:frontend" .
    docker push "${DOCKER_USER}/${REPO}:frontend"
    Write-Host "[Frontend] Pushed!" -ForegroundColor Green
}

function Build-Spring {
    Write-Host "`n[Spring Boot] Building..." -ForegroundColor Yellow
    Set-Location "c:\Final_team_project\2TeamFinalProject-BE"
    docker build -t "${DOCKER_USER}/${REPO}:spring-backend" .
    docker push "${DOCKER_USER}/${REPO}:spring-backend"
    Write-Host "[Spring Boot] Pushed!" -ForegroundColor Green
}

function Build-FastAPI {
    Write-Host "`n[FastAPI] Building..." -ForegroundColor Yellow
    Set-Location "c:\Final_team_project\FAST_API"
    docker build -t "${DOCKER_USER}/${REPO}:fastapi" .
    docker push "${DOCKER_USER}/${REPO}:fastapi"
    Write-Host "[FastAPI] Pushed!" -ForegroundColor Green
}

function Build-Node {
    Write-Host "`n[Node.js] Building..." -ForegroundColor Yellow
    Set-Location "c:\Final_team_project\humamAppleTeamPreject001\server"
    docker build -t "${DOCKER_USER}/${REPO}:node-backend" .
    docker push "${DOCKER_USER}/${REPO}:node-backend"
    Write-Host "[Node.js] Pushed!" -ForegroundColor Green
}

switch ($Target) {
    "all" {
        Build-Frontend
        Build-Spring
        Build-FastAPI
        Build-Node
    }
    "frontend" { Build-Frontend }
    "spring" { Build-Spring }
    "fastapi" { Build-FastAPI }
    "node" { Build-Node }
    default {
        Write-Host "`nUsage: .\docker-build-push.ps1 [all|frontend|spring|fastapi|node]" -ForegroundColor Red
        exit 1
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "`nUbuntu deploy command:"
Write-Host "  docker compose -f docker-compose.prod.yml pull"
Write-Host "  docker compose -f docker-compose.prod.yml up -d"
