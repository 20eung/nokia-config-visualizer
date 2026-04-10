# Design: Authentik SSO 인증 연동

> **Summary**: nginx Forward Auth + Authentik Embedded Outpost를 이용한 SSO 인증 구현 상세 설계
>
> **Project**: nokia-visualizer
> **Version**: v5.6.3
> **Author**: 20eung
> **Date**: 2026-04-02
> **Status**: Draft
> **Plan**: `docs/01-plan/features/sso-authentik-integration.plan.md`

---

## 1. 변경 파일 목록

| 파일 | 변경 유형 | 설명 |
|------|-----------|------|
| `nginx.conf` | **수정** | Forward Auth 블록 추가, 모든 location에 `auth_request` 적용 |
| `docker-compose.yml` | **유지** | 변경 없음 (이미 portainer-network 공유) |
| `server/src/middleware/auth.ts` | **유지** | API Key 인증 기존 방식 유지 |

**Authentik Web UI 설정** (코드 변경 아님):
- Proxy Provider 생성
- Application 생성
- Embedded Outpost 업데이트

---

## 2. 인증 흐름 상세

### 2.1 최초 접속 (미인증)

```
1. 사용자 → GET https://ncv.hub.sk-net.com/
2. nokia-visualizer nginx 수신
3. nginx → subrequest GET http://authentik-server:9000/outpost.goauthentik.io/auth/nginx
4. Authentik → 401 Unauthorized (세션 없음)
5. nginx error_page 401 → @goauthentik_proxy_signin
6. nginx → 302 Redirect /outpost.goauthentik.io/start?rd=/
7. nginx → proxied to http://authentik-server:9000/outpost.goauthentik.io/start?rd=/
8. Authentik → 302 Redirect to https://authentik.hub.sk-net.com/if/flow/default-authentication-flow/
9. 사용자 → Authentik 로그인 페이지
```

### 2.2 로그인 완료 후 복귀

```
10. 사용자 → 로그인 성공
11. Authentik → 302 Redirect to https://ncv.hub.sk-net.com/ (rd 파라미터)
12. 사용자 → GET https://ncv.hub.sk-net.com/ (세션 쿠키 포함)
13. nginx → subrequest GET http://authentik-server:9000/outpost.goauthentik.io/auth/nginx
14. Authentik → 200 OK + X-authentik-username, X-authentik-groups 헤더
15. nginx → 정상 서비스 (React SPA 반환)
```

### 2.3 WebSocket 연결 흐름

```
1. WebSocket Upgrade 요청 (HTTP → WS) with session cookie
2. nginx auth_request → Authentik 200 OK
3. nginx → Upgrade 처리, WebSocket 연결 수립
4. 이후 WS 프레임은 auth_request 없이 통신 (연결 유지)
```

---

## 3. Authentik Web UI 설정 (Step-by-step)

### 3.1 Proxy Provider 생성

**경로**: Admin UI → Applications → Providers → Create

| 항목 | 값 |
|------|-----|
| Type | Proxy Provider |
| Name | `nokia-visualizer-proxy` |
| Authorization flow | `default-provider-authorization-implicit-consent` |
| Mode | **Forward auth (single application)** |
| External Host | `https://ncv.hub.sk-net.com` |
| Token validity | 기본값 (days=30) |
| Advanced: Unauthenticated paths | (비워둠) |

> **주의**: Mode는 반드시 "Forward auth (single application)" 선택.  
> "Proxy" 또는 "Forward auth (domain level)"은 이 설정에 적합하지 않음.

### 3.2 Application 생성

**경로**: Admin UI → Applications → Applications → Create

| 항목 | 값 |
|------|-----|
| Name | `Nokia Config Visualizer` |
| Slug | `nokia-visualizer` |
| Provider | `nokia-visualizer-proxy` |
| Launch URL | `https://ncv.hub.sk-net.com` |
| UI Settings > Icon | (선택사항) |

