#!/bin/bash
#
# Auto Version Script
# Git 커밋 시 자동으로 patch 버전을 증가시킵니다.
#
# 설치 방법:
#   chmod +x scripts/auto-version.sh
#   ln -s ../../scripts/auto-version.sh .git/hooks/pre-commit
#
# 제거 방법:
#   rm .git/hooks/pre-commit
#

echo "🔢 Auto-versioning..."

# package.json이 변경되었는지 확인
if git diff --cached --name-only | grep -q "package.json"; then
  echo "⏭️  package.json already staged, skipping auto-version"
  exit 0
fi

# 현재 버전 확인
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "   Current version: $CURRENT_VERSION"

# patch 버전 자동 증가
npm version patch --no-git-tag-version > /dev/null 2>&1

NEW_VERSION=$(node -p "require('./package.json').version")
echo "   New version: $NEW_VERSION"

# package.json을 스테이징에 추가
git add package.json

echo "✅ Version bumped to $NEW_VERSION"
