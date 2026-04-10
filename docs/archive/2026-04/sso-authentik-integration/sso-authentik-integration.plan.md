# Plan: Authentik SSO 인증 연동

> **Summary**: Nokia Config Visualizer에 Authentik Forward Auth를 적용하여 인증 없이 접근 가능한 문제 해결
>
> **Project**: nokia-visualizer
> **Version**: v5.6.3
> **Author**: 20eung
> **Date**: 2026-04-02
> **Status**: Draft

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | Nokia Config Visualizer가 인증 없이 누구나 접근 가능하여 내부 장비 설정 정보가 노출될 위험이 있음 |
| **Solution** | 이미 운영 중인 Authentik SSO 서버와 nginx Forward Auth를 연동하여 로그인 없이는 접근 불가하도록 차단 |
| **Function/UX Effect** | 미인증 사용자는 Authentik 로그인 페이지로 리다이렉트되며, 로그인 후 원래 URL로 복귀. Grafana와 동일한 SSO 경험 제공 |
| **Core Value** | 별도 인증 시스템 구축 없이 기존 Authentik 인프라 재활용으로 운영 부담 최소화, 내부 장비 설정 정보 보호 |

---

## 1. Overview

### 1.1 Purpose

Nokia Config Visualizer는 현재 인증 없이 접근 가능한 상태로, 내부 네트워크 장비의 설정 파일이 비인가 사용자에게 노출될 수 있다. Authentik SSO를 통해 접근 제어를 구현한다.

### 1.2 Background

- **현황**: `https://ncv.hub.sk-net.com` 접속 시 인증 없이 바로 서비스 이용 가능
- **위험**: Nokia 장비 설정(IP, 서비스 구성 등) 정보 노출
- **기존 인프라**: Grafana는 이미 Authentik OAuth2/OIDC SSO로 운영 중 (`portainer-network`)
- **Authentik 위치**: `authentik-server` 컨테이너, 포트 9900 (외부), 9000 (내부)
- **목표**: Grafana와 동일한 방식의 SSO 경험을 Nokia Visualizer에도 적용

### 1.3 Related Documents

- Authentik Guide: `/data/authentik/docs/GUIDE.md`
- Grafana SSO 트러블슈팅: `/data/authentik/docs/grafana-sso-troubleshooting.md`
- 현재 nginx.conf: `/data/nokia-visualizer/nginx.conf`
- 현재 auth 미들웨어: `server/src/middleware/auth.ts`

---

## 2. 현재 아키텍처

```
[사용자] → nginx (3301:80) → [인증 없음] → React SPA
                           → /api/* → nokia-api (3000) → Express
                                        → API Key 인증 (선택적)

[Authentik] → authentik-server (9900:9000) [portainer-network 공유]
```

## 3. 목표 아키텍처

### 3.1 Authentik Forward Auth 방식

```
[사용자] → nginx (3301:80)
              ↓ auth_request /outpost.goauthentik.io/auth/nginx
              ↓ → authentik-server:9000 (portainer-network)
              ↓ 200 OK → 정상 서비스
              ↓ 401 → /outpost.goauthentik.io/start?rd=<원래URL>
                        → Authentik 로그인 페이지 (9900)
                        → 로그인 완료 → 원래 URL 복귀
```

### 3.2 선택 이유: Forward Auth vs OAuth2 Proxy

| 방식 | 장점 | 단점 | 선택 |
|------|------|------|:----:|
| **Authentik Forward Auth** (nginx auth_request) | 별도 컨테이너 불필요, 설정 간단, Authentik 내장 기능 활용 | nginx auth_request 모듈 필요 (기본 포함) | ✅ |
| OAuth2 Proxy (별도 컨테이너) | 더 많은 제어 가능 | 추가 컨테이너 운영 부담 | ✗ |

---

## 4. Scope

### 4.1 In Scope

- [x] Authentik Proxy Provider 생성 (Forward Auth - Single Application)
- [x] Authentik Application 생성 (Nokia Visualizer)
- [x] Embedded Outpost에 Nokia Visualizer Application 추가
- [x] nginx.conf 수정 (auth_request 추가)
- [x] `/outpost.goauthentik.io/` 경로 프록시 설정
- [x] 인증 성공 시 유저 정보 헤더 전달 (X-authentik-username 등)
- [x] WebSocket 경로(`/ws`) 인증 처리
- [x] HTTPS 환경 쿠키/리다이렉트 설정

### 4.2 Out of Scope

- Authentik 사용자/그룹 관리 (기존 인프라 사용)
- Express API의 JWT 토큰 검증 (Phase 2에서 필요 시 고려)
- 사용자별 권한 분리 (뷰어/에디터 등) — 현재는 인증만
- 모바일 앱 지원