### 3.3 Embedded Outpost에 Application 추가

**경로**: Admin UI → Applications → Outposts → `authentik Embedded Outpost` → Edit

| 항목 | 값 |
|------|-----|
| Applications | `Nokia Config Visualizer` 추가 (기존 항목 유지) |

> **중요**: "Update" 버튼 클릭 후 Outpost가 새 Application을 인식하는 데 ~30초 소요.

---

## 4. nginx.conf 전체 변경 내용

### 4.1 변경 전/후 요약

| Location | 변경 전 | 변경 후 |
|----------|---------|---------|
| `location /outpost.goauthentik.io` | 없음 | 신규 추가 (Authentik 프록시) |
| `location @goauthentik_proxy_signin` | 없음 | 신규 추가 (401 처리) |
| `location /api/` | 인증 없음 | `auth_request` + 사용자 헤더 추가 |
| `location /ws` | 인증 없음 | `auth_request` 추가 |
| `location /` | 인증 없음 | `auth_request` 추가 |
| `location ~* \.(js\|css\|...)` | 인증 없음 | `auth_request` 추가 |
| `location ~* \.html$` | 인증 없음 | `auth_request` 추가 |

### 4.2 최종 nginx.conf 전체

```nginx
server {
    listen 80;
    server_name localhost;

    root /usr/share/nginx/html;
    index index.html;

    # 실제 클라이언트 IP 전달 (프록시 사용 시)
    real_ip_header X-Forwarded-For;
    set_real_ip_from 0.0.0.0/0;

    # ============================================================
    # Authentik Forward Auth: Outpost 프록시 엔드포인트
    # auth_request 없음 (무한루프 방지)
    # ============================================================
    location /outpost.goauthentik.io {
        proxy_pass http://authentik-server:9000;
        proxy_set_header Host $host;
        proxy_set_header X-Original-URL $scheme://$http_host$request_uri;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_pass_request_body off;
        proxy_set_header Content-Length "";
        proxy_buffer_size 8k;
    }

    # Authentik 미인증 시 로그인 페이지로 리다이렉트
    location @goauthentik_proxy_signin {
        internal;
        add_header Set-Cookie $auth_cookie;
        return 302 /outpost.goauthentik.io/start?rd=$request_uri;
    }

    # ============================================================
    # API 프록시 → Express 백엔드 (인증 적용)
    # ============================================================
    location /api/ {
        # Authentik Forward Auth
        auth_request /outpost.goauthentik.io/auth/nginx;
        error_page 401 = @goauthentik_proxy_signin;
        auth_request_set $auth_cookie $upstream_http_set_cookie;
        add_header Set-Cookie $auth_cookie;

        # 인증된 사용자 정보를 백엔드에 전달
        auth_request_set $authentik_username $upstream_http_x_authentik_username;
        auth_request_set $authentik_groups   $upstream_http_x_authentik_groups;
        auth_request_set $authentik_email    $upstream_http_x_authentik_email;

        proxy_pass http://nokia-api:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Authentik-Username $authentik_username;
        proxy_set_header X-Authentik-Groups   $authentik_groups;
        proxy_set_header X-Authentik-Email    $authentik_email;
        proxy_read_timeout 120s;
    }

    # ============================================================
    # WebSocket 프록시 (인증 적용)
    # ============================================================
    location /ws {
        # Authentik Forward Auth
        auth_request /outpost.goauthentik.io/auth/nginx;
        error_page 401 = @goauthentik_proxy_signin;
        auth_request_set $auth_cookie $upstream_http_set_cookie;
        add_header Set-Cookie $auth_cookie;

        proxy_pass http://nokia-api:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 3600s;
    }

    # ============================================================
    # SPA 라우팅 지원 (인증 적용)
    # ============================================================
    location / {
        # Authentik Forward Auth
        auth_request /outpost.goauthentik.io/auth/nginx;
        error_page 401 = @goauthentik_proxy_signin;
        auth_request_set $auth_cookie $upstream_http_set_cookie;
        add_header Set-Cookie $auth_cookie;

        try_files $uri $uri/ /index.html;

        # 보안 헤더
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws: wss:; font-src 'self';" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Permissions-Policy "clipboard-write=*, clipboard-read=*" always;
    }

    # ============================================================
    # 정적 파일 캐싱 최적화 (인증 적용)
    # ============================================================
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        # Authentik Forward Auth
        auth_request /outpost.goauthentik.io/auth/nginx;
        error_page 401 = @goauthentik_proxy_signin;
        auth_request_set $auth_cookie $upstream_http_set_cookie;
        add_header Set-Cookie $auth_cookie;

        expires 1y;
        add_header Cache-Control "public, immutable";

        # 보안 헤더
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws: wss:; font-src 'self';" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Permissions-Policy "clipboard-write=*, clipboard-read=*" always;
    }

    # ============================================================
    # HTML 파일은 캐싱하지 않음 (인증 적용)
    # ============================================================
    location ~* \.html$ {
        # Authentik Forward Auth
        auth_request /outpost.goauthentik.io/auth/nginx;
        error_page 401 = @goauthentik_proxy_signin;
        auth_request_set $auth_cookie $upstream_http_set_cookie;
        add_header Set-Cookie $auth_cookie;

        expires -1;
        add_header Cache-Control "no-cache, no-store, must-revalidate";

        # 보안 헤더
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws: wss:; font-src 'self';" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Permissions-Policy "clipboard-write=*, clipboard-read=*" always;
    }

    # Gzip 압축 활성화
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;

    # 보안 헤더 (server 레벨)
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws: wss:; font-src 'self';" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "clipboard-write=*, clipboard-read=*" always;
}
```

