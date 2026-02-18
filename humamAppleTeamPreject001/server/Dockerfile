# Backend Dockerfile with Playwright support
FROM node:20-slim

# Playwright 브라우저 의존성 설치
RUN apt-get update && apt-get install -y \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    libatspi2.0-0 \
    libgtk-3-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 의존성 설치
COPY package*.json ./
RUN npm ci --only=production

# Playwright 브라우저 설치 (Chromium만)
RUN npx playwright install chromium

# 소스 복사
COPY . .

# 이미지 디렉토리 생성
RUN mkdir -p /app/public/images/artists /app/public/images/covers /app/public/images/tracks

EXPOSE 3001

CMD ["node", "src/index.js"]
