#!/bin/bash
# scripts/auto-update.sh

PROJECT_DIR="/data/nokia-visualizer"
BRANCH="main"

cd $PROJECT_DIR

# 최신 변경 사항 가져오기 (머지하지 않음)
git fetch origin $BRANCH

# 로컬과 원격의 해시값 비교
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/$BRANCH)

if [ "$LOCAL" != "$REMOTE" ]; then
    echo "$(date): 새로운 업데이트 감지 ($LOCAL -> $REMOTE). 재빌드 시작..."
    
    # 최신 코드 반영
    git pull origin $BRANCH
    
    # 컨테이너 재빌드 및 재시작
    sudo docker-compose up -d --build
    
    # 사용하지 않는 오래된 이미지 정리
    sudo docker image prune -f
    
    echo "$(date): 재빌드 및 서비스 재시작 완료."
else
    echo "$(date): $(date +%H:%M:%S) - 현재 최신 상태입니다."
fi
