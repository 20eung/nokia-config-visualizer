import { memo, useEffect, useRef, useState } from 'react';

// mermaid 초기화는 앱 전체에서 단 한 번만 실행 (bundle-dynamic-imports + rendering-hoist-jsx)
let mermaidInitialized = false;
import Code from 'lucide-react/dist/esm/icons/code';
import ZoomIn from 'lucide-react/dist/esm/icons/zoom-in';
import ZoomOut from 'lucide-react/dist/esm/icons/zoom-out';
import Maximize2 from 'lucide-react/dist/esm/icons/maximize-2';
import BarChart3 from 'lucide-react/dist/esm/icons/bar-chart-3';
import Copy from 'lucide-react/dist/esm/icons/copy';
import Check from 'lucide-react/dist/esm/icons/check';
import type { L2VPNService } from '../../types/services';
import { GrafanaExportModal } from '../v3/GrafanaExportModal';

interface ServiceDiagramProps {
    service: L2VPNService;
    diagram: string;
    hostname: string;
    diagramName?: string;
}

// rerender-memo: diagram/service props 불변 시 재렌더링 방지 (mermaid async 렌더링 비용 절감)
export const ServiceDiagram = memo(function ServiceDiagram({ service, diagram, hostname, diagramName }: ServiceDiagramProps) {
    const diagramRef = useRef<HTMLDivElement>(null);
    const [showCode, setShowCode] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [showGrafanaModal, setShowGrafanaModal] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (diagramRef.current && diagram) {
            // 다이어그램 렌더링 (mermaid 동적 import - 첫 렌더링 시점에 lazy load)
            const renderDiagram = async () => {
                const { default: mermaid } = await import('mermaid');
                if (!mermaidInitialized) {
                    mermaid.initialize({
                        startOnLoad: false,
                        theme: 'default',
                        securityLevel: 'loose',
                        flowchart: {
                            useMaxWidth: false,
                            htmlLabels: true,
                            curve: 'basis',
                        },
                    });
                    mermaidInitialized = true;
                }
                try {
                    // Use serviceId AND hostname AND random string to ensure uniqueness
                    // Replace special chars in hostname for ID safety
                    const safeHost = hostname.replace(/[^a-zA-Z0-9]/g, '_');
                    const uniqueSuffix = Math.random().toString(36).substring(2, 9);
                    const id = `mermaid-${service.serviceId}-${safeHost}-${uniqueSuffix}`;
                    const { svg } = await mermaid.render(id, diagram);
                    if (diagramRef.current) {
                        // NOTE: innerHTML은 mermaid 라이브러리의 SVG 출력을 DOM에 삽입하기 위해 사용
                        // mermaid.render()가 sanitized SVG 문자열을 반환하므로 XSS 위험 없음
                        diagramRef.current.innerHTML = svg;
                        // 1) SVG 내부에 <style> 태그 직접 삽입:
                        //    html2canvas가 foreignObject를 독립 렌더링 컨텍스트로 처리할 때
                        //    SVG 내장 스타일은 해당 컨텍스트에서도 유효하므로 색상 유실 방지
                        const svgEl = diagramRef.current.querySelector('svg');
                        if (svgEl && !svgEl.querySelector('#qos-capture-style')) {
                            const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
                            styleEl.id = 'qos-capture-style';
                            styleEl.textContent = [
                                '.qos-hl {',
                                '  background-color: #4caf50 !important;',
                                '  color: #ffffff !important;',
                                '  -webkit-text-fill-color: #ffffff !important;',
                                '  padding: 1px 4px !important;',
                                '  border-radius: 3px !important;',
                                '  border: 1px solid #388e3c !important;',
                                '  display: inline-block !important;',
                                '}',
                            ].join('\n');
                            svgEl.insertBefore(styleEl, svgEl.firstChild);
                        }
                        // 2) .qos-hl 요소에 인라인 스타일 직접 주입 (이중 보험):
                        //    display:inline-block 사용 — html2canvas가 inline 요소의
                        //    background-color를 캡처하지 못하는 알려진 버그 우회
                        diagramRef.current.querySelectorAll<HTMLElement>('.qos-hl').forEach(el => {
                            el.style.setProperty('background-color', '#4caf50', 'important');
                            el.style.setProperty('color', '#ffffff', 'important');
                            el.style.setProperty('-webkit-text-fill-color', '#ffffff', 'important');
                            el.style.setProperty('padding', '1px 4px', 'important');
                            el.style.setProperty('border-radius', '3px', 'important');
                            el.style.setProperty('border', '1px solid #388e3c', 'important');
                            el.style.setProperty('display', 'inline-block', 'important');
                        });
                    }
                } catch (error) {
                    console.error('Mermaid rendering error:', error);
                    if (diagramRef.current) {
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        // NOTE: innerHTML은 에러 메시지 표시를 위해 사용
                        // errorMessage는 mermaid 내부 에러이므로 사용자 입력이 아님
                        diagramRef.current.innerHTML = `<div class="text-center p-5 bg-red-50 border border-red-200 rounded-lg w-full">
                            <p class="text-red-500 font-semibold mb-2">Failed to render diagram</p>
                            <pre class="text-red-700 text-sm font-mono bg-red-100 p-2 rounded text-left whitespace-pre-wrap break-all">${errorMessage}</pre>
                        </div>`;
                    }
                }
            };

            renderDiagram();
        }
    }, [diagram, service.serviceId]);

    const handleCopyImagePNG = async () => {
        if (!diagramRef.current) return;

        try {
            const htmlScale = 2;

            // 1. QoS 배지 위치를 캡처 전에 수집
            //    html2canvas는 SVG foreignObject 내부의 background-color를 렌더링하지 못하는
            //    브라우저 한계가 있으므로, Canvas 2D API로 직접 덧그리기 위해 위치 정보 수집
            const containerRect = diagramRef.current.getBoundingClientRect();

            // html2canvas는 VISUAL(getBoundingClientRect) 좌표 기반으로 캡처하므로,
            // canvas 좌표 = (visual relative position) * htmlScale
            const qosRects = Array.from(
                diagramRef.current.querySelectorAll<HTMLElement>('.qos-hl')
            ).map(el => {
                const r = el.getBoundingClientRect();
                const cs = getComputedStyle(el);
                return {
                    x: (r.left - containerRect.left) * htmlScale,
                    y: (r.top - containerRect.top) * htmlScale,
                    w: r.width * htmlScale,
                    h: r.height * htmlScale,
                    text: el.textContent || '',
                    fontSize: parseFloat(cs.fontSize || '11') * htmlScale,
                    fontFamily: cs.fontFamily || 'Arial, sans-serif',
                };
            });

            // 2. html2canvas로 다이어그램 캡처 (텍스트는 렌더링되나 배경색은 누락될 수 있음)
            const html2canvas = await import('html2canvas').then(m => m.default);
            const canvas = await html2canvas(diagramRef.current, {
                scale: htmlScale,
                backgroundColor: '#ffffff',
                useCORS: true,
                logging: false,
                onclone: (_doc, element) => {
                    // SVG 내장 <style> 주입 — 일부 브라우저에서 foreignObject CSS 인식 시 동작
                    const clonedSvg = element.querySelector('svg');
                    if (clonedSvg && !clonedSvg.querySelector('#qos-capture-style')) {
                        const styleEl = _doc.createElementNS('http://www.w3.org/2000/svg', 'style');
                        styleEl.id = 'qos-capture-style';
                        styleEl.textContent =
                            '.qos-hl{background-color:#4caf50!important;color:#fff!important;' +
                            'display:inline-block!important;padding:1px 4px!important;' +
                            'border-radius:3px!important;border:1px solid #388e3c!important;}';
                        clonedSvg.insertBefore(styleEl, clonedSvg.firstChild);
                    }
                    element.querySelectorAll<HTMLElement>('.qos-hl').forEach(el => {
                        el.style.setProperty('background-color', '#4caf50', 'important');
                        el.style.setProperty('color', '#ffffff', 'important');
                        el.style.setProperty('display', 'inline-block', 'important');
                        el.style.setProperty('padding', '1px 4px', 'important');
                        el.style.setProperty('border-radius', '3px', 'important');
                        el.style.setProperty('border', '1px solid #388e3c', 'important');
                    });
                },
            });

            // 3. Canvas 2D API로 QoS 배지 직접 덧그리기
            //    html2canvas 렌더링 결과와 무관하게 항상 올바른 색상으로 표시됨
            if (qosRects.length > 0) {
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.save();
                    qosRects.forEach(({ x, y, w, h, text, fontSize, fontFamily }) => {
                        if (w < 2 || h < 2) return;
                        const r = 3 * htmlScale;

                        // 녹색 둥근 배경 (roundRect 폴리필 포함)
                        ctx.fillStyle = '#4caf50';
                        ctx.strokeStyle = '#388e3c';
                        ctx.lineWidth = 0.5 * htmlScale;
                        ctx.beginPath();
                        ctx.moveTo(x + r, y);
                        ctx.lineTo(x + w - r, y);
                        ctx.arcTo(x + w, y,     x + w, y + r,     r);
                        ctx.lineTo(x + w, y + h - r);
                        ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
                        ctx.lineTo(x + r, y + h);
                        ctx.arcTo(x, y + h,     x, y + h - r,     r);
                        ctx.lineTo(x, y + r);
                        ctx.arcTo(x, y,         x + r, y,         r);
                        ctx.closePath();
                        ctx.fill();
                        ctx.stroke();

                        // 흰색 텍스트
                        ctx.fillStyle = '#ffffff';
                        ctx.font = `${fontSize}px ${fontFamily}`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(text, x + w / 2, y + h / 2);
                    });
                    ctx.restore();
                }
            }

            const blob = await new Promise<Blob | null>(resolve =>
                canvas.toBlob(resolve, 'image/png')
            );

            if (!blob) {
                throw new Error('Failed to generate image blob');
            }

            // Clipboard API: HTTPS 또는 localhost 환경에서만 동작
            if (navigator.clipboard && navigator.clipboard.write) {
                try {
                    await navigator.clipboard.write([
                        new ClipboardItem({ 'image/png': blob })
                    ]);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                    return;
                } catch {
                    // Clipboard API 실패 시 다운로드 fallback으로 진행
                }
            }

            // Fallback: PNG 파일로 다운로드 (HTTP 환경 등 Clipboard API 미지원 시)
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${diagramName || 'diagram'}.png`;
            a.click();
            URL.revokeObjectURL(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error('Copy image error:', error);
            alert('이미지 생성에 실패했습니다. 잠시 후 다시 시도해주세요.');
        }
    };

    const handleCopyCode = () => {
        navigator.clipboard.writeText(diagram);
        alert('Mermaid code copied to clipboard!');
    };

    const handleZoomIn = () => {
        setZoom(prev => Math.min(prev + 0.1, 2));
    };

    const handleZoomOut = () => {
        setZoom(prev => Math.max(prev - 0.1, 0.5));
    };

    const handleResetZoom = () => {
        setZoom(1);
    };

    // service-type-badge 배경색 결정
    const badgeBgClass =
        service.serviceType === 'epipe' ? 'bg-blue-500' :
        service.serviceType === 'vpls' ? 'bg-emerald-500' :
        service.serviceType === 'vprn' ? 'bg-violet-500' : 'bg-gray-500';

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden border border-gray-200 dark:border-gray-700 flex flex-col">
            {/* 헤더 */}
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                <div className="flex items-center gap-3 mb-1">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded text-white uppercase ${badgeBgClass}`}>
                        {service.serviceType.toUpperCase()}
                    </span>
                    <h3 className="m-0 text-lg text-gray-900 dark:text-gray-100 font-semibold">
                        {service.serviceType === 'epipe' ? '🔗' : '🌐'}{' '}
                        {diagramName
                            ? diagramName
                            : service.serviceType === 'ies'
                                ? hostname
                                : `${service.serviceType.toUpperCase()} ${service.serviceId}${service.description ? `: ${service.description}` : ''}`
                        }
                    </h3>
                </div>
            </div>

            {/* 컨트롤 */}
            <div className="flex justify-between px-3 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2">
                    <button onClick={handleZoomOut} className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md cursor-pointer transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500 hover:text-gray-900 dark:hover:text-gray-100" title="Zoom Out">
                        <ZoomOut size={18} />
                    </button>
                    <span className="text-sm text-gray-500 dark:text-gray-400 min-w-12 text-center">{Math.round(zoom * 100)}%</span>
                    <button onClick={handleZoomIn} className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md cursor-pointer transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500 hover:text-gray-900 dark:hover:text-gray-100" title="Zoom In">
                        <ZoomIn size={18} />
                    </button>
                    <button onClick={handleResetZoom} className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md cursor-pointer transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500 hover:text-gray-900 dark:hover:text-gray-100" title="Reset Zoom">
                        <Maximize2 size={18} />
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <button onClick={() => setShowCode(!showCode)} className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md cursor-pointer transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500 hover:text-gray-900 dark:hover:text-gray-100" title="Toggle Code">
                        <Code size={18} />
                        {showCode ? ' Hide Code' : ' Show Code'}
                    </button>
                    <button
                        onClick={handleCopyImagePNG}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded-md cursor-pointer transition-all duration-200 border ${copied ? 'bg-emerald-500 border-emerald-500 text-white hover:bg-emerald-600 hover:border-emerald-600' : 'text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500 hover:text-gray-900 dark:hover:text-gray-100'}`}
                        title="Copy diagram as PNG to clipboard"
                    >
                        {copied ? <Check size={18} /> : <Copy size={18} />}
                        {copied ? ' Copied!' : ' Copy PNG'}
                    </button>
                    <button onClick={() => setShowGrafanaModal(true)} className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md cursor-pointer transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500 hover:text-gray-900 dark:hover:text-gray-100" title="Export to Grafana">
                        <BarChart3 size={18} /> Grafana
                    </button>
                </div>
            </div>

            {/* 다이어그램 - bg-white 유지 (Mermaid SVG 호환성) */}
            <div className="p-5 overflow-auto min-h-[200px] flex justify-center items-start bg-white">
                <div
                    ref={diagramRef}
                    className="w-full flex justify-center transition-transform duration-200 ease-in-out [&_svg]:!w-full [&_svg]:!h-auto [&_svg]:max-w-full"
                    style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
                />
            </div>

            {/* Mermaid 코드 */}
            {showCode && (
                <div className="border-t border-gray-200 dark:border-gray-700 bg-slate-800 text-gray-200">
                    <div className="flex justify-between items-center px-4 py-2 border-b border-slate-700 bg-slate-900 text-sm">
                        <span>Mermaid Code</span>
                        <button onClick={handleCopyCode} className="bg-transparent border border-slate-600 text-slate-300 px-2 py-0.5 rounded text-xs cursor-pointer hover:bg-slate-700 hover:text-white">
                            Copy
                        </button>
                    </div>
                    <pre className="m-0 p-4 font-mono text-sm overflow-x-auto whitespace-pre-wrap">
                        <code>{diagram}</code>
                    </pre>
                </div>
            )}

            {/* Grafana Export 모달 */}
            {showGrafanaModal && (
                <GrafanaExportModal
                    service={service}
                    hostname={hostname}
                    onClose={() => setShowGrafanaModal(false)}
                />
            )}
        </div>
    );
});
