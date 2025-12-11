# 구현 계획 - UI 재설계 및 레이아웃 개선

## 목표 설명
다이어그램과 인터페이스 목록을 위한 화면 공간을 최대화하기 위해 애플리케이션 레이아웃을 재설계합니다.
- "파일 업로드" 기능을 상단 헤더로 이동합니다.
- 왼쪽 사이드바를 온전히 "인터페이스 목록" 전용으로 사용합니다.
- 사이드바와 메인 콘텐츠 사이에 **크기 조절 가능한(resizable)** 분리자(splitter)를 구현합니다.
- 사이드바를 숨길 수 있는 **접기/펼치기(collapsible)** 햄버거 메뉴를 추가합니다.

## 사용자 검토 필요 사항
> [!NOTE]
> - `react-resizable-panels`와 같은 무거운 라이브러리를 추가하지 않고, 커스텀 리사이징 로직을 구현하여 가볍게 유지할 계획입니다.
> - 파일 업로드 UI는 기존의 큰 드래그 영역에서 헤더의 버튼/아이콘 트리거 형태로 변경됩니다.

## 변경 제안

### 컴포넌트

#### [수정] [FileUpload.tsx](file:///Users/20eung/Project/mermaid-web/src/components/FileUpload.tsx)
- "헤더 모드"일 때 컴팩트한 버튼/아이콘으로 렌더링되도록 스타일을 변경합니다.
- `variant?: 'default' | 'header'` 프로퍼티를 추가합니다 (일단 헤더를 기본으로 하거나 완전히 대체).
- 헤더의 라벨/버튼에 의해 트리거되는 숨겨진 input 요소로 구현될 예정입니다.

#### [수정] [App.tsx](file:///Users/20eung/Project/mermaid-web/src/App.tsx)
- **Header**: 부제(subtitle)를 제거하고, 여기에 `FileUpload` 컴포넌트를 추가합니다.
- **Layout**:
    - `sidebarWidth` 상태를 추가합니다 (기본값 약 300px).
    - `isSidebarOpen` 상태를 추가합니다 (boolean).
    - 사이드바와 콘텐츠 사이에 "Resizer" 분리자 div를 구현합니다.
    - 리사이징을 위한 마우스 이벤트를 처리합니다.
- **Sidebar**: "Configuration" 카드 래퍼를 제거하고, `InterfaceList`를 바로 노출합니다 (필요시 컨테이너로 감쌈).

#### [수정] [App.css](file:///Users/20eung/Project/mermaid-web/src/App.css)
- 새로운 업로드 버튼 레이아웃을 지원하도록 `.app-header`를 업데이트합니다.
- 리사이징 로직(flex-row)을 처리하도록 `.app-main`을 업데이트합니다.
- 드래그 핸들을 위한 `.resizer` 클래스를 추가합니다.
- `.sidebar.collapsed` 스타일(transform/width 0)을 추가합니다.
- `InterfaceList`가 사이드바 높이를 가득 채우도록 업데이트합니다.

## 검증 계획

### 수동 검증
- **업로드**: 새로운 헤더 버튼 클릭 -> 파일 업로드 -> 정상 작동 확인.
- **토글**: 햄버거 버튼 클릭 -> 사이드바 숨김/보임 확인.
- **리사이즈**: 분리선 드래그 -> 사이드바 너비 변경 확인.
- **반응형**: 작은 화면에서도 레이아웃이 깨지지 않는지 확인 (데스크톱 중심이지만 체크).
