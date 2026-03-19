/**
 * Network Type Extractor
 *
 * 파일 경로에서 Network Type (ISP/MPLS/Cloud)을 추출합니다.
 */

import path from 'path';
import type { NetworkType } from '../../../src/types/services';

/**
 * 파일 경로에서 Network Type 추출
 *
 * @param filePath - 전체 파일 경로 (예: /data/configs/isp/vpls-4073.txt)
 * @returns NetworkType ('isp' | 'mpls' | 'cloud' | 'unknown')
 *
 * @example
 * extractNetworkType('/data/configs/isp/vpls-4073.txt')  → 'isp'
 * extractNetworkType('/data/configs/mpls/router.txt')    → 'mpls'
 * extractNetworkType('/data/configs/test.txt')           → 'unknown'
 */
export function extractNetworkType(filePath: string): NetworkType {
    // 경로 정규화 (Windows/Linux 호환)
    const normalized = path.normalize(filePath).replace(/\\/g, '/');

    // /configs/<type>/ 패턴 매칭
    const match = normalized.match(/\/configs\/([^\/]+)\//);

    if (match) {
        const folder = match[1].toLowerCase();

        // 유효한 Network Type인지 확인
        if (['isp', 'mpls', 'cloud'].includes(folder)) {
            return folder as NetworkType;
        }
    }

    // Default: unknown
    return 'unknown';
}

/**
 * 파일명에서 Network Type 추출 (보조 수단)
 *
 * @param filename - 파일명 (예: vpls-4073_ISP.txt)
 * @returns NetworkType | undefined
 *
 * @example
 * extractFromFilename('vpls-4073_ISP.txt')  → 'isp'
 * extractFromFilename('router_MPLS.txt')    → 'mpls'
 * extractFromFilename('router.txt')         → undefined
 */
function extractFromFilename(filename: string): NetworkType | undefined {
    const match = filename.match(/_(ISP|MPLS|CLOUD)\./i);
    if (match) {
        return match[1].toLowerCase() as NetworkType;
    }
    return undefined;
}

/**
 * Config 내용으로 Network Type 추론 (최후 수단)
 *
 * BGP AS 번호 범위로 망 타입 추론:
 * - Private AS (64512-65535) → MPLS
 * - Public AS (< 64512) → ISP
 *
 * @param config - ParsedConfigV3 (any로 처리하여 순환 참조 방지)
 * @returns NetworkType
 */
function inferFromConfig(config: any): NetworkType {
    // VPRN 서비스에서 BGP AS 추출
    const vprnServices = config.services?.filter((s: any) => s.serviceType === 'vprn') || [];
    const autonomousSystems = vprnServices
        .map((s: any) => s.autonomousSystem)
        .filter((as: number | undefined) => as !== undefined);

    if (autonomousSystems.length === 0) {
        return 'unknown';
    }

    // Private AS 범위 (64512-65535) → MPLS
    if (autonomousSystems.some((as: number) => as >= 64512 && as <= 65535)) {
        return 'mpls';
    }

    // Public AS 범위 → ISP
    if (autonomousSystems.some((as: number) => as < 64512)) {
        return 'isp';
    }

    return 'unknown';
}

/**
 * 하이브리드 Network Type 결정 (우선순위 기반)
 *
 * Priority:
 * 1. 경로 기반 추출
 * 2. 파일명 접미사
 * 3. Config 내용 추론
 *
 * @param filePath - 파일 경로
 * @param filename - 파일명
 * @param config - 파싱된 설정 (선택)
 * @returns NetworkType
 *
 * @example
 * // 경로 우선
 * determineNetworkType('/configs/isp/router_MPLS.txt', 'router_MPLS.txt')
 * → 'isp' (경로가 우선)
 *
 * // 파일명 사용
 * determineNetworkType('/configs/router_ISP.txt', 'router_ISP.txt')
 * → 'isp' (파일명 접미사)
 *
 * // Config 추론
 * determineNetworkType('/configs/router.txt', 'router.txt', config)
 * → 'mpls' (BGP AS 범위로 추론)
 */
export function determineNetworkType(
    filePath: string,
    filename: string,
    config?: any
): NetworkType {
    // 1순위: 경로 기반
    const pathType = extractNetworkType(filePath);
    if (pathType !== 'unknown') {
        return pathType;
    }

    // 2순위: 파일명 접미사
    const filenameType = extractFromFilename(filename);
    if (filenameType) {
        return filenameType;
    }

    // 3순위: Config 내용 추론
    if (config) {
        return inferFromConfig(config);
    }

    return 'unknown';
}
