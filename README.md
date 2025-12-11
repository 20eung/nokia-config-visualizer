# Nokia Config Visualizer

Nokia 7750 SR 라우터 설정 파일(`.cfg`)을 분석하여 네트워크 토폴로지를 자동으로 시각화하는 웹 애플리케이션입니다.

![Application Screenshot](./docs/screenshot.png)
*(참고용 스크린샷)*

## 📖 프로젝트 개요

이 프로젝트는 네트워크 엔지니어가 복잡한 Nokia 라우터 설정 파일을 쉽게 이해하고 분석할 수 있도록 돕기 위해 개발되었습니다. 텍스트 형태의 설정을 파싱하여 인터페이스, 포트, 연동 장비 정보를 추출하고, 이를 **Mermaid.js**를 이용해 직관적인 다이어그램으로 변환합니다.

### 주요 기능

*   **설정 파일 파싱 (Parsing)**:
    *   호스트네임(Hostname), 시스템 정보 추출
    *   인터페이스(Interface) 및 포트(Port) 정보 상세 분석
    *   IP 주소, 서브넷 마스크 파싱
    *   QoS 정책, 서비스 ID (VPRN/IES) 추출
    *   정적 라우팅(Static Route) 경로 및 Next-Hop 분석
*   **지능형 관계 추론**:
    *   인터페이스 설명을 기반으로 인접 장비(Neighbor) 자동 식별
    *   Static Route Next-Hop 분석을 통한 원격 장비 IP 및 네트워크 추론
*   **대화형 시각화 (Visualization)**:
    *   업로드된 장비를 중심 노드로 하는 네트워크 토폴로지 생성
    *   원하는 인터페이스만 선택하여 시각화할 수 있는 필터링 기능
    *   다이어그램 엣지(Edge)에 상세 정보(Port, IP, QoS 등) 표시
*   **사용자 편의성**:
    *   Config 파일 드래그 앤 드롭 업로드 또는 텍스트 붙여넣기 지원
    *   자연스러운 정렬(Natural Sorting)이 적용된 인터페이스 목록
    *   모던하고 깔끔한 UI 디자인

## 🛠 기술 스택

*   **Frontend**: [React](https://react.dev/) (v19), [TypeScript](https://www.typescriptlang.org/)
*   **Build Tool**: [Vite](https://vitejs.dev/)
*   **Visualization**: [Mermaid.js](https://mermaid.js.org/)
*   **Styling**: Vanilla CSS (Premium Aesthetic)
*   **Icons**: [Lucide React](https://lucide.dev/)

## 🚀 시작하기

이 프로젝트를 로컬 환경에서 실행하려면 다음 단계를 따르세요.

### 사전 요구사항

*   Node.js (v18 이상 권장)
*   npm

### 설치 및 실행

1.  **저장소 클론**
    ```bash
    git clone https://github.com/your-username/mermaid-web.git
    cd mermaid-web
    ```

2.  **패키지 설치**
    ```bash
    npm install
    ```

3.  **개발 서버 실행**
    ```bash
    npm run dev
    ```
    브라우저에서 `http://localhost:5173`으로 접속하여 확인합니다.

## 📂 프로젝트 구조

```
mermaid-web/
├── docs/               # 프로젝트 문서 (기획안, 작업 내역 등)
├── public/             # 정적 리소스
├── src/
│   ├── components/     # UI 컴포넌트 (FileUpload, DiagramViewer 등)
│   ├── utils/          # 핵심 로직 (파서, 다이어그램 생성기)
│   ├── types/          # TypeScript 타입 정의
│   ├── App.tsx         # 메인 애플리케이션 컴포넌트
│   └── main.tsx        # 진입점
├── nokia_viz_v1.py     # (프로토타입) Python 파서 v1
├── nokia_viz_v2.py     # (프로토타입) Python 파서 v2
└── package.json
```

## 📝 사용 방법

1.  왼쪽 사이드바의 **"Upload Config"** 영역에 Nokia 설정 파일(`.cfg`, `.txt`)을 드래그하거나 클릭하여 업로드합니다.
2.  설정이 파싱되면 아래에 **인터페이스 목록**이 표시됩니다.
3.  다이어그램에 포함하고 싶은 인터페이스를 체크박스로 선택합니다.
    *   *Tip: "Select All"을 눌러 전체를 보거나, 특정 중요 인터페이스만 선택하여 볼 수 있습니다.*
4.  오른쪽 메인 화면에서 실시간으로 생성되는 네트워크 **토폴로지 다이어그램**을 확인합니다.

## 🤝 기여하기

기여는 언제나 환영합니다! 버그를 발견하거나 새로운 기능을 제안하고 싶다면 Issue를 등록하거나 Pull Request를 보내주세요.

## 📄 라이선스

이 프로젝트는 MIT 라이선스를 따릅니다.