---

## 5. Requirements

### 5.1 Functional Requirements

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|----------|------|
| FR-01 | 미인증 사용자가 Nokia Visualizer 접속 시 Authentik 로그인 페이지로 리다이렉트 | High | Pending |
| FR-02 | 로그인 성공 후 원래 요청 URL로 자동 복귀 | High | Pending |
| FR-03 | 인증된 사용자는 기존과 동일하게 서비스 이용 가능 | High | Pending |
| FR-04 | `/api/*` 엔드포인트도 동일한 인증 적용 | High | Pending |
| FR-05 | WebSocket(`/ws`) 연결도 인증 후에만 허용 | Medium | Pending |
| FR-06 | Authentik 로그아웃 시 Nokia Visualizer 세션도 종료 | Medium | Pending |
| FR-07 | 인증된 사용자의 username을 Express API에 전달 (X-authentik-username 헤더) | Low | Pending |

### 5.2 Non-Functional Requirements

| Category | 기준 | 측정 방법 |
|----------|------|-----------|
| 보안 | 모든 경로 인증 적용 (health check 제외) | 브라우저 incognito 테스트 |
| 성능 | 인증 체크 지연 < 100ms | nginx 로그 분석 |
| 가용성 | Authentik 다운 시 fallback 동작 정의 | 시나리오 테스트 |
| 호환성 | 기존 API Key 인증(X-API-Key)과 공존 가능 | API 테스트 |

---

## 6. 구현 계획

### 6.1 Step 1: Authentik 측 설정 (Web UI)

**Authentik Admin UI** (`https://authentik.hub.sk-net.com` 또는 `:9900/if/admin/`)

1. **Provider 생성** (Applications → Providers → Create)
   - Type: **Proxy Provider**
   - Name: `nokia-visualizer-proxy`
   - Authorization flow: `default-provider-authorization-explicit-consent` 또는 `implicit`
   - Mode: **Forward auth (single application)**
   - External Host: `https://ncv.hub.sk-net.com`
   
2. **Application 생성** (Applications → Applications → Create)
   - Name: `Nokia Config Visualizer`
   - Slug: `nokia-visualizer`
   - Provider: `nokia-visualizer-proxy` (위에서 생성)
   - Launch URL: `https://ncv.hub.sk-net.com`

3. **Embedded Outpost에 Application 추가** (Applications → Outposts → Edit embedded outpost)
   - Applications에 `Nokia Config Visualizer` 추가

### 6.2 Step 2: nginx.conf 수정

현재 nginx.conf에 다음 변경 필요:

**추가할 내용:**
```nginx
# Authentik Forward Auth 엔드포인트
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

# 미인증 시 Authentik 로그인으로 리다이렉트
location @goauthentik_proxy_signin {
    internal;
    add_header Set-Cookie $auth_cookie;
    return 302 /outpost.goauthentik.io/start?rd=$request_uri;
}
```

**server 블록 전역에 추가:**
```nginx
# Authentik Forward Auth
auth_request /outpost.goauthentik.io/auth/nginx;
error_page 401 = @goauthentik_proxy_signin;
auth_request_set $auth_cookie $upstream_http_set_cookie;
add_header Set-Cookie $auth_cookie;

# Authentik에서 전달받은 사용자 정보 헤더
auth_request_set $authentik_username $upstream_http_x_authentik_username;
auth_request_set $authentik_groups  $upstream_http_x_authentik_groups;
auth_request_set $authentik_email   $upstream_http_x_authentik_email;
auth_request_set $authentik_name    $upstream_http_x_authentik_name;
auth_request_set $authentik_uid     $upstream_http_x_authentik_uid;
```

**API 프록시에 사용자 정보 헤더 전달:**
```nginx
location /api/ {
    proxy_set_header X-Authentik-Username $authentik_username;
    proxy_set_header X-Authentik-Groups   $authentik_groups;
    proxy_set_header X-Authentik-Email    $authentik_email;
    # ... 기존 설정 유지 ...
}
```

### 6.3 Step 3: Docker 재빌드 및 배포

```bash
# nokia-visualizer 컨테이너만 재빌드 (nginx.conf 변경)
docker compose build nokia-visualizer
docker compose up -d nokia-visualizer
```

---

## 7. Risks and Mitigation

