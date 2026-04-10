/**
 * 문자열 정규화 유틸리티
 *
 * 기존 Dashboard.tsx(line 23), ServiceListV3.tsx(line 64)에 중복 정의되어 있던
 * normalizeSearchString 함수를 공유 유틸로 추출 (v5.8.0)
 */

/**
 * Unicode 하이픈 변형 문자 정규식
 * 모듈 레벨에서 한 번만 컴파일됨
 *
 * 대상: U+2010 ~ U+2015, U+2212 (minus sign), U+FE58, U+FE63, U+FF0D
 */
const RE_UNICODE_HYPHEN = /[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g;

/**
 * 검색어 정규화 헬퍼
 *
 * - NFKD 정규화로 호환 문자 처리
 * - Unicode 하이픈 변형 → ASCII 하이픈(U+002D) 통일
 * - 소문자 변환
 */
export function normalizeSearchString(str: string): string {
  return str
    .normalize('NFKD')
    .replace(RE_UNICODE_HYPHEN, '-')
    .toLowerCase();
}
