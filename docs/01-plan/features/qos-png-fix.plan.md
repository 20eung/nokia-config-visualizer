# Plan: QoS PNG 렌더링 버그 수정

## Context

Copy PNG 버튼 클릭 시 IES 다이어그램의 QoS 엣지 레이블(초록색 배경+흰색 글자)이 웹에서는 정상 표시되지만 PNG로 내보낼 때 스타일 없는 일반 텍스트로 나타나는 문제 수정.

---

## 근본 원인 분석

**핵심 원인: CSS 클래스 이름 불일치 + 인라인 스타일 누락**

IES 다이어그램 QoS 레이블은 두 가지 렌더링 경로를 사용한다:

| 경로 | 사용 클래스 | 인라인 스타일 |
|------|------------|--------------|
| Epipe/VPLS/VPRN (`mermaidGeneratorV3.ts`) | `.qos-hl` | ✅ 있음 |
| IES (`mermaidGenerator.ts:buildQosEdgeLabel`) | `.qos-label` | ❌ 없음 |

**구체적 문제 3가지:**

1. `buildQosEdgeLabel()` 함수가 `<div class='qos-label'>` 만 생성 — inline style 없음
   - html2canvas는 SVG `<foreignObject>` 내부에 외부 CSS(`.qos-label` 클래스) 미적용
   - 결과: 스타일 없는 텍스트로 렌더링

2. `handleCopyImagePNG`의 Canvas 2D 오버레이가 `.qos-hl`만 탐색:
   ```typescript
   diagramRef.current.querySelectorAll<HTMLElement>('.qos-hl')
   ```
   → IES 다이어그램에서 `qosRects.length === 0`, 오버레이 전혀 그리지 않음

3. `useEffect`의 인라인 스타일 재주입도 `.qos-hl`만 대상:
   ```typescript
   diagramRef.current.querySelectorAll<HTMLElement>('.qos-hl').forEach(...)
   ```
   → `.qos-label` 요소에 스타일 미적용

---

## 수정 계획

### 파일 1: `src/utils/mermaidGenerator.ts`

**변경 위치**: `buildQosEdgeLabel()` 함수 (line 202–207)

```typescript
// 현재 (잘못됨)
function buildQosEdgeLabel(intf: NokiaInterface): string {
  const content = `...`;
  return `<div class='qos-label'>${content}</div>`;
}

// 수정 후
function buildQosEdgeLabel(intf: NokiaInterface): string {
  const content = `...`;
  const style = "background-color:#4caf50;color:#ffffff;padding:2px 6px;border-radius:4px;"
              + "display:inline-block;border:1px solid #388e3c;white-space:nowrap;"
              + "font-size:0.75rem;line-height:1.2;text-align:center;";
  return `<div class='qos-label' style='${style}'>${content}</div>`;
}
```

### 파일 2: `src/components/v3/ServiceDiagram.tsx`

**변경 위치 A**: `useEffect` 내 인라인 스타일 주입 (line 87–95)

```typescript
// 현재: .qos-hl 만 처리
diagramRef.current.querySelectorAll<HTMLElement>('.qos-hl').forEach(el => { ... });

// 수정 후: .qos-hl + .qos-label 모두 처리
const QOS_SELECTOR = '.qos-hl, .qos-label';
diagramRef.current.querySelectorAll<HTMLElement>(QOS_SELECTOR).forEach(el => {
    const isLabel = el.classList.contains('qos-label');
    el.style.setProperty('background-color', '#4caf50', 'important');
    el.style.setProperty('color', '#ffffff', 'important');
    el.style.setProperty('display', isLabel ? 'block' : 'inline-block', 'important');
    el.style.setProperty('border-radius', isLabel ? '4px' : '3px', 'important');
    el.style.setProperty('border', '1px solid #388e3c', 'important');
    el.style.setProperty('padding', isLabel ? '2px 6px' : '1px 4px', 'important');
});
```

**변경 위치 B**: `handleCopyImagePNG` — qosRects 수집 (line 131–145)

```typescript
// 현재: .qos-hl 만 수집
diagramRef.current.querySelectorAll<HTMLElement>('.qos-hl')

// 수정 후: 두 클래스 모두 수집
diagramRef.current.querySelectorAll<HTMLElement>('.qos-hl, .qos-label')
```

**변경 위치 C**: `handleCopyImagePNG` — `onclone` 핸들러 (line 166–173)

```typescript
// 현재: .qos-hl 만 처리
element.querySelectorAll<HTMLElement>('.qos-hl').forEach(el => { ... });

// 수정 후: 두 클래스 모두 처리
element.querySelectorAll<HTMLElement>('.qos-hl, .qos-label').forEach(el => { ... });
```

---

## 수정 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `src/utils/mermaidGenerator.ts` | `buildQosEdgeLabel()` — inline style 추가 |
| `src/components/v3/ServiceDiagram.tsx` | 3곳에서 selector를 `.qos-hl, .qos-label`로 확장 |

---

## 검증 방법

1. `sudo docker-compose up -d --force-recreate` 로 재빌드
2. Nokia Config 파일 업로드 후 IES 서비스 다이어그램 선택
3. Copy PNG 클릭 → 붙여넣기 또는 다운로드된 PNG 확인
4. QoS 엣지 레이블이 초록색 배경 + 흰색 글자로 표시되는지 확인
5. Epipe/VPLS/VPRN 다이어그램도 Copy PNG 확인 (기존 동작 유지)
