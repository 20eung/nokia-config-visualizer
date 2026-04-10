# Design: QoS PNG 렌더링 버그 수정

> **Plan 참조**: `docs/01-plan/features/qos-png-fix.plan.md`
> **Date**: 2026-04-10
> **Feature**: qos-png-fix

---

## 1. 문제 구조 분석

### 1.1 렌더링 경로 비교

```
IES 다이어그램 경로:
  parserV3.ts → v1IESAdapter.ts → mermaidGenerator.ts
                                    └─ buildQosEdgeLabel()
                                         └─ <div class='qos-label'>  ← inline style 없음

Epipe/VPLS/VPRN 경로:
  parserV3.ts → mermaidGeneratorV3.ts
                  └─ qosHighlight()
                       └─ <span class='qos-hl' style='...'>  ← inline style 있음
```

### 1.2 PNG 변환 시 스타일 손실 메커니즘

```
[Mermaid SVG]
  └─ <foreignObject>         ← SVG 내부 HTML 컨테이너
       └─ <div class='qos-label'>  ← 외부 CSS만 의존
            └─ "In-QoS: Default"

[html2canvas 처리]
  1. SVG를 data:image/svg+xml로 직렬화
  2. <img> 태그로 렌더링
  3. foreignObject 내부 HTML → 외부 CSS sheet 접근 불가
  4. inline style 없음 → 스타일 전혀 적용 안 됨

[Canvas 2D 오버레이 (현재 코드)]
  querySelectorAll('.qos-hl')  ← .qos-label 탐색 안 함
  → qosRects.length === 0
  → 오버레이 그리기 실행되지 않음
```

---

## 2. 수정 설계

### 2.1 수정 파일 1: `src/utils/mermaidGenerator.ts`

#### 변경 함수: `buildQosEdgeLabel()` (line 202–207)

**현재 코드:**
```typescript
function buildQosEdgeLabel(intf: NokiaInterface): string {
  const inQos = formatQosEdgeRate(intf.ingressQos || 'Default', intf.ingressQosRate, intf.ingressQosRateMax);
  const outQos = formatQosEdgeRate(intf.egressQos || 'Default', intf.egressQosRate, intf.egressQosRateMax);
  const content = `In\u2011QoS:\u00A0${inQos}\u003cbr/\u003eOut\u2011QoS:\u00A0${outQos}`;
  return `\u003cdiv class='qos-label'\u003e${content}\u003c/div\u003e`;
}
```

**수정 후:**
```typescript
function buildQosEdgeLabel(intf: NokiaInterface): string {
  const inQos = formatQosEdgeRate(intf.ingressQos || 'Default', intf.ingressQosRate, intf.ingressQosRateMax);
  const outQos = formatQosEdgeRate(intf.egressQos || 'Default', intf.egressQosRate, intf.egressQosRateMax);
  const content = `In\u2011QoS:\u00A0${inQos}\u003cbr/\u003eOut\u2011QoS:\u00A0${outQos}`;
  const style = 'background-color:#4caf50;color:#ffffff;-webkit-text-fill-color:#ffffff;'
              + 'padding:2px 6px;border-radius:4px;display:inline-block;'
              + 'border:1px solid #388e3c;white-space:nowrap;'
              + 'font-size:0.75rem;line-height:1.2;text-align:center;';
  return `\u003cdiv class='qos-label' style='${style}'\u003e${content}\u003c/div\u003e`;
}
```

**변경 이유**: `qosHighlight()` (mermaidGeneratorV3.ts)와 동일한 패턴으로 inline style 추가. `-webkit-text-fill-color` 포함하여 WebKit 계열 브라우저에서도 흰색 글자 보장.

---

### 2.2 수정 파일 2: `src/components/v3/ServiceDiagram.tsx`

#### 변경 A: `useEffect` 내 스타일 주입 (line 87–95)

**현재 코드:**
```typescript
diagramRef.current.querySelectorAll<HTMLElement>('.qos-hl').forEach(el => {
    el.style.setProperty('background-color', '#4caf50', 'important');
    el.style.setProperty('color', '#ffffff', 'important');
    el.style.setProperty('-webkit-text-fill-color', '#ffffff', 'important');
    el.style.setProperty('padding', '1px 4px', 'important');
    el.style.setProperty('border-radius', '3px', 'important');
    el.style.setProperty('border', '1px solid #388e3c', 'important');
    el.style.setProperty('display', 'inline-block', 'important');
});
```

