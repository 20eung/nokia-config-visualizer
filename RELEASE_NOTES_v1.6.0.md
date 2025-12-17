# v1.6.0 - Interface List Hierarchy with Collapsible Device Groups

## 🆕 주요 기능

### 인터페이스 리스트 계층 구조

파일 탐색기처럼 장비별로 인터페이스를 접고 펼칠 수 있습니다!

**기능**:
- 장비 헤더 클릭 시 인터페이스 리스트 토글
- ChevronRight (▶) - 접힌 상태
- ChevronDown (▼) - 펼쳐진 상태
- 각 장비의 인터페이스 개수 표시
- 기본값: 모든 장비 펼쳐진 상태

**사용 예시**:
```
▼ 📦 AINet_NewYork_7750SR_I_BB3 (25)
  ☐ p3/1/13
  ☐ p3/2/4
  ...

▶ 📦 AINet_NewYork_7750SR_I_BB4 (28)
```

## 🔧 개선 사항

### 1. 이중화 버튼 기능 개선

**기존 문제**:
- `topology.haPairs`만 확인하여 동적 HA를 감지하지 못함
- config 문법이 다르면 HA 인터페이스 자동 선택 실패

**해결**:
- mermaidGenerator와 동일한 로직 적용
- relatedRoutes 비교하여 공통 Customer Network 감지
- config1.txt와 config2.txt처럼 문법이 달라도 정확하게 작동

### 2. UI 개선

- Chevron 아이콘 크기: 14px → 16px
- Server 아이콘 크기: 14px → 16px
- 아이콘 간격: 4px → 6px
- `flexShrink: 0` 추가로 아이콘 찌그러짐 방지

## 📝 변경된 파일

- `src/components/InterfaceList.tsx` - 접기/펼치기 기능 및 HA 필터 개선
- `package.json` - v1.6.0
- `CHANGELOG.md` - 변경사항 추가

## 💡 사용 방법

### 장비 접기/펼치기
1. 장비 이름을 클릭하여 접기/펼치기
2. 접힌 상태에서도 인터페이스 개수 확인 가능
3. 여러 장비의 config를 로드해도 쉽게 탐색

### 이중화 버튼
1. '이중화' 버튼 클릭
2. 동적으로 감지된 HA 인터페이스 자동 선택
3. 오른쪽 패널에 HA 다이어그램 표시

## 📊 버전 히스토리

- v1.0.0 (2025-12-14) - 초기 릴리즈
- v1.1.0 (2025-12-14) - HA 다이어그램 생성 기능
- v1.2.0 (2025-12-14) - HA 다이어그램 표시 개선
- v1.3.0 (2025-12-15) - 고급 검색 기능 (AND/OR)
- v1.4.0 (2025-12-15) - 동적 HA 감지
- v1.5.0 (2025-12-15) - Mermaid 코드 보기 UX 개선
- **v1.6.0 (2025-12-15) - 인터페이스 리스트 계층 구조** ⭐
