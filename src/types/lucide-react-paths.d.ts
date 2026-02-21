/**
 * lucide-react 직접 경로 import를 위한 타입 선언
 *
 * bundle-barrel-imports 최적화를 위해 직접 경로 import 사용:
 *   import PanelLeft from 'lucide-react/dist/esm/icons/panel-left'
 *
 * lucide-react v0.556.0은 dist/esm/icons/*.js 파일에 대한
 * .d.ts 선언 파일을 제공하지 않으므로 와일드카드 모듈 선언으로 처리
 *
 * 중요: 최상위에 import가 있으면 TypeScript가 이 파일을 "모듈"로 취급하여
 * 와일드카드 declare module이 ambient 선언이 아닌 module augmentation으로
 * 처리되어 작동하지 않음. import는 반드시 declare module 블록 내부에 위치해야 함.
 */

declare module 'lucide-react/dist/esm/icons/*' {
    import type { LucideIcon } from 'lucide-react';
    const icon: LucideIcon;
    export default icon;
}
