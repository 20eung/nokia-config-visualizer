# Release Notes - v4.1.0 (Name Dictionary & AI-Powered Entity Extraction)

Config description에서 엔티티를 AI가 추출하여 이름 사전을 구축하고, 한국어/별칭으로 서비스를 검색할 수 있는 기능을 추가합니다.

## 주요 변경 사항

### 이름 사전 (Name Dictionary)

- **AI 자동 생성**: Config description에서 고객명, 지역, 서비스명, 장비명 등의 엔티티를 AI가 추출
- **이름 변형 생성**: 각 엔티티에 대해 짧은 이름, 긴 이름, 한국어 이름, 별칭을 자동 생성
- **증분 구축**: Config 파일을 점진적으로 업로드하면서 사전을 누적 구축 가능
  - AI 자동 생성 시 기존 항목 모두 보존, 새 토큰만 추가
- **AI 챗봇 연동**: 사전이 등록되면 한국어/별칭으로 질문해도 원본 토큰과 매칭하여 서비스 검색
  - 예: 사전에 `11st → 한국어: 11번가, 별칭: 일일번가` 등록 시, "일일번가 서비스 보여줘"로 검색 가능

### 전역 단일 사전

- 서버에 `/app/data/dictionary.json` 단일 파일로 저장
- Config 파일 조합이 바뀌어도 항상 동일한 사전 사용
- Docker named volume(`dict-data:/app/data`)으로 컨테이너 재빌드에도 데이터 유지

### Dictionary Editor UI

- 모달 기반 사전 편집기 (이름 사전 버튼으로 접근)
- 카테고리별 분류: customer, location, service, device, other
- **테이블 정렬**: 컬럼 헤더 클릭으로 오름차순/내림차순 토글 (한국어 로케일 지원)
- **중복 정리**: originalToken과 동일한 값을 다른 필드에서 일괄 제거
- **전체 삭제**: 모든 항목을 비우고 처음부터 다시 시작

## API 엔드포인트

| Method | Path | 설명 |
|---|---|---|
| POST | `/api/dictionary/generate` | AI 사전 자동 생성 |
| GET | `/api/dictionary` | 전역 사전 로드 |
| PUT | `/api/dictionary` | 전역 사전 저장 |

## Bug Fixes

- **AI 응답 잘림**: maxTokens 4096 → 8192로 증가하여 대규모 사전 생성 시 JSON 파싱 실패 해결
- **AI 생성 중복 데이터**: originalToken이 shortName/longName/koreanName/aliases에 그대로 복사되던 문제 수정
  - 사전 생성 프롬프트에 중복 방지 규칙 추가
  - 프론트엔드에서 후처리로 중복 필터링

## Technical Changes

- `server/src/services/dictionaryStore.ts`: 단일 파일 load/save 서비스
- `server/src/routes/dictionary.ts`: GET/PUT `/api/dictionary` 엔드포인트
- `server/src/prompts/dictionaryPrompt.ts`: 엔티티 추출 및 이름 변형 생성 프롬프트
- `src/components/v3/DictionaryEditor.tsx`: 사전 편집기 (정렬, 중복 정리, 전체 삭제)
- `src/services/dictionaryApi.ts`: 서버 API 클라이언트
- `src/utils/dictionaryStorage.ts`: 순수 유틸리티 (createEmptyDictionary, toDictionaryCompact)
- `src/utils/descriptionExtractor.ts`: Config에서 고유 description 추출
- Docker Compose: `dict-data:/app/data` named volume 추가

## 파일 변경 요약

| 파일 | 변경 |
|---|---|
| `server/src/services/dictionaryStore.ts` | 신규 - 파일 I/O 서비스 |
| `server/src/services/dictionaryGenerator.ts` | 신규 - Bedrock 호출 래퍼 |
| `server/src/routes/dictionary.ts` | 신규 - API 엔드포인트 |
| `server/src/prompts/dictionaryPrompt.ts` | 신규 - AI 프롬프트 |
| `src/components/v3/DictionaryEditor.tsx` | 신규 - 사전 편집기 UI |
| `src/components/v3/DictionaryEditor.css` | 신규 - 사전 편집기 스타일 |
| `src/services/dictionaryApi.ts` | 신규 - API 클라이언트 |
| `src/types/dictionary.ts` | 신규 - 타입 정의 |
| `src/utils/descriptionExtractor.ts` | 신규 - Description 추출기 |
| `src/utils/dictionaryStorage.ts` | 신규 - 순수 유틸리티 |
| `src/components/v3/ServiceListV3.tsx` | 수정 - 사전 로딩 및 AI 패널 연동 |
| `server/src/prompts/systemPrompt.ts` | 수정 - Name Dictionary 활용 지시 추가 |
| `docker-compose.yml` | 수정 - dict-data 볼륨 추가 |
| `server/Dockerfile` | 수정 - /app/data 디렉토리 생성 |

---

**Full Changelog**: https://github.com/20eung/nokia-config-visualizer/compare/v4.0.0...v4.1.0
