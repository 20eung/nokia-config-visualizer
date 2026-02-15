# v1.7.0 - VRRP VIP and Master Display

## 🆕 주요 기능

### VRRP VIP 표시

VRRP(Virtual Router Redundancy Protocol) 설정이 있는 인터페이스의 VIP(Virtual IP)를 다이어그램에 표시합니다.

**표시 형식**:
- **VIP**: IP 주소 아래에 `(VIP: x.x.x.x)` 형식
- **Master**: Priority >= 100인 경우 IP 앞에 `*` 표시

**예시**:

**Master (priority 110)**:
```
Host: AINet_NewYork_Nokia_Equipment_I_BB3
Port: 3/1/1
Interface: p3/1/1
IP: *51.51.34.218/30
(VIP: 51.51.34.217)
Service: VPRN 100
```

**Backup (priority 90)**:
```
Host: AINet_NewYork_Nokia_Equipment_I_BB4
Port: 3/1/1
Interface: p3/1/1
IP: 51.51.34.222/30
(VIP: 51.51.34.217)
Service: VPRN 100
```

## 🔧 구현 내용

### 1. 타입 정의 확장

**파일**: `src/types.ts`

```typescript
export interface NokiaInterface {
  // ... 기존 필드
  vrrpVip?: string;       // VRRP Virtual IP
  vrrpPriority?: number;  // VRRP Priority (for master detection)
}
```

### 2. Nokia Parser 확장

**파일**: `src/utils/nokiaParser.ts`

VRRP 블록에서 VIP 및 Priority 추출:
```typescript
// Extract VRRP VIP and Priority
const vrrpMatch = ifBlock.match(/vrrp\s+\d+[\s\S]*?(?=\n\s{12}exit|\n\s{8}exit)/);
if (vrrpMatch) {
  const vrrpBlock = vrrpMatch[0];
  
  // Extract VIP from backup line
  const vipMatch = vrrpBlock.match(/backup\s+(\S+)/);
  if (vipMatch) {
    intf.vrrpVip = vipMatch[1];
  }
  
  // Extract priority
  const priorityMatch = vrrpBlock.match(/priority\s+(\d+)/);
  if (priorityMatch) {
    intf.vrrpPriority = parseInt(priorityMatch[1], 10);
  }
}
```

### 3. Mermaid Generator 확장

**파일**: `src/utils/mermaidGenerator.ts`

다이어그램 노드 라벨에 VRRP 정보 추가:
```typescript
// VRRP Master detection: priority >= 100
const isMaster = intf.vrrpPriority && intf.vrrpPriority >= 100;
const ipDisplay = isMaster ? `*${ipAddr}` : ipAddr;

// Add VIP if exists
if (intf.vrrpVip) {
  label += `(VIP: ${intf.vrrpVip})<br/>`;
}
```

## 📝 변경된 파일

- `src/types.ts` - vrrpVip, vrrpPriority 필드 추가
- `src/utils/nokiaParser.ts` - VRRP 파싱 로직 추가
- `src/utils/mermaidGenerator.ts` - VIP 및 Master 표시 로직 추가
- `package.json` - v1.7.0
- `CHANGELOG.md` - 변경사항 추가

## 💡 사용 방법

1. VRRP가 설정된 인터페이스 선택
2. 다이어그램에서 VIP 및 Master 확인
   - Master: IP 앞에 `*` 표시
   - VIP: IP 아래에 `(VIP: x.x.x.x)` 표시

## 🔍 지원하는 VRRP 설정

**config1.txt (BB3) - Master**:
```
vrrp 10
    backup 51.51.34.217    # VIP
    priority 110           # Master
```

**config2.txt (BB4) - Backup**:
```
vrrp 10
    backup 51.51.34.217    # VIP (동일)
    priority 90            # Backup
```

## 📊 버전 히스토리

- v1.0.0 (2025-12-14) - 초기 릴리즈
- v1.1.0 (2025-12-14) - HA 다이어그램 생성 기능
- v1.2.0 (2025-12-14) - HA 다이어그램 표시 개선
- v1.3.0 (2025-12-15) - 고급 검색 기능 (AND/OR)
- v1.4.0 (2025-12-15) - 동적 HA 감지
- v1.5.0 (2025-12-15) - Mermaid 코드 보기 UX 개선
- v1.6.0 (2025-12-15) - 인터페이스 리스트 계층 구조
- **v1.7.0 (2025-12-15) - VRRP VIP 및 Master 표시** ⭐
