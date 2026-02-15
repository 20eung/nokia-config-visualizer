# v1.4.0 - Dynamic HA Detection

## 🆕 주요 변경사항

### 동적 HA 감지 (Customer Network 기반)

선택된 인터페이스들의 `relatedRoutes`를 비교하여 **공통 Customer Network가 있으면** 자동으로 HA 다이어그램으로 그룹핑합니다.

**해결된 문제**:
- config1.txt와 config2.txt의 서로 다른 static-route 문법 지원
  - config1.txt (BB3): `static-route 51.51.35.128/27 next-hop 51.51.34.220`
  - config2.txt (BB4): `static-route-entry 51.51.35.128/27` → `next-hop 51.51.34.219`
- 같은 Customer Network를 가리키는 인터페이스들이 이제 하나의 HA 다이어그램으로 합쳐짐

**기술적 개선**:
- `'interface-based'` HA Pair 타입 추가
- 선택된 인터페이스 간 relatedRoutes 비교 로직 구현
- 동적 HA Pair 생성 및 그룹핑

### 디버깅 로그 추가

TopologyEngine에 상세한 HA 감지 로그 추가:
- 📊 총 장비 수
- 📱 각 장비의 static routes 개수
- 📍 파싱된 route 예시 (처음 3개)
- 🔗 Next-hop 그룹 수
- ✅ 감지된 HA Pair
- 🎯 총 HA Pair 수

### 검색 기능 개선 (v1.3.0에서 추가)

- **AND/OR 검색 지원**
  - OR 검색: 띄어쓰기로 구분 (예: `BB5 210.211`)
  - AND 검색: ` + `로 구분 (예: `BB5 + 210.211`)
- **검색 필드 확장**: 7개 필드 지원
  - hostname, port, port description, interface name, interface description, ip address, service description

## 📝 변경된 파일

- `src/utils/mermaidGenerator.ts` - 동적 HA 감지 로직
- `src/utils/TopologyEngine.ts` - 디버깅 로그 추가
- `src/types.ts` - 'interface-based' 타입 추가
- `src/components/InterfaceList.tsx` - 검색 기능 개선
- `package.json` - v1.4.0
- `CHANGELOG.md` - 변경사항 추가

## 💡 사용 예시

**선택된 인터페이스**:
- BB3: `p3/1/13` - Customer Network: `51.51.35.128/27`
- BB4: `p3/2/12` - Customer Network: `51.51.35.128/27`

**결과**: 하나의 HA 다이어그램으로 자동 합쳐짐

**콘솔 로그**:
```
🔗 [HA Detection] Found HA pair via common routes: ['51.51.35.128/27']
  - AINet_NewYork_Nokia_Equipment_I_BB3:p3/1/13 (51.51.34.220)
  - AINet_NewYork_Nokia_Equipment_I_BB4:p3/2/12 (51.51.34.219)
```

## 📊 버전 히스토리

- v1.0.0 (2025-12-14) - 초기 릴리즈
- v1.1.0 (2025-12-14) - HA 다이어그램 생성 기능
- v1.2.0 (2025-12-14) - HA 다이어그램 표시 개선
- v1.3.0 (2025-12-15) - 고급 검색 기능 (AND/OR)
- **v1.4.0 (2025-12-15) - 동적 HA 감지** ⭐
