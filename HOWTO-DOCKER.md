# 🐳 Docker 컨테이너 프로덕션 배포 가이드

> Nokia Config Visualizer를 Docker 컨테이너 기반으로 배포하기 위한 완벽 가이드

## 📋 목차

- [현재 상태 분석](#현재-상태-분석)
- [필요한 Docker 설정 파일](#필요한-docker-설정-파일)
- [프로덕션 배포 절차](#프로덕션-배포-절차)
- [NPM 프록시 호스트 설정](#npm-프록시-호스트-설정)
- [SSL/HTTPS 직접 적용 (사설망 서버용)](#sslhttps-직접-적용-사설망-서버용)
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
- **포트**: 3301 (컨테이너 외부 포트)
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
git clone https://github.com/20eung/nokia-config-visualizer.git

# 3. 프로젝트 디렉토리로 이동
cd nokia-config-visualizer

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
FROM node:22-alpine AS builder

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
# dist

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

    # 실제 클라이언트 IP 전달 (프록시 사용 시)
    real_ip_header X-Forwarded-For;
    set_real_ip_from 0.0.0.0/0;

    # SPA 라우팅 지원
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

    # 보안 헤더
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

---

#### 📄 4. docker-compose.yml

```yaml
services:
  nokia-visualizer:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: nokia-visualizer
    hostname: nokia-visualizer
    restart: unless-stopped
    ports:
      - "3301:80"
    environment:
      - NODE_ENV=production
      - TZ=Asia/Seoul
    depends_on:
      - nokia-api
    networks:
      - npm-network

  nokia-api:
    build:
      context: ./server
      dockerfile: Dockerfile
    container_name: nokia-api
    hostname: nokia-api
    restart: unless-stopped
    environment:
      - TZ=Asia/Seoul
      - AWS_REGION=${AWS_REGION:-ap-northeast-2}
      - BEDROCK_MODEL_ID=${BEDROCK_MODEL_ID:-apac.anthropic.claude-sonnet-4-20250514-v1:0}
    volumes:
      - ${HOME}/.aws:/root/.aws:ro
    expose:
      - "3000"
    networks:
      - npm-network

networks:
  npm-network:
    driver: bridge
```

> **참고**: NPM과 동일한 Docker 네트워크를 사용하려면 `driver: bridge`를 `external: true`로 변경하세요.
>
> **AI 기능**: `nokia-api` 컨테이너는 AWS Bedrock을 통해 Claude AI를 호출합니다. `~/.aws/credentials` 파일이 read-only로 마운트됩니다. AI 기능이 불필요하면 `nokia-api` 서비스를 제거해도 프론트엔드는 정상 동작합니다.

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
docker-compose build

# 2. Docker Compose로 실행 (백그라운드)
docker-compose up -d

# 3. 빌드 진행 상황 확인 (최초 빌드 시 2-3분 소요)
docker-compose logs -f

# 4. 컨테이너 상태 확인
docker-compose ps

# 예상 출력:
#       Name                     Command               State           Ports
# ---------------------------------------------------------------------------------
# nokia-visualizer   /docker-entrypoint.sh ngin ...   Up      0.0.0.0:3301->80/tcp
```

---

### Step 4: 로컬 접속 테스트

```bash
# 1. 서버 내부에서 테스트
curl http://localhost:3301

# 2. 외부에서 테스트 (방화벽 오픈 시)
curl http://서버IP:3301

# 3. 브라우저 테스트
# http://서버IP:3301 접속하여 정상 작동 확인
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
| **Forward Port** | `3301` |
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

## 🔐 SSL/HTTPS 직접 적용 (사설망 서버용)

> NPM이 공인망에 있고 컨테이너가 사설망에 있어 NPM을 사용할 수 없는 경우, 컨테이너에 직접 SSL을 적용할 수 있습니다.

### 전제 조건

- SSL 인증서 파일 보유 (NPM에서 다운로드 또는 별도 발급)
- 인증서 파일: `fullchain2.pem`, `privkey2.pem`

---

### Step 1: SSL 인증서 파일 준비

#### NPM에서 인증서 다운로드한 경우

NPM에서 다운로드한 압축 파일에는 다음 파일들이 포함되어 있습니다:
- `cert2.pem` - 도메인 인증서
- `chain2.pem` - 중간 인증서 체인
- `fullchain2.pem` - **전체 인증서** (cert + chain 결합) ✅ 사용
- `privkey2.pem` - **개인키** ✅ 사용

```bash
# 프로젝트 디렉토리로 이동
cd /data/nokia-visualizer

# ssl 폴더 생성
mkdir ssl

# NPM에서 다운로드한 인증서 파일을 ssl 폴더로 복사
cp fullchain2.pem /data/nokia-visualizer/ssl/
cp privkey2.pem /data/nokia-visualizer/ssl/

# 또는 압축 파일에서 직접 추출
unzip certificate-archive.zip -d /data/nokia-visualizer/ssl/

# 파일 확인
ls -la /data/nokia-visualizer/ssl/

# 권한 설정 (보안상 매우 중요!)
chmod 600 /data/nokia-visualizer/ssl/privkey2.pem
chmod 644 /data/nokia-visualizer/ssl/fullchain2.pem

# 소유권 확인
chown $USER:$USER /data/nokia-visualizer/ssl/*
```

#### 인증서 검증 (선택사항)

```bash
# 인증서 정보 확인
openssl x509 -in /data/nokia-visualizer/ssl/fullchain2.pem -text -noout | head -20

# 인증서 유효기간 확인
openssl x509 -in /data/nokia-visualizer/ssl/fullchain2.pem -noout -dates

# 개인키 확인
openssl rsa -in /data/nokia-visualizer/ssl/privkey2.pem -check

# 인증서와 개인키 매칭 확인 (두 값이 동일해야 함)
openssl x509 -noout -modulus -in /data/nokia-visualizer/ssl/fullchain2.pem | openssl md5
openssl rsa -noout -modulus -in /data/nokia-visualizer/ssl/privkey2.pem | openssl md5
```

---

### Step 2: nginx.conf 수정

기존 `nginx.conf`를 HTTPS를 지원하도록 수정합니다.

```nginx
# HTTP를 HTTPS로 리다이렉트
server {
    listen 80;
    server_name localhost;
    # 3443 포트로 명시적 리다이렉트 (포트 매핑 고려)
    return 301 https://$host:3443$request_uri;
}

# HTTPS 서버
server {
    listen 443 ssl;
    http2 on;  # Nginx 1.25.1+ 새로운 문법
    server_name localhost;
    
    root /usr/share/nginx/html;
    index index.html;

    # SSL 인증서 설정 (NPM에서 다운로드한 파일)
    ssl_certificate /etc/nginx/ssl/fullchain2.pem;      # 전체 인증서 체인
    ssl_certificate_key /etc/nginx/ssl/privkey2.pem;    # 개인키

    # SSL 프로토콜 및 암호화 설정
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;

    # SSL 세션 캐시
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # 실제 클라이언트 IP 전달
    real_ip_header X-Forwarded-For;
    set_real_ip_from 0.0.0.0/0;

    # SPA 라우팅 지원
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

    # 보안 헤더
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

**주요 포인트:**
- `return 301 https://$host:3443$request_uri;` - 포트 3443으로 명시적 리다이렉트
- `listen 443 ssl;` + `http2 on;` - Nginx 1.25.1+ 새로운 문법
- `ssl_certificate` - fullchain2.pem 사용 (전체 인증서 체인 포함)

---

### Step 3: docker-compose.yml 수정

SSL 인증서를 컨테이너에 마운트하고 HTTPS 포트를 노출합니다.

```yaml
services:
  nokia-visualizer:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: nokia-visualizer
    hostname: nokia-visualizer
    restart: unless-stopped
    ports:
      - "3301:80"    # HTTP (HTTPS로 리다이렉트됨)
      - "3443:443"   # HTTPS
    volumes:
      - ./ssl:/etc/nginx/ssl:ro  # SSL 인증서 마운트 (읽기 전용)
    environment:
      - NODE_ENV=production
      - TZ=Asia/Seoul
    networks:
      - app-network

networks:
  app-network:
    driver: bridge
```

**주요 변경점:**
- `ports`: 3443 포트 추가 (HTTPS)
- `volumes`: ssl 폴더를 컨테이너에 읽기 전용으로 마운트
- `networks`: NPM을 사용하지 않으므로 독립적인 네트워크 사용

---

### Step 4: 컨테이너 재빌드 및 실행

```bash
# 기존 컨테이너 중지 및 삭제
docker-compose down

# 새로운 설정으로 빌드
docker-compose build

# 컨테이너 실행
docker-compose up -d

# 로그 확인
docker-compose logs -f

# Nginx 설정 테스트
docker exec nokia-visualizer nginx -t

# 예상 출력:
# nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
# nginx: configuration file /etc/nginx/nginx.conf test is successful
```

---

### Step 5: 방화벽 설정 (필요 시)

```bash
# 포트 3301 (HTTP) 오픈
sudo ufw allow 3301/tcp

# 포트 3443 (HTTPS) 오픈
sudo ufw allow 3443/tcp

# 방화벽 상태 확인
sudo ufw status
```

---

### Step 6: 접속 테스트

```bash
# HTTP 접속 (HTTPS로 리다이렉트되어야 함)
curl -I http://서버IP:3301

# 예상 응답:
# HTTP/1.1 301 Moved Permanently
# Location: https://서버IP:3443/

# HTTPS 접속
curl -k https://서버IP:3443

# 브라우저 테스트
# http://서버IP:3301 → https://서버IP:3443 (자동 리다이렉트)
# https://서버IP:3443 (직접 접속)
```

---

### 포트 매핑 설명

| 외부 포트 | 내부 포트 | 프로토콜 | 용도 |
|-----------|-----------|----------|------|
| 3301 | 80 | HTTP | HTTPS로 리다이렉트 |
| 3443 | 443 | HTTPS | 실제 서비스 |

**리다이렉트 흐름:**
1. 사용자가 `http://서버IP:3301` 접속
2. Docker가 3301 → 80 포트로 전달
3. Nginx가 HTTPS로 리다이렉트: `https://서버IP:3443`
4. Docker가 3443 → 443 포트로 전달
5. Nginx가 HTTPS로 응답

---

### 문제 해결

#### 1. 리다이렉트 URL이 잘못된 경우

**증상:** `http://서버IP:3301` 접속 시 `https://서버IP:3000`으로 리다이렉트됨

**원인:** nginx.conf에서 포트를 명시하지 않음

**해결:**
```nginx
# 잘못된 설정
return 301 https://$host$request_uri;  # 포트 누락

# 올바른 설정
return 301 https://$host:3443$request_uri;  # 포트 명시
```

#### 2. SSL 인증서 오류

```bash
# 인증서 파일 권한 확인
ls -la /data/nokia-visualizer/ssl/

# 권한 재설정
chmod 600 /data/nokia-visualizer/ssl/privkey2.pem
chmod 644 /data/nokia-visualizer/ssl/fullchain2.pem

# 컨테이너 재시작
docker-compose restart
```

#### 3. Nginx 설정 오류

```bash
# 컨테이너 내부 접속
docker exec -it nokia-visualizer sh

# Nginx 설정 테스트
nginx -t

# 설정 파일 확인
cat /etc/nginx/conf.d/default.conf

# SSL 파일 확인
ls -la /etc/nginx/ssl/
```

---

## 📦 컨테이너 관리

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
sudo lsof -i :3301

# 포트 변경이 필요한 경우 docker-compose.yml 수정
# ports:
#   - "3302:80"  # 3301 대신 3302 사용
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
docker tag nokia-visualizer:latest yourusername/nokia-visualizer:v3.2.0
docker tag nokia-visualizer:latest yourusername/nokia-visualizer:latest

# 3. Docker Hub에 푸시
docker push yourusername/nokia-visualizer:v3.2.0
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
- [ ] 로컬 접속 테스트 (http://서버IP:3301)
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
   git clone https://github.com/20eung/nokia-config-visualizer.git
   cd nokia-config-visualizer
   ```

2. **Docker 설정 파일 생성** (4개 파일)

3. **Docker Compose로 실행**
   ```bash
   docker-compose up -d --build
   ```

4. **NPM 프록시 호스트 설정**
   - Domain: `your-domain.com`
   - Forward: `nokia-visualizer:3301` 또는 `서버IP:3301`
   - SSL: Let's Encrypt 자동 발급

5. **접속 확인**
   ```
   https://your-domain.com
   ```

**특징:**
- ✅ 포트 3301 사용 (충돌 최소화)
- ✅ Docker Compose 기본 사용 (간편한 관리)
- ✅ NPM 프록시로 SSL 자동 처리
- ✅ 메인 도메인 연결
- ✅ 코드 수정 불필요
- ✅ 빌드 시간 약 2-3분
- ✅ 최종 이미지 크기 약 25MB

---

**작성일**: 2026-02-15
**버전**: v3.3.0
**대상**: 프로덕션 서버 배포
**작성자**: Network Engineers
