/**
 * API 베이스 경로
 * - 직접 접속 (ncv.hub.sk-net.com): "" (빈 문자열)
 * - Portal 프록시 (/services/visualizer): "/services/visualizer"
 * 빌드 시 VITE_API_URL 환경변수로 주입됨
 */
export const API_BASE = (import.meta.env['VITE_API_URL'] as string | undefined) ?? '';
