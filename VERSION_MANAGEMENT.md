# 버전 관리 가이드

## 개요

프로젝트 버전은 `package.json`의 `version` 필드에서 관리됩니다.
웹 페이지에 표시되는 버전은 빌드 시점에 자동으로 주입됩니다.

## 버전 형식

```
v{major}.{minor}.{patch}
예: v4.4.0, v4.4.1, v4.4.2
```

- **Major**: 큰 변경, 호환성이 깨지는 변경
- **Minor**: 새로운 기능 추가 (하위 호환 유지)
- **Patch**: 버그 수정, 작은 개선

## 수동 버전 관리 (권장)

### 1. Patch 버전 증가 (v4.4.0 → v4.4.1)

```bash
npm run version:patch
```

### 2. Minor 버전 증가 (v4.4.0 → v4.5.0)

```bash
npm run version:minor
```

### 3. Major 버전 증가 (v4.4.0 → v5.0.0)

```bash
npm run version:major
```

### 4. 변경사항 커밋

```bash
git add package.json
git commit -m "chore: Bump version to v4.4.1"
git push origin v4-development
```

## 자동 버전 관리 (선택사항)

Git 커밋 시 **자동으로 patch 버전을 증가**시키려면 Git hook을 활성화합니다.

### 활성화

```bash
ln -s ../../scripts/auto-version.sh .git/hooks/pre-commit
```

### 비활성화

```bash
rm .git/hooks/pre-commit
```

### 동작 방식

- Git 커밋 시 자동으로 patch 버전 증가
- `package.json`을 자동으로 스테이징에 추가
- 버전 변경 로그 출력

### 주의사항

⚠️ **자동 버전 관리는 모든 커밋마다 버전이 증가**합니다.
- 작은 수정이나 문서 변경에도 버전이 올라감
- 릴리즈가 아닌 개발 커밋에도 버전이 증가
- **권장하지 않음** (수동 관리 권장)

## 빌드 시 버전 주입

`vite.config.ts`에서 빌드 시점에 `package.json`의 version을 읽어 환경변수로 주입합니다.

```typescript
// vite.config.ts
define: {
  __APP_VERSION__: JSON.stringify(packageJson.version),
}
```

컴포넌트에서 사용:

```tsx
<h1>Nokia Config Visualizer v{__APP_VERSION__} (AI Visualizer)</h1>
```

## 버전 표시 위치

- **웹 페이지 헤더**: [src/pages/V3Page.tsx](src/pages/V3Page.tsx)
- **이름 사전 모달**: [src/components/v3/DictionaryEditor.tsx](src/components/v3/DictionaryEditor.tsx)

## 워크플로우 예시

### 릴리즈 준비

```bash
# 1. 기능 개발 완료
# 2. 버전 증가
npm run version:patch

# 3. 빌드 및 테스트
npm run build
docker-compose build --no-cache
docker-compose up -d

# 4. 테스트 후 커밋
git add package.json
git commit -m "chore: Release v4.4.1"
git push origin v4-development
```

### 개발 중

```bash
# 개발 커밋 시에는 버전 증가하지 않음
git add src/
git commit -m "feat: Add new feature"
git push origin v4-development
```

## FAQ

### Q: 버전을 수동으로 변경하면 안 되나요?

A: `package.json`을 직접 수정할 수도 있지만, `npm version` 명령어 사용을 권장합니다.
- 버전 형식 검증
- 일관된 버전 관리
- 스크립트 자동화 가능

### Q: 자동 버전 관리를 켜야 하나요?

A: **권장하지 않습니다**. 모든 커밋마다 버전이 증가하면:
- 버전 번호가 너무 빨리 증가
- 의미 없는 버전 변경
- Git history가 지저분해짐

릴리즈할 때만 수동으로 버전을 증가시키는 것이 좋습니다.

### Q: v4.4를 v4.5로 변경하려면?

```bash
npm run version:minor
```

이렇게 하면 `v4.4.0` → `v4.5.0`으로 변경됩니다.

---

**Last Updated**: 2026-02-18
