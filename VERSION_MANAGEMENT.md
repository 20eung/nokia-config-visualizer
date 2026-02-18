# 버전 관리 가이드

> 이 프로젝트는 전역 버전 관리 시스템을 사용합니다.
>
> **상세 가이드**: `~/Project/Version-Management/VERSION_MANAGEMENT.md` 참조
>
> **전역 정책**: `~/.claude/CLAUDE.md` 참조

## 현재 프로젝트 설정

- **현재 버전**: v4.5.0
- **자동 버전 관리**: 활성화됨
- **자동 Tag 생성**: 활성화됨
- **자동 Release 생성**: 활성화됨 (GitHub Actions)

## 빠른 참조

### 자동 버전 관리 (현재 활성화)

```bash
# 활성화 상태
ln -s ../../scripts/auto-version.sh .git/hooks/pre-commit
ln -s ../../scripts/auto-tag.sh .git/hooks/post-commit

# 비활성화
rm .git/hooks/pre-commit
rm .git/hooks/post-commit
```

### Minor/Major 버전 변경

사용자 요청: **"v4.5.0으로 변경해줘"**

Claude Code 어시스턴트가 자동으로 처리:
1. Git hook 임시 비활성화
2. 버전 변경 (npm run version:minor/major)
3. 커밋
4. Git tag 수동 생성
5. Git hook 재활성화
6. 사용자에게 push 확인

### 버전 표시 위치 (이 프로젝트)

- **웹 페이지**: [src/pages/V3Page.tsx](src/pages/V3Page.tsx)
- **이름 사전 모달**: [src/components/v3/DictionaryEditor.tsx](src/components/v3/DictionaryEditor.tsx)
- **빌드 주입**: [vite.config.ts](vite.config.ts) - `__APP_VERSION__` 전역 변수

## 워크플로우

```
Commit → 버전↑ + Tag생성 → Push (--follow-tags) → GitHub Release 자동 생성
```

## 관련 파일

- **전역 가이드**: `~/.claude/VERSION_MANAGEMENT.md` (상세 문서)
- **스크립트**:
  - `scripts/auto-version.sh` (pre-commit hook)
  - `scripts/auto-tag.sh` (post-commit hook)
- **GitHub Actions**: `.github/workflows/release.yml`

---

**Last Updated**: 2026-02-18
**Current Version**: v4.5.0
