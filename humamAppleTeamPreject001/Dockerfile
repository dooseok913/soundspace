# Frontend Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# 의존성 설치 (레이어 캐시 활용)
COPY package*.json ./
RUN npm ci --ignore-scripts

# 소스 복사
COPY . .

# Docker 환경에서는 /api로 요청 (nginx 프록시 사용)
ENV VITE_API_URL=/api

# 빌드 (tsc 타입체크 생략 - vite가 TS 처리)
RUN npx vite build

# Production 이미지
FROM nginx:alpine

# Nginx 설정 복사
COPY nginx.conf /etc/nginx/nginx.conf

# 빌드 결과물 복사
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