| 위험 | 영향 | 가능성 | 대응 방안 |
|------|------|--------|-----------|
| Authentik 서버 다운 시 서비스 접속 불가 | High | Low | Authentik HA 구성 검토, 또는 `auth_request` 실패 시 fallback 설정 |
| WebSocket 인증 쿠키 만료로 연결 끊김 | Medium | Medium | WebSocket 재연결 로직 확인 (이미 구현됨), 세션 유효시간 설정 |
| `X-Forwarded-Proto` 헤더 누락으로 쿠키 설정 실패 | High | Medium | nginx에서 `$scheme` 명시적 전달, HTTPS 확인 |
| Authentik Embedded Outpost vs 별도 Outpost 선택 오류 | Medium | Low | Embedded Outpost 우선 사용, 문제 시 별도 Outpost 배포 |
| 기존 API Key 인증과 충돌 | Low | Low | Forward Auth는 nginx 레벨, API Key는 Express 레벨로 독립 동작 |
| `/outpost.goauthentik.io/` 무한 리다이렉트 | High | Medium | `auth_request` 경로에는 `auth_request` 미적용 (nginx 자동 제외) |

---

## 8. Architecture Considerations

### 8.1 Project Level

**Enterprise** - 기존 프로젝트 레벨 유지

### 8.2 Key Architectural Decisions

| 결정 | 옵션 | 선택 | 이유 |
|------|------|------|------|
| Auth 방식 | Forward Auth / OAuth2 Proxy / OIDC | **Forward Auth** | 추가 컨테이너 불필요, Authentik 내장 기능 |
| 적용 레이어 | nginx / Express / 둘 다 | **nginx** | 프론트/API 모두 커버, 단일 진입점 |
| 세션 관리 | nginx 쿠키 / JWT | **Authentik 세션 쿠키** | Authentik이 세션 관리, 일관성 유지 |
| WebSocket 처리 | 별도 인증 / Cookie 재사용 | **Cookie 재사용** | 초기 HTTP Upgrade 시 쿠키 검증 |

### 8.3 네트워크 흐름

```
외부 HTTPS (443/nginx reverse proxy)
  → nokia-visualizer nginx (80)
    → auth_request → authentik-server:9000 (internal)
      ← 200 (authenticated)  or  401 (redirect)
    → React SPA 서빙 or /api/* 프록시
```

---

## 9. Convention Prerequisites

### 9.1 Environment Variables 추가 필요

| 변수 | 목적 | 범위 | 생성 필요 |
|------|------|------|:---------:|
| `AUTHENTIK_HOST` | Authentik 서버 내부 주소 | nginx/docker-compose | ☑ (authentik-server:9000) |

> 현재 `docker-compose.yml`에 하드코딩 대신 환경변수로 관리 권장

### 9.2 변경 파일 목록

| 파일 | 변경 유형 | 내용 |
|------|-----------|------|
| `nginx.conf` | 수정 | auth_request 블록, outpost 프록시 추가 |
| `docker-compose.yml` | 선택적 수정 | `AUTHENTIK_HOST` 환경변수 (선택사항) |
| `server/src/middleware/auth.ts` | 유지 | API Key 인증 기존 방식 유지 |

---

## 10. Success Criteria

### 10.1 Definition of Done

- [ ] 미인증 상태에서 `https://ncv.hub.sk-net.com` 접속 시 Authentik 로그인 페이지 표시
- [ ] `noc` 계정으로 로그인 후 Nokia Visualizer 정상 접속
- [ ] 로그인 후 원래 URL로 정확히 복귀
- [ ] WebSocket 연결 정상 동작 (실시간 config 업데이트)
- [ ] 기존 API Key 인증 동작 유지
- [ ] Authentik에서 로그아웃 후 Nokia Visualizer 재접속 시 로그인 요구

### 10.2 테스트 시나리오

| 시나리오 | 기대 결과 |
|----------|-----------|
| Incognito에서 `https://ncv.hub.sk-net.com` 접속 | Authentik 로그인 페이지로 리다이렉트 |
| 로그인 후 원래 URL 복귀 | Nokia Visualizer 메인 페이지 표시 |
| `/api/chat` 직접 호출 (미인증) | 401 리다이렉트 |
| WebSocket 연결 | 정상 연결 및 실시간 업데이트 |
| Authentik 로그아웃 → Nokia Visualizer 새로고침 | 로그인 페이지로 리다이렉트 |

---

## 11. Next Steps

1. [ ] **Authentik 설정** (Web UI): Provider + Application + Outpost 구성
2. [ ] **Design 문서 작성**: nginx.conf 상세 변경사항 (`/pdca design sso-authentik-integration`)
3. [ ] **nginx.conf 수정 및 테스트**
4. [ ] **Docker 재빌드 및 배포**
5. [ ] **Gap Analysis**: `/pdca analyze sso-authentik-integration`

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-04-02 | Initial draft | 20eung |