---

## 5. 핵심 설계 결정 사항

### 5.1 auth_request 위치 전략

nginx의 `auth_request`는 **server 레벨에서 설정 불가** → 각 location 블록에 개별 추가.

```
location /outpost.goauthentik.io  → auth_request 없음 (무한루프 방지)
location @goauthentik_proxy_signin → internal (직접 접근 불가, auth 불필요)
location /api/                    → auth_request 있음
location /ws                      → auth_request 있음
location /                        → auth_request 있음
location ~* \.(js|css|...)$       → auth_request 있음
location ~* \.html$               → auth_request 있음
```

### 5.2 auth_cookie 처리

`auth_request_set $auth_cookie $upstream_http_set_cookie`는 Authentik이 세션 쿠키를 갱신할 때 브라우저에 전달하는 역할. 모든 보호 location에 동일하게 적용.

### 5.3 WebSocket 인증

WebSocket은 초기 HTTP Upgrade 요청 시에만 `auth_request`가 실행됨. 이후 WS 프레임은 auth_request 없이 통신. 세션 쿠키가 Upgrade 요청에 포함되므로 정상 동작.

### 5.4 X-Forwarded-Proto 필수

Authentik이 HTTPS 환경인지 확인하여 Secure 쿠키를 설정하므로 `X-Forwarded-Proto $scheme` 헤더 전달이 중요. 누락 시 쿠키 설정 실패.

### 5.5 사용자 정보 헤더 (FR-07)

API 요청에 한해 Authentik이 반환한 사용자 정보를 Express 백엔드에 전달:
- `X-Authentik-Username` → 로그인 사용자명
- `X-Authentik-Groups` → 소속 그룹
- `X-Authentik-Email` → 이메일

현재 Express `auth.ts`는 이 헤더를 사용하지 않지만, 향후 감사 로그나 권한 분기에 활용 가능.

---

## 6. 구현 순서 (Do Phase 가이드)

### Step 1: Authentik Web UI 설정 (선행 필요)

