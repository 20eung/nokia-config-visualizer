# Beta 환경 자동 테스트 설정

## 개요
Beta 브랜치(`beta.isthe.info`)는 자동으로 테스트 데이터를 로드하는 환경입니다.

## 동작 방식

### 자동 로드 조건
- 호스트네임에 `beta`가 포함된 경우 (예: `beta.hub.sk-net.com, beta.isthe.info`)
- 페이지 로드 시 설정 파일이 없는 경우

### 로드되는 파일
- `/docs/config.txt` - 익명화된 Nokia 7750 SR 설정 파일 (기본 테스트용)
- *참고: Beta 환경은 `.txt`, `.cfg`, `.conf` 등 지원되는 모든 확장자의 동작 테스트를 포함합니다.*

### 구현 위치
- `src/App.tsx` - `useEffect` 훅을 통한 자동 로드 로직
- `public/docs/config.txt` - 빌드 시 포함되는 테스트 설정 파일

## 로컬 테스트

Beta 환경을 로컬에서 테스트하려면:

```bash
# 호스트 파일 수정 (선택사항)
echo "127.0.0.1 beta.localhost" | sudo tee -a /etc/hosts

# 개발 서버 실행
npm run dev

# beta.localhost:5173 접속
```

또는 브라우저 개발자 도구 콘솔에서:
```javascript
// 강제로 beta 환경으로 인식시키기
Object.defineProperty(window.location, 'hostname', {
  value: 'beta.test',
  writable: false
});
```

## 프로덕션 vs Beta

| 환경 | URL | 자동 로드 | 브랜치 |
|------|-----|----------|--------|
| Production | `nokia.hub.sk-net.com`, `nokia.isthe.info` | ❌ | `main` |
| Beta | `beta.hub.sk-net.com`, `beta.isthe.info` | ✅ | `beta` |

## 콘솔 메시지

Beta 환경에서 자동 로드 성공 시:
```
✅ Beta environment: Auto-loaded docs/config.txt
```

실패 시:
```
⚠️ Beta environment: Could not auto-load config: [error]
```
