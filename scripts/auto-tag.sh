#!/bin/bash
#
# Auto Tag Script
# Git 커밋 후 자동으로 버전 태그를 생성합니다.
#
# 설치 방법:
#   chmod +x scripts/auto-tag.sh
#   ln -s ../../scripts/auto-tag.sh .git/hooks/post-commit
#
# 제거 방법:
#   rm .git/hooks/post-commit
#

# package.json에서 현재 버전 읽기
CURRENT_VERSION=$(node -p "require('./package.json').version")
TAG_NAME="v${CURRENT_VERSION}"

# 이미 동일한 태그가 있는지 확인
if git rev-parse "$TAG_NAME" >/dev/null 2>&1; then
  echo "⏭️  Tag $TAG_NAME already exists, skipping"
  exit 0
fi

# Git tag 생성
git tag -a "$TAG_NAME" -m "Release $TAG_NAME"
echo "🏷️  Created tag: $TAG_NAME"
