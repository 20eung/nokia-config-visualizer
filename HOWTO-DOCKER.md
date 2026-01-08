# 🐳 Docker 컨테이너 프로덕션 배포 가이드

> Nokia Config Visualizer를 Docker 컨테이너 기반으로 배포하기 위한 완벽 가이드

## 📋 목차

- [현재 상태 분석](#현재-상태-분석)
- [필요한 Docker 설정 파일](#필요한-docker-설정-파일)
- [프로덕션 배포 절차](#프로덕션-배포-절차)
- [NPM 프록시 호스트 설정](#npm-프록시-호스트-설정)
- [컨테이너 관리](#컨테이너-관리)
- [문제 해결](#문제-해결)
- [추가 옵션](#추가-옵션)

---

## 📊 현재 상태 분석

**프로젝트 정보:**
- **프레임워크**: React 19 + Vite 7
- **빌드 도구**: Vite (정적 사이트 생성)
- **현재 배포**: Cloudflare Pages (정적 호스팅)
- **전환 목표**: Docker 컨테이너 + NPM 프록시

**배포 환경:**
- **포트**: 3300 (컨테이너 외부 포트)
- **도메인**: 메인 도메인 (서브도메인 아님)
- **프록시**: Nginx Proxy Manager (NPM)
- **SSL**: NPM에서 자동 처리

---

## 🚀 프로덕션 배포 절차

### 전제 조건

서버에 다음이 설치되어 있어야 합니다:
- Docker
- Docker Compose
- Git
- Nginx Proxy Manager (NPM) # 다른 서버에 설치되어 있어도 됨

---

### Step 1: GitHub에서 소스 코드 받기

```bash
# 1. 작업 디렉토리로 이동
cd /data  # 또는 원하는 디렉토리

# 2. GitHub에서 클론
git clone https://github.com/20eung/mermaid-web.git nokia-visualizer

# 3. 프로젝트 디렉토리로 이동
cd nokia-visualizer

# 4. 현재 버전 확인
git log --oneline -1
```

---

### Step 2: Docker 설정 파일 생성

#### 🛠 필요한 Docker 설정 파일

프로젝트 루트에 다음 4개 파일을 생성해야 합니다.

#### 📄 1. Dockerfile

```dockerfile
# 멀티 스테이지 빌드 - 빌드 단계
FROM node:18-alpine AS builder

WORKDIR /app

# 패키지 파일 복사 및 의존성 설치
COPY package*.json ./
RUN npm ci

# 소스 코드 복사 및 빌드
COPY . .
RUN npm run build

# 멀티 스테이지 빌드 - 프로덕션 단계
FROM nginx:alpine

# 빌드된 파일 복사
COPY --from=builder /app/dist /usr/share/nginx/html

# Nginx 설정 복사
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 포트 노출
EXPOSE 80

# Nginx 실행
CMD ["nginx", "-g", "daemon off;"]
```

---

#### 📄 2. .dockerignore

```
# 의존성
node_modules

# 빌드 결과물
dist

# Git 관련
.git
.github
.gitignore

# 문서
*.md
docs

# 로그 및 임시 파일
npm-debug.log
yarn-error.log
.DS_Store
.env.local
.env.*.local

# IDE 설정
.vscode
.idea
*.swp
*.swo

# Docker 관련
Dockerfile
docker-compose.yml
.dockerignore
```

---

#### 📄 3. nginx.conf

```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # 실제 클라이언트 IP 전달 (NPM 프록시 사용 시)
    real_ip_header X-Forwarded-For;
    set_real_ip_from 0.0.0.0/0;

    # SPA 라우팅 지원 - 모든 요청을 index.html로 리다이렉트
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 정적 파일 캐싱 최적화
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # HTML 파일은 캐싱하지 않음
    location ~* \.html$ {
        expires -1;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # Gzip 압축 활성화
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;

    # 보안 헤더 (NPM에서도 설정 가능)
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

---

#### 📄 4. docker-compose.yml

```yaml
version: '3.8'

services:
  nokia-visualizer:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3300:80"
    restart: unless-stopped
    container_name: nokia-visualizer
    hostname: nokia-visualizer
    environment:
      - NODE_ENV=production
      - TZ=Asia/Seoul
    networks:
      - npm-network

networks:
  npm-network:
    external: true
```

> **참고**: `npm-network`는 Nginx Proxy Manager와 동일한 네트워크입니다. NPM이 다른 네트워크를 사용한다면 해당 네트워크 이름으로 변경하세요.

---

위에서 설명한 4개 파일을 프로젝트 루트에 생성합니다:

```bash
# 파일 생성 확인
ls -la Dockerfile docker-compose.yml nginx.conf .dockerignore
```

---

### Step 3: Docker Compose로 빌드 및 실행

```bash
# 1. Docker Compose로 빌드
docker-compose up --build

# 2. Docker Compose로 실행 (백그라운드)
docker-compose up -d --build

# 3. 빌드 진행 상황 확인 (최초 빌드 시 2-3분 소요)
docker-compose logs -f

# 4. 컨테이너 상태 확인
docker-compose ps

# 예상 출력:
#       Name                     Command               State           Ports
# ---------------------------------------------------------------------------------
# nokia-visualizer   /docker-entrypoint.sh ngin ...   Up      0.0.0.0:3300->80/tcp
```

---

### Step 4: 로컬 접속 테스트

```bash
# 1. 서버 내부에서 테스트
curl http://localhost:3300

# 2. 외부에서 테스트 (방화벽 오픈 시)
curl http://서버IP:3300

# 3. 브라우저 테스트
# http://서버IP:3300 접속하여 정상 작동 확인
```

---

### Step 5: NPM 프록시 호스트 설정

이제 Nginx Proxy Manager에서 도메인을 연결합니다.

---

## 🔧 NPM 프록시 호스트 설정

### NPM 웹 인터페이스 접속

1. 브라우저에서 NPM 관리 페이지 접속 (보통 `http://서버IP:81`)
2. 로그인

---

### Proxy Host 추가

#### 1. Details 탭

| 항목 | 설정 값 |
|------|---------|
| **Domain Names** | `your-domain.com` (메인 도메인) |
| **Scheme** | `http` |
| **Forward Hostname / IP** | `nokia-visualizer` (컨테이너 이름) 또는 `서버IP` |
| **Forward Port** | `3300` |
| **Cache Assets** | ✅ 체크 |
| **Block Common Exploits** | ✅ 체크 |
| **Websockets Support** | ☐ 체크 안 함 (필요 없음) |

> **중요**: 
> - NPM과 같은 Docker 네트워크를 사용하는 경우: `nokia-visualizer` 입력
> - 다른 네트워크이거나 호스트 모드인 경우: `서버IP` 또는 `host.docker.internal` 입력

---

#### 2. SSL 탭

| 항목 | 설정 값 |
|------|---------|
| **SSL Certificate** | `Request a new SSL Certificate` 선택 |
| **Force SSL** | ✅ 체크 |
| **HTTP/2 Support** | ✅ 체크 |
| **HSTS Enabled** | ✅ 체크 (권장) |
| **Email Address for Let's Encrypt** | 본인 이메일 입력 |
| **I Agree to the Let's Encrypt Terms of Service** | ✅ 체크 |

---

#### 3. Advanced 탭 (선택사항)

추가 Nginx 설정이 필요한 경우:

```nginx
# 클라이언트 최대 업로드 크기 (Config 파일 업로드용)
client_max_body_size 50M;

# 추가 보안 헤더
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;

# 프록시 타임아웃 설정
proxy_connect_timeout 60s;
proxy_send_timeout 60s;
proxy_read_timeout 60s;
```

---

### 설정 저장 및 확인

1. **Save** 버튼 클릭
2. Let's Encrypt SSL 인증서 자동 발급 (약 30초 소요)
3. 브라우저에서 `https://your-domain.com` 접속하여 확인

---

## � 컨테이너 관리

### 기본 명령어

```bash
# 컨테이너 시작
docker-compose up -d

# 컨테이너 중지
docker-compose stop

# 컨테이너 재시작
docker-compose restart

# 컨테이너 중지 및 삭제
docker-compose down

# 로그 확인 (실시간)
docker-compose logs -f

# 로그 확인 (최근 100줄)
docker-compose logs --tail 100

# 컨테이너 상태 확인
docker-compose ps

# 리소스 사용량 확인
docker stats nokia-visualizer
```

---

### 코드 업데이트 시

```bash
# 1. 최신 코드 받기
cd /data/nokia-visualizer
git pull origin main

# 2. 컨테이너 재빌드 및 재시작
docker-compose up -d --build

# 3. 로그 확인
docker-compose logs -f

# 4. 브라우저에서 확인 (캐시 삭제 후)
# Ctrl + Shift + R (하드 리프레시)
```

---

### 컨테이너 내부 접속 (디버깅)

```bash
# 컨테이너 쉘 접속
docker exec -it nokia-visualizer sh

# Nginx 설정 테스트
docker exec nokia-visualizer nginx -t

# Nginx 재시작
docker exec nokia-visualizer nginx -s reload
```

---

## 🔍 문제 해결

### 1. 컨테이너가 시작되지 않음

```bash
# 로그 확인
docker-compose logs

# 포트 충돌 확인
sudo lsof -i :3300

# 포트 변경이 필요한 경우 docker-compose.yml 수정
# ports:
#   - "3301:80"  # 3300 대신 3301 사용
```

---

### 2. NPM에서 502 Bad Gateway

**원인**: NPM이 컨테이너에 접근하지 못함

**해결 방법**:

```bash
# 1. 네트워크 확인
docker network ls

# 2. NPM 네트워크 이름 확인
docker inspect <npm-container-name> | grep NetworkMode

# 3. docker-compose.yml의 네트워크를 NPM과 동일하게 수정
# networks:
#   npm-network:
#     external: true

# 4. 또는 Forward Hostname을 서버 IP로 변경
# Forward Hostname: 192.168.1.100 (예시)
```

---

### 3. 빌드 실패

```bash
# 캐시 없이 재빌드
docker-compose build --no-cache

# 빌드 로그 상세 확인
docker-compose build --progress=plain
```

---

### 4. 페이지가 로드되지 않음

```bash
# 1. 컨테이너 로그 확인
docker-compose logs -f

# 2. Nginx 설정 확인
docker exec nokia-visualizer cat /etc/nginx/conf.d/default.conf

# 3. 빌드된 파일 확인
docker exec nokia-visualizer ls -la /usr/share/nginx/html
```

---

### 5. SSL 인증서 발급 실패

**원인**: 도메인 DNS가 서버 IP를 가리키지 않음

**해결 방법**:
1. 도메인 DNS 설정 확인 (A 레코드가 서버 IP를 가리켜야 함)
2. DNS 전파 대기 (최대 24시간)
3. 방화벽에서 80, 443 포트 오픈 확인

```bash
# DNS 확인
nslookup your-domain.com

# 방화벽 확인 (Ubuntu/Debian)
sudo ufw status

# 포트 오픈
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

---

## 🔄 백업 및 복구

### 이미지 백업

```bash
# 현재 이미지 저장
docker save nokia-visualizer:latest -o nokia-visualizer-backup.tar

# 이미지 복원
docker load -i nokia-visualizer-backup.tar
```

---

### 설정 파일 백업

```bash
# 중요 파일 백업
tar -czf nokia-visualizer-config-backup.tar.gz \
  Dockerfile \
  docker-compose.yml \
  nginx.conf \
  .dockerignore

# 복원
tar -xzf nokia-visualizer-config-backup.tar.gz
```

---

## 📊 모니터링

### 리소스 사용량

```bash
# 실시간 리소스 모니터링
docker stats nokia-visualizer

# 출력 예시:
# CONTAINER ID   NAME               CPU %   MEM USAGE / LIMIT   MEM %   NET I/O
# abc123def456   nokia-visualizer   0.01%   25.5MiB / 7.8GiB    0.32%   1.2kB / 850B
```

---

### 로그 관리

```bash
# 로그 크기 확인
docker inspect nokia-visualizer | grep LogPath

# 로그 로테이션 설정 (docker-compose.yml에 추가)
# logging:
#   driver: "json-file"
#   options:
#     max-size: "10m"
#     max-file: "3"
```

---

## 🎯 추가 옵션

### 옵션 1: Docker Hub 배포 (선택사항)

Docker Hub에 이미지를 업로드하면 다른 서버에서 쉽게 배포할 수 있습니다.

```bash
# 1. Docker Hub 로그인
docker login

# 2. 이미지 태그 지정
docker tag mermaid-web-nokia-visualizer:latest yourusername/nokia-visualizer:v1.8.0
docker tag mermaid-web-nokia-visualizer:latest yourusername/nokia-visualizer:latest

# 3. Docker Hub에 푸시
docker push yourusername/nokia-visualizer:v1.8.0
docker push yourusername/nokia-visualizer:latest

# 4. 다른 서버에서 사용
# docker-compose.yml 수정:
# services:
#   nokia-visualizer:
#     image: yourusername/nokia-visualizer:latest
#     # build 섹션 제거
```

---

### 옵션 2: 환경 변수 사용

환경별로 다른 설정이 필요한 경우:

```yaml
# docker-compose.yml
services:
  nokia-visualizer:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        - BUILD_ENV=production
    environment:
      - NODE_ENV=production
      - API_URL=https://api.example.com
      - TZ=Asia/Seoul
```

```dockerfile
# Dockerfile
ARG BUILD_ENV=production
ENV BUILD_ENV=${BUILD_ENV}

# 빌드 시 환경 변수 사용
RUN if [ "$BUILD_ENV" = "production" ]; then \
      npm run build; \
    else \
      npm run build:dev; \
    fi
```

---

### 옵션 3: 자동 업데이트 (Watchtower)

코드 변경 시 자동으로 컨테이너를 업데이트하려면:

```yaml
# docker-compose.yml에 추가
services:
  nokia-visualizer:
    # ... 기존 설정 ...
    labels:
      - "com.centurylinklabs.watchtower.enable=true"

  watchtower:
    image: containrrr/watchtower
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    command: --interval 300 --cleanup
    restart: unless-stopped
```

---

### 옵션 4: CI/CD 자동 배포

GitHub Actions를 사용한 자동 배포:

`.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]
    tags:
      - 'v*'

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - name: Deploy to server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /data/nokia-visualizer
            git pull origin main
            docker-compose up -d --build
```

---

## 📚 참고 자료

- [Docker 공식 문서](https://docs.docker.com/)
- [Docker Compose 문서](https://docs.docker.com/compose/)
- [Nginx 공식 문서](https://nginx.org/en/docs/)
- [Nginx Proxy Manager](https://nginxproxymanager.com/)
- [Let's Encrypt](https://letsencrypt.org/)

---

## ✅ 배포 체크리스트

### 사전 준비
- [ ] Docker 설치 확인 (`docker --version`)
- [ ] Docker Compose 설치 확인 (`docker-compose --version`)
- [ ] Git 설치 확인 (`git --version`)
- [ ] NPM 설치 및 실행 확인
- [ ] 도메인 DNS 설정 완료 (A 레코드 → 서버 IP)

### 파일 생성
- [ ] `Dockerfile` 생성
- [ ] `.dockerignore` 생성
- [ ] `nginx.conf` 생성
- [ ] `docker-compose.yml` 생성

### 배포 실행
- [ ] GitHub에서 소스 클론
- [ ] Docker Compose 빌드 및 실행
- [ ] 로컬 접속 테스트 (http://서버IP:3300)
- [ ] NPM 프록시 호스트 추가
- [ ] SSL 인증서 발급 확인
- [ ] 도메인 접속 테스트 (https://your-domain.com)

### 기능 테스트
- [ ] 웹 페이지 정상 로드 확인
- [ ] Config 파일 업로드 기능 테스트
- [ ] 다이어그램 생성 기능 테스트
- [ ] 다이어그램 다운로드 기능 테스트
- [ ] 검색 기능 테스트
- [ ] HA 필터 기능 테스트

### 운영 설정
- [ ] 컨테이너 자동 재시작 설정 확인
- [ ] 로그 로테이션 설정
- [ ] 백업 전략 수립
- [ ] 모니터링 설정 (선택)

---

## 🎓 요약

**프로덕션 배포 핵심 단계:**

1. **GitHub에서 소스 받기**
   ```bash
   git clone https://github.com/20eung/mermaid-web.git nokia-visualizer
   cd nokia-visualizer
   ```
   
   또는

   ```bash
   git clone https://github.com/20eung/mermaid-web.git
   cd mermaid-web
   ```

2. **Docker 설정 파일 생성** (4개 파일)

3. **Docker Compose로 실행**
   ```bash
   docker-compose up -d --build
   ```

4. **NPM 프록시 호스트 설정**
   - Domain: `your-domain.com`
   - Forward: `nokia-visualizer:3300` 또는 `서버IP:3300`
   - SSL: Let's Encrypt 자동 발급

5. **접속 확인**
   ```
   https://your-domain.com
   ```

**특징:**
- ✅ 포트 3300 사용 (충돌 최소화)
- ✅ Docker Compose 기본 사용 (간편한 관리)
- ✅ NPM 프록시로 SSL 자동 처리
- ✅ 메인 도메인 연결
- ✅ 코드 수정 불필요
- ✅ 빌드 시간 약 2-3분
- ✅ 최종 이미지 크기 약 25MB

---

**작성일**: 2026-01-08  
**버전**: v1.8.0  
**대상**: 프로덕션 서버 배포  
**작성자**: Network Engineers