**수정 후:**
```typescript
diagramRef.current.querySelectorAll<HTMLElement>('.qos-hl, .qos-label').forEach(el => {
    const isLabel = el.classList.contains('qos-label');
    el.style.setProperty('background-color', '#4caf50', 'important');
    el.style.setProperty('color', '#ffffff', 'important');
    el.style.setProperty('-webkit-text-fill-color', '#ffffff', 'important');
    el.style.setProperty('padding', isLabel ? '2px 6px' : '1px 4px', 'important');
    el.style.setProperty('border-radius', isLabel ? '4px' : '3px', 'important');
    el.style.setProperty('border', '1px solid #388e3c', 'important');
    el.style.setProperty('display', 'inline-block', 'important');
});
```

#### 변경 B: `handleCopyImagePNG` — qosRects 수집 (line 131–132)

**현재 코드:**
```typescript
const qosRects = Array.from(
    diagramRef.current.querySelectorAll<HTMLElement>('.qos-hl')
).map(el => {
```

**수정 후:**
```typescript
const qosRects = Array.from(
    diagramRef.current.querySelectorAll<HTMLElement>('.qos-hl, .qos-label')
).map(el => {
```

#### 변경 C: `handleCopyImagePNG` — `onclone` 핸들러 (line 166)

**현재 코드:**
```typescript
element.querySelectorAll<HTMLElement>('.qos-hl').forEach(el => {
    el.style.setProperty('background-color', '#4caf50', 'important');
    el.style.setProperty('color', '#ffffff', 'important');
    el.style.setProperty('display', 'inline-block', 'important');
    el.style.setProperty('padding', '1px 4px', 'important');
    el.style.setProperty('border-radius', '3px', 'important');
    el.style.setProperty('border', '1px solid #388e3c', 'important');
});
```

**수정 후:**
```typescript
element.querySelectorAll<HTMLElement>('.qos-hl, .qos-label').forEach(el => {
    const isLabel = el.classList.contains('qos-label');
    el.style.setProperty('background-color', '#4caf50', 'important');
    el.style.setProperty('color', '#ffffff', 'important');
    el.style.setProperty('display', 'inline-block', 'important');
    el.style.setProperty('padding', isLabel ? '2px 6px' : '1px 4px', 'important');
    el.style.setProperty('border-radius', isLabel ? '4px' : '3px', 'important');
    el.style.setProperty('border', '1px solid #388e3c', 'important');
});
```

---

## 3. 수정 적용 흐름

```
수정 후 PNG 생성 흐름 (IES 다이어그램):

1. buildQosEdgeLabel() 호출
   → <div class='qos-label' style='background-color:#4caf50;...'>
                                    ↑ inline style 포함

2. Mermaid SVG 렌더링 완료 후 useEffect 실행
   → querySelectorAll('.qos-hl, .qos-label') 로 두 타입 모두 탐색
   → .qos-label 요소에도 inline style 강제 주입

3. Copy PNG 클릭 → handleCopyImagePNG 실행
   → querySelectorAll('.qos-hl, .qos-label') 로 qosRects 수집
   → qosRects.length > 0 (IES에서도 동작)

4. html2canvas 캡처
   → onclone에서 .qos-label에도 inline style 주입

5. Canvas 2D 오버레이
   → qosRects의 각 위치에 초록색 배경 + 흰색 텍스트 덧그리기
   → IES QoS 엣지 레이블 정상 표시
```

---

## 4. 수정 범위 요약

| 파일 | 함수/위치 | 변경 내용 | 변경 라인 수 |
|------|----------|----------|------------|
| `src/utils/mermaidGenerator.ts` | `buildQosEdgeLabel()` | inline style 추가 | +3 |
| `src/components/v3/ServiceDiagram.tsx` | `useEffect` 스타일 주입 | selector 확장 + isLabel 분기 | +3 |
| `src/components/v3/ServiceDiagram.tsx` | `handleCopyImagePNG` qosRects 수집 | selector 확장 | +1 |
| `src/components/v3/ServiceDiagram.tsx` | `onclone` 핸들러 | selector 확장 + isLabel 분기 | +3 |

**총 변경**: 2개 파일, ~10줄

---

## 5. 검증 기준

| 항목 | 기준 | 확인 방법 |
|------|------|---------|
| IES QoS PNG | 초록 배경 + 흰 글자 | Copy PNG 후 붙여넣기 |
| Epipe/VPLS/VPRN QoS PNG | 기존 동작 유지 | Copy PNG 후 붙여넣기 |
| 웹 렌더링 | 변경 없음 (기존 정상) | 브라우저 화면 확인 |
