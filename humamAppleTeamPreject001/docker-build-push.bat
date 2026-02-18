@echo off
REM MusicSpace Docker Hub Build & Push Script
REM Usage: docker-build-push.bat [all|frontend|spring|fastapi|node]

set DOCKER_USER=johae201
set REPO=music_space_place

echo ========================================
echo MusicSpace Docker Build & Push
echo ========================================

if "%1"=="" goto all
if "%1"=="all" goto all
if "%1"=="frontend" goto frontend
if "%1"=="spring" goto spring
if "%1"=="fastapi" goto fastapi
if "%1"=="node" goto node
goto usage

:all
echo Building ALL images...
call :frontend
call :spring
call :fastapi
call :node
goto done

:frontend
echo.
echo [1/4] Building Frontend...
cd /d c:\Final_team_project\humamAppleTeamPreject001
call npm run build
docker build -t %DOCKER_USER%/%REPO%:frontend .
docker push %DOCKER_USER%/%REPO%:frontend
echo Frontend pushed!
goto :eof

:spring
echo.
echo [2/4] Building Spring Boot Backend...
cd /d c:\Final_team_project\2TeamFinalProject-BE
docker build -t %DOCKER_USER%/%REPO%:spring-backend .
docker push %DOCKER_USER%/%REPO%:spring-backend
echo Spring Backend pushed!
goto :eof

:fastapi
echo.
echo [3/4] Building FastAPI...
cd /d c:\Final_team_project\FAST_API
docker build -t %DOCKER_USER%/%REPO%:fastapi .
docker push %DOCKER_USER%/%REPO%:fastapi
echo FastAPI pushed!
goto :eof

:node
echo.
echo [4/4] Building Node.js Backend...
cd /d c:\Final_team_project\humamAppleTeamPreject001\server
docker build -t %DOCKER_USER%/%REPO%:node-backend .
docker push %DOCKER_USER%/%REPO%:node-backend
echo Node Backend pushed!
goto :eof

:usage
echo.
echo Usage: docker-build-push.bat [all^|frontend^|spring^|fastapi^|node]
echo.
echo   all      - Build and push all images
echo   frontend - Build and push frontend only
echo   spring   - Build and push Spring Boot only
echo   fastapi  - Build and push FastAPI only
echo   node     - Build and push Node.js only
goto :eof

:done
echo.
echo ========================================
echo All images pushed to Docker Hub!
echo ========================================
echo.
echo Ubuntu에서 실행:
echo   docker compose -f docker-compose.prod.yml pull
echo   docker compose -f docker-compose.prod.yml up -d
