# PDCA Plan: VPLS 4073 networkType Overwrite Bug

> **Feature**: vpls4073-networktype-overwrite
> **Date**: 2026-03-19
> **Priority**: High (Data Integrity)

## 1. Problem Statement

### 1.1 Current Behavior
- AutoParser correctly parses configs with networkType (ISP/MPLS/Cloud)
- VPLS 4073 is correctly separated: `vpls-4073-isp`, `vpls-4073-mpls`
- **After browser access**: all networkType values become `null`, selectionKey reverts to `vpls-4073`

### 1.2 Root Cause
Frontend `useConfigSync` hook (`src/hooks/useConfigSync.ts`) calls `POST /api/ncv/analyze` which **overwrites** configStore entries **without networkType**.

**Data Flow (Bug):**
```
AutoParser → configStore.set({networkType: 'isp', selectionKey: 'vpls-4073-isp'})
   ↓ (user opens browser)
Frontend useConfigSync → POST /api/ncv/analyze → configStore.set({networkType: undefined})
   → selectionKey reverts to 'vpls-4073' (no suffix)
```

### 1.3 Impact
- ISP/MPLS services with same ID (VPLS 4073) collide again
- Dashboard networkType statistics lost
- Network type filter buttons non-functional

## 2. Solution Design

### 2.1 Fix Strategy: Preserve Existing networkType

**Option A (Selected)**: Modify `POST /api/ncv/analyze` to preserve existing networkType from configStore when incoming data doesn't include it.

**Rationale**: Minimal change, backward compatible, server-side fix (no frontend change needed).

### 2.2 Implementation Plan

| # | File | Change | Lines |
|---|------|--------|-------|
| 1 | `server/src/routes/ncv.ts` | Preserve existing networkType in POST /analyze | ~10 |
| 2 | `server/src/routes/ncv.ts` | Apply preserved networkType to incoming services | ~15 |

### 2.3 Fix Detail

In `POST /api/ncv/analyze`:
1. Check if filename already exists in configStore
2. If existing entry has `networkType`, preserve it
3. Apply networkType to incoming `configSummary.devices[].services[]`:
   - Set `service.networkType = existingNetworkType`
   - Regenerate `service.selectionKey` with networkType suffix

## 3. Verification Plan

| # | Check | Expected |
|---|-------|----------|
| 1 | API test after fix | VPLS 4073 maintains ISP/MPLS separation |
| 2 | Frontend sync simulation | POST /analyze preserves networkType |
| 3 | Container restart | networkType persists correctly |

## 4. Timeline

- Implementation: immediate (single session)
- Verification: API + Docker rebuild
