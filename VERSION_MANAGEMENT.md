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

## 자동 버전 관리 (현재 활성화)

Git 커밋 시 **자동으로 patch 버전을 증가시키고, GitHub에 push 시 자동으로 Tag와 Release를 생성**합니다.

### 활성화

```bash
# 1. 자동 버전 증가 (pre-commit hook)
ln -s ../../scripts/auto-version.sh .git/hooks/pre-commit

# 2. 자동 태그 생성 (post-commit hook)
ln -s ../../scripts/auto-tag.sh .git/hooks/post-commit
```

### 비활성화

```bash
# 1. 자동 버전 증가 비활성화
rm .git/hooks/pre-commit

# 2. 자동 태그 생성 비활성화
rm .git/hooks/post-commit
```

### 동작 방식 (완전 자동화 워크플로우)

#### 1단계: 커밋 시 (로컬)

**pre-commit hook** (scripts/auto-version.sh):
- Git 커밋 시 자동으로 patch 버전 증가 (예: 4.4.6 → 4.4.7)
- `package.json`을 자동으로 스테이징에 추가
- 버전 변경 로그 출력

**post-commit hook** (scripts/auto-tag.sh):
- 커밋 완료 후 Git tag 자동 생성 (예: v4.4.7)
- 동일한 tag가 이미 있으면 스킵

#### 2단계: Push 시

```bash
git push origin v4-development --follow-tags
```

- `--follow-tags` 옵션으로 **tag도 함께 push**
- 또는 별도로 tag push: `git push origin --tags`

#### 3단계: GitHub Actions (자동)

**Workflow** (.github/workflows/release.yml):
1. Tag push 감지
2. 프로젝트 빌드 (npm run build)
3. 이전 tag와 현재 tag 사이의 **모든 커밋 로그** 추출
4. **Release 노트 자동 생성** (한국어)
5. GitHub Release 페이지에 배포 파일(dist)과 함께 게시

### 자동 생성되는 Release 노트 예시

```markdown
## 변경 사항

- feat: Add new feature (a1b2c3d)
- fix: Fix bug in parser (e4f5g6h)
- docs: Update documentation (i7j8k9l)
- chore: Bump version to v4.4.7 (m0n1o2p)

---
**버전**: v4.4.7
**날짜**: 2026-02-18
**브랜치**: v4-development
```

### 주의사항

⚠️ **자동 버전 관리는 모든 커밋마다 버전이 증가하고 Release가 생성됩니다**.

**단점**:
- 작은 수정이나 문서 변경에도 버전이 올라감
- 릴리즈가 아닌 개발 커밋에도 버전이 증가
- GitHub Release 페이지에 많은 버전이 누적될 수 있음

✅ **장점**:
- 모든 변경 이력이 Release로 완전히 기록됨
- 버전 관리가 완전 자동화됨 (수동 작업 불필요)
- 언제든 이전 버전으로 롤백 가능
- 변경 이력 추적이 명확함
- 사소한 변경사항도 투명하게 관리

📌 **현재 프로젝트 상태**: **활성화됨** (현재 v4.4.7)

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

## Minor/Major 버전 변경 워크플로우

Minor 또는 Major 버전을 변경할 때는 자동 버전 증가 Git hook과 충돌하지 않도록 특별한 절차가 필요합니다.

### 사용자 요청 예시

```
"v4.5.0으로 변경해줘"
```

### Claude Code 어시스턴트 작업 절차

1. **Git hook 임시 비활성화**
   ```bash
   rm .git/hooks/pre-commit
   rm .git/hooks/post-commit
   ```

2. **버전 변경 (Minor 예시)**
   ```bash
   npm run version:minor
   ```
   또는 Major 버전:
   ```bash
   npm run version:major
   ```

3. **변경사항 커밋**
   ```bash
   git add package.json
   git commit -m "chore: Bump version to v4.5.0"
   ```

4. **Git tag 수동 생성**
   ```bash
   git tag -a v4.5.0 -m "Release v4.5.0"
   ```

5. **Git hook 재활성화**
   ```bash
   ln -s ../../scripts/auto-version.sh .git/hooks/pre-commit
   ln -s ../../scripts/auto-tag.sh .git/hooks/post-commit
   ```

6. **사용자에게 Push 확인**
   "변경사항을 GitHub에 푸시하시겠습니까?"
   - Push 시: `git push origin v4-development --follow-tags`

⚠️ **중요**: Claude Code 어시스턴트는 자동으로 GitHub에 push하지 않습니다. 모든 push 작업은 사용자의 명시적 승인이 필요합니다. (글로벌 CLAUDE.md 정책)

### 수동 작업 시

사용자가 직접 작업할 경우:

```bash
# 1. Git hook 비활성화
rm .git/hooks/pre-commit
rm .git/hooks/post-commit

# 2. 버전 변경
npm run version:minor  # v4.4.x → v4.5.0
# 또는
npm run version:major  # v4.x.x → v5.0.0

# 3. 커밋
git add package.json
git commit -m "chore: Bump version to v4.5.0"

# 4. Tag 생성
git tag -a v4.5.0 -m "Release v4.5.0"

# 5. Push (tag도 함께)
git push origin v4-development --follow-tags

# 6. Git hook 재활성화
ln -s ../../scripts/auto-version.sh .git/hooks/pre-commit
ln -s ../../scripts/auto-tag.sh .git/hooks/post-commit
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

이렇게 하면 `v4.4.x` → `v4.5.0`으로 변경됩니다.

⚠️ **주의**: Minor/Major 버전 변경 시에는 위의 "Minor/Major 버전 변경 워크플로우" 섹션을 참조하여 Git hook을 임시 비활성화해야 합니다.

---

**Last Updated**: 2026-02-18
