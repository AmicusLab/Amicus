/**
 * @fileoverview 마스킹된 값 표시 UI 컴포넌트
 * 
 * 백엔드에서 마스킹된 데이터를 표시하는 UI 컴포넌트
 * 
 * 중요: 프론트엔드는 마스킹을 수행하지 않음
 * 모든 마스킹은 백엔드에서 수행되어야 함
 */

/**
 * 마스킹된 값의 메타데이터
 */
export interface MaskedValueMeta {
  /** 마스킹 여부 */
  isMasked: boolean;
  /** 마스킹된 패턴 목록 (있다면) */
  patterns?: string[];
  /** 원본 타입 */
  originalType?: 'string' | 'object' | 'array' | 'other';
}

/**
 * 마스킹된 값 표시 옵션
 */
export interface MaskedValueOptions {
  /** 최대 표시 길이 */
  maxLength?: number;
  /** 말줄임표 사용 */
  useEllipsis?: boolean;
  /** 마스킹 표시기 스타일 */
  indicatorStyle?: 'badge' | 'icon' | 'text' | 'none';
}

/**
 * 마스킹 감지 패턴 (표시용)
 * 실제 마스킹은 백엔드에서 수행됨
 */
const MASKED_PATTERNS = [
  /\*{3,}REDACTED\*{3,}/,
  /\[MASKED\]/,
  /\[REDACTED\]/,
  /\*\*\*REDACTED\*\*/,
];

/**
 * 값이 마스킹되었는지 확인
 * 
 * @param value - 확인할 값
 * @returns 마스킹 여부
 */
export function isMasked(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  
  return MASKED_PATTERNS.some(pattern => pattern.test(value));
}

/**
 * 마스킹된 값의 메타데이터 추출
 * 
 * @param value - 분석할 값
 * @returns 마스킹 메타데이터
 */
export function getMaskedMeta(value: unknown): MaskedValueMeta {
  if (value === null || value === undefined) {
    return { isMasked: false, originalType: 'other' };
  }
  
  const type = Array.isArray(value) 
    ? 'array' 
    : typeof value === 'object' 
      ? 'object' 
      : typeof value === 'string'
        ? 'string'
        : 'other';
  
  if (type === 'string') {
    const str = value as string;
    const masked = isMasked(str);
    
    return {
      isMasked: masked,
      originalType: 'string',
      patterns: masked ? ['sensitive'] : undefined,
    };
  }
  
  // 객체나 배열의 경우 중첩 검사
  if (type === 'object' || type === 'array') {
    const str = JSON.stringify(value);
    const masked = isMasked(str);
    
    return {
      isMasked: masked,
      originalType: type,
      patterns: masked ? ['sensitive'] : undefined,
    };
  }
  
  return { isMasked: false, originalType: type };
}

/**
 * 마스킹된 값 포맷팅
 * 
 * @param value - 포맷팅할 값
 * @param options - 포맷팅 옵션
 * @returns 포맷팅된 문자열
 */
export function formatMaskedValue(
  value: unknown,
  options: MaskedValueOptions = {}
): string {
  const {
    maxLength = 200,
    useEllipsis = true,
  } = options;
  
  if (value === null || value === undefined) {
    return '';
  }
  
  let str: string;
  
  if (typeof value === 'string') {
    str = value;
  } else if (typeof value === 'object') {
    str = JSON.stringify(value, null, 2);
  } else {
    str = String(value);
  }
  
  // 길이 제한
  if (str.length > maxLength && useEllipsis) {
    return str.substring(0, maxLength) + '...';
  }
  
  return str;
}

/**
 * 마스킹 표시기 생성
 * 
 * @param meta - 마스킹 메타데이터
 * @param style - 표시기 스타일
 * @returns 표시기 문자열
 */
export function createMaskIndicator(
  meta: MaskedValueMeta,
  style: MaskedValueOptions['indicatorStyle'] = 'badge'
): string {
  if (!meta.isMasked) {
    return '';
  }
  
  switch (style) {
    case 'badge':
      return '[MASKED]';
    case 'icon':
      return '🔒';
    case 'text':
      return '(masked)';
    case 'none':
    default:
      return '';
  }
}

/**
 * 마스킹된 값 컴포넌트 (렌더링용 객체)
 * 
 * @param value - 표시할 값
 * @param options - 표시 옵션
 * @returns 렌더링 정보 객체
 */
export function MaskedValue(
  value: unknown,
  options: MaskedValueOptions = {}
): {
  display: string;
  meta: MaskedValueMeta;
  indicator: string;
} {
  const meta = getMaskedMeta(value);
  const display = formatMaskedValue(value, options);
  const indicator = createMaskIndicator(meta, options.indicatorStyle);
  
  return {
    display,
    meta,
    indicator,
  };
}

/**
 * 툴 실행 결과에서 민감 정보 표시용 데이터 추출
 * 
 * @param result - 툴 실행 결과
 * @returns 마스킹된 표시용 데이터
 */
export function extractMaskedToolResult(result: unknown): {
  content: string;
  isMasked: boolean;
  hasError: boolean;
} {
  if (result === null || result === undefined) {
    return { content: '', isMasked: false, hasError: false };
  }
  
  // 에러 메시지 확인
  const str = typeof result === 'string' 
    ? result 
    : JSON.stringify(result);
  
  const hasError = str.toLowerCase().includes('error');
  const masked = isMasked(str);
  
  return {
    content: str,
    isMasked: masked,
    hasError,
  };
}

/**
 * 채팅 메시지에서 민감 정보 표시용 데이터 추출
 * 
 * @param content - 메시지 내용
 * @returns 마스킹된 표시용 데이터
 */
export function extractMaskedChatContent(content: string): {
  display: string;
  isMasked: boolean;
  maskedCount: number;
} {
  if (!content) {
    return { display: '', isMasked: false, maskedCount: 0 };
  }
  
  // 마스킹된 패턴 개수 카운트
  let maskedCount = 0;
  let display = content;
  
  for (const pattern of MASKED_PATTERNS) {
    const matches = content.match(new RegExp(pattern.source, 'g'));
    if (matches) {
      maskedCount += matches.length;
    }
  }
  
  return {
    display,
    isMasked: maskedCount > 0,
    maskedCount,
  };
}

// 타입 export
export type { MaskedValueMeta as MaskedValueMetaType, MaskedValueOptions as MaskedValueOptionsType };