```
1. https://authentik.hub.sk-net.com/if/admin/ 접속
2. Applications → Providers → Create
   - Type: Proxy Provider
   - Name: nokia-visualizer-proxy
   - Mode: Forward auth (single application)
   - External Host: https://ncv.hub.sk-net.com
3. Applications → Applications → Create
   - Name: Nokia Config Visualizer
   - Slug: nokia-visualizer
   - Provider: nokia-visualizer-proxy
4. Applications → Outposts → authentik Embedded Outpost → Edit
   - Applications: Nokia Config Visualizer 추가
   - Update 클릭
```

### Step 2: nginx.conf 수정

```bash
# 현재 파일 위치: /data/nokia-visualizer/nginx.conf
# 위 4.2의 전체 nginx.conf 내용으로 교체
```

### Step 3: Docker 재빌드 및 배포

```bash
cd /data/nokia-visualizer
docker compose build nokia-visualizer
docker compose up -d nokia-visualizer
```

### Step 4: 동작 확인

```bash
# 컨테이너 로그 확인
docker logs nokia-visualizer -f

# Authentik 연결 확인 (컨테이너 내부에서)
docker exec nokia-visualizer curl -s http://authentik-server:9000/outpost.goauthentik.io/auth/nginx
# 기대: 401 응답 (인증 없음)
```

---

## 7. 트러블슈팅 가이드

### 7.1 무한 리다이렉트

**증상**: 브라우저에서 `ERR_TOO_MANY_REDIRECTS`

**원인**: `/outpost.goauthentik.io` location에 `auth_request`가 있는 경우

**해결**: 해당 location에 `auth_request`가 없는지 확인

### 7.2 Bad Gateway (502)

**증상**: nginx가 Authentik 연결 실패

**원인**: `authentik-server` 컨테이너 미실행 또는 portainer-network 미가입

**확인**:
```bash
docker ps | grep authentik-server
docker network inspect portainer-network | grep nokia-visualizer
```

### 7.3 로그인 후 리다이렉트 실패

**증상**: 로그인 후 Authentik 페이지에 머무름

**원인**: Authentik Provider의 External Host 불일치

**해결**: Admin UI에서 `nokia-visualizer-proxy` Provider의 External Host가 `https://ncv.hub.sk-net.com`인지 확인

### 7.4 쿠키 설정 안 됨

**증상**: 로그인 후 계속 인증 요구

**원인**: `X-Forwarded-Proto` 헤더 누락으로 Secure 쿠키 설정 실패

**해결**: nginx에서 외부 리버스 프록시가 `X-Forwarded-Proto: https`를 전달하는지 확인

### 7.5 Outpost가 Application을 인식 못 함

**증상**: `/outpost.goauthentik.io/auth/nginx`가 Nokia Visualizer를 인증하지 않음

**해결**: Embedded Outpost Edit → Update 재실행, 30초 대기 후 테스트

---

## 8. 테스트 체크리스트

| # | 테스트 | 방법 | 기대 결과 |
|---|--------|------|-----------|
| 1 | 미인증 접속 | Incognito → `https://ncv.hub.sk-net.com` | Authentik 로그인 페이지 |
| 2 | 로그인 복귀 | `noc` 계정 로그인 | Nokia Visualizer 메인 |
| 3 | 딥링크 복귀 | Incognito → `https://ncv.hub.sk-net.com/some/path` → 로그인 | `/some/path`로 복귀 |
| 4 | API 인증 | `curl https://ncv.hub.sk-net.com/api/health` (쿠키 없음) | 401 or redirect |
| 5 | WebSocket | 로그인 후 실시간 config 업데이트 | 정상 동작 |
| 6 | 로그아웃 | Authentik에서 로그아웃 → Nokia Visualizer 새로고침 | 로그인 페이지 |
| 7 | API Key 유지 | `X-API-Key` 헤더 포함 API 요청 | 정상 동작 (인증 통과 후 API Key 검증) |
| 8 | 정적 파일 | 로그인 후 브라우저 DevTools Network | 200 OK |

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-04-02 | Initial draft | 20eung |
