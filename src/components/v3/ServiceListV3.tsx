import { useState, useMemo, useCallback, useEffect } from 'react';
import type { ParsedConfigV3, NokiaServiceV3 } from '../../utils/v3/parserV3';
import type { IESService, VPRNService, L3Interface } from '../../types/services';
import type { NameDictionary } from '../../types/dictionary';
import { ChevronDown, ChevronRight, BookOpen } from 'lucide-react';
import { findPeerAndRoutes } from '../../utils/mermaidGenerator';
import { convertIESToV1Format } from '../../utils/v1IESAdapter';
import { convertVPRNToV1Format } from '../../utils/v1VPRNAdapter';
import { isValidIPv4, parseNetwork, isIpInSubnet, type SubnetMatch } from '../../utils/ipUtils';
import { AIChatPanel } from './AIChatPanel';
import { DictionaryEditor } from './DictionaryEditor';
import { buildConfigSummary, type ConfigSummary } from '../../utils/configSummaryBuilder';
import { toDictionaryCompact } from '../../utils/dictionaryStorage';
import { loadDictionaryFromServer } from '../../services/dictionaryApi';
import type { ChatResponse } from '../../services/chatApi';
import './ServiceListV3.css';

interface ServiceListProps {
    services: NokiaServiceV3[];
    configs: ParsedConfigV3[];
    selectedServiceIds: string[];
    onToggleService: (serviceKey: string) => void;
    onSetSelected: (serviceKeys: string[]) => void;
}

/**
 * 검색 예시 pill 데이터 구조 (search-examples-ui)
 */
interface SearchExample {
    /** 화면에 표시될 텍스트 */
    label: string;
    /** 검색창에 입력될 실제 쿼리 */
    query: string;
    /** 예시 카테고리 */
    category: 'qos' | 'ip' | 'and' | 'service' | 'port' | 'type';
    /** Tooltip에 표시될 설명 */
    description?: string;
}

export function ServiceListV3({
    services,
    configs,
    selectedServiceIds,
    onToggleService,
    onSetSelected,
}: ServiceListProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'epipe' | 'vpls' | 'vprn' | 'ies'>('all');
    const [aiEnabled, setAiEnabled] = useState(false);
    const [showDictionaryEditor, setShowDictionaryEditor] = useState(false);
    const [dictionary, setDictionary] = useState<NameDictionary | null>(null);

    // ConfigSummary 메모이제이션 (AI 패널용)
    const configSummary = useMemo<ConfigSummary | null>(() => {
        if (configs.length === 0) return null;
        return buildConfigSummary(configs);
    }, [configs]);

    // === Search Examples UI (search-examples-ui) ===
    /**
     * Config 기반 동적 검색 예시 생성 (Phase 2 - v4.8.0 Fixed)
     * - 업로드된 config 파일에서 실제 데이터를 추출하여 검색 예시 생성
     * - **검색 가능한 실제 값만 표시** (단일 키워드, AND 검색 미지원)
     * - 보안: 고객사 이름 제외, config 내 영문 키워드만 사용
     */
    const DYNAMIC_EXAMPLES = useMemo<SearchExample[]>(() => {
        const examples: SearchExample[] = [];

        if (configs.length === 0 || services.length === 0) {
            // Fallback: config 없으면 기본 예시만
            return [
                { label: 'vpls', query: 'vpls', category: 'type', description: 'Filter by service type' },
            ];
        }

        // 1. QoS 예시: "qos" 키워드 (SAP description/JSON에 포함됨)
        outer1: for (const config of configs) {
            for (const svc of config.services) {
                if (svc.serviceType === 'epipe' || svc.serviceType === 'vpls') {
                    for (const sap of svc.saps) {
                        if (sap.ingressQos || sap.egressQos) {
                            examples.push({
                                label: 'qos',
                                query: 'qos',
                                category: 'qos',
                                description: 'QoS policy search'
                            });
                            break outer1;
                        }
                    }
                }
            }
        }

        // 2. IP 예시: Customer Network 대역 (static route prefix에서 추출)
        outer2: for (const config of configs) {
            for (const svc of config.services) {
                if (svc.serviceType === 'vprn' || svc.serviceType === 'ies') {
                    const routes = (svc as VPRNService | IESService).staticRoutes || [];
                    for (const route of routes) {
                        // prefix에서 네트워크 주소 추출 (예: "10.230.34.0/24" → "10.230.34.0")
                        const prefix = route.prefix.split('/')[0];
                        if (isValidIPv4(prefix)) {
                            // 네트워크 주소에서 +1하여 첫 번째 호스트 IP 생성
                            const parts = prefix.split('.');
                            const lastOctet = parseInt(parts[3]);
                            if (lastOctet < 255) {
                                parts[3] = (lastOctet + 1).toString();
                                const hostIp = parts.join('.');
                                examples.push({
                                    label: hostIp,
                                    query: hostIp,
                                    category: 'ip',
                                    description: 'IP address in customer network'
                                });
                                break outer2;
                            }
                        }
                    }
                }
            }
        }

        // 3. AND 검색 예시: port + description (v1.3.0 AND search)
        outer3: for (const config of configs) {
            for (const svc of config.services) {
                if (svc.serviceType === 'epipe' || svc.serviceType === 'vpls') {
                    for (const sap of svc.saps) {
                        if (sap.portId && sap.description) {
                            // description의 첫 단어 추출 (영문 키워드)
                            const firstWord = sap.description.split(/\s+/)[0];
                            if (firstWord && firstWord.length > 2) { // 최소 3글자
                                examples.push({
                                    label: `port + ${firstWord}`,
                                    query: `port + ${firstWord}`,
                                    category: 'and',
                                    description: `AND search: port + ${firstWord}`
                                });
                                break outer3;
                            }
                        }
                    }
                }
            }
        }

        // 4. Service ID 예시: 첫 번째 서비스 ID (숫자만)
        for (const svc of services) {
            examples.push({
                label: svc.serviceId.toString(),
                query: svc.serviceId.toString(),
                category: 'service',
                description: `Service ID: ${svc.serviceId}`
            });
            break;
        }

        // 5. Port 예시: 첫 번째 포트
        outer5: for (const config of configs) {
            for (const svc of config.services) {
                if (svc.serviceType === 'epipe' || svc.serviceType === 'vpls') {
                    for (const sap of svc.saps) {
                        if (sap.portId) {
                            examples.push({
                                label: sap.portId,
                                query: sap.portId,
                                category: 'port',
                                description: 'Port/Interface search'
                            });
                            break outer5;
                        }
                    }
                }
            }
        }

        // 6. Service Type 예시: vpls (정적, 모든 config에 유효)
        examples.push({
            label: 'vpls',
            query: 'vpls',
            category: 'type',
            description: 'Filter by service type'
        });

        return examples;
    }, [configs, services]);

    // 컴포넌트 마운트 시 서버에서 전역 사전 로드
    useEffect(() => {
        if (configs.length === 0) return;
        let cancelled = false;
        loadDictionaryFromServer().then(loaded => {
            if (!cancelled && loaded) {
                setDictionary(loaded);
            }
        });
        return () => { cancelled = true; };
    }, [configs]);

    // AI 전송용 compact dictionary
    const dictionaryCompact = useMemo(() => toDictionaryCompact(dictionary), [dictionary]);

    // 🆕 AI 활성화 시 filterType을 'all'로 초기화 (v4.5.0)
    useEffect(() => {
        if (aiEnabled) {
            setFilterType('all');
        }
    }, [aiEnabled]);

    const handleAIResponse = useCallback((response: ChatResponse) => {
        onSetSelected(response.selectedKeys);
        if (response.filterType && response.filterType !== 'all') {
            setFilterType(response.filterType);
        }
    }, [onSetSelected]);

    /**
     * 검색 예시 pill 클릭 핸들러 (search-examples-ui)
     * 검색창에 예시 쿼리를 입력 (즉시 검색은 실행하지 않음)
     */
    const handleExampleClick = useCallback((query: string) => {
        setSearchQuery(query);
    }, []);

    /**
     * IES 인터페이스 레벨 필터링 (v4.5.0)
     * 검색어에 매칭되는 인터페이스만 포함하는 새 서비스 생성
     */
    const filterIESInterfaces = useCallback((
        service: IESService & { _hostname: string },
        query: string
    ): (IESService & { _hostname: string }) | null => {
        if (!query) return service; // 검색어 없으면 전체 반환

        const filteredInterfaces = service.interfaces.filter(iface => {
            // 인터페이스 특화 필드 검색
            if (iface.interfaceName && iface.interfaceName.toLowerCase().includes(query)) return true;
            if (iface.description && iface.description.toLowerCase().includes(query)) return true;
            if (iface.portId && iface.portId.toLowerCase().includes(query)) return true;
            if (iface.ipAddress && iface.ipAddress.toLowerCase().includes(query)) return true;

            // Catch-all: 인터페이스 전체 JSON 검색
            try {
                const ifaceJson = JSON.stringify(iface).toLowerCase();
                if (ifaceJson.includes(query)) return true;
            } catch (e) {
                console.warn('[filterIESInterfaces] JSON.stringify failed:', e);
            }

            return false;
        });

        // 매칭된 인터페이스가 없으면 null 반환
        if (filteredInterfaces.length === 0) {
            return null;
        }

        // 매칭된 인터페이스만 포함하는 새 서비스 반환
        return {
            ...service,
            interfaces: filteredInterfaces
        };
    }, []);

    /**
     * IP 주소가 서비스의 Static Routes 서브넷에 매칭되는지 확인
     * @returns { matched: boolean, bestMatch: { subnet, prefixLen } | null }
     */
    const matchServiceByIpSubnet = useCallback((
        service: NokiaServiceV3,
        targetIp: string
    ): { matched: boolean; bestMatch: { subnet: string; prefixLen: number } | null } => {
        // IES와 VPRN만 Static Routes 보유
        if (service.serviceType !== 'ies' && service.serviceType !== 'vprn') {
            return { matched: false, bestMatch: null };
        }

        const staticRoutes = (service as IESService | VPRNService).staticRoutes || [];
        let bestMatch: { subnet: string; prefixLen: number } | null = null;

        // ⭐ 최소 Prefix 길이 (너무 넓은 서브넷 제외: /1 ~ /7)
        const MIN_PREFIX_LEN = 8;

        for (const route of staticRoutes) {
            const parsed = parseNetwork(route.prefix);
            if (!parsed) continue;

            // 너무 넓은 서브넷 건너뛰기 (v4.6.0)
            if (parsed.prefixLen < MIN_PREFIX_LEN) continue;

            if (isIpInSubnet(targetIp, route.prefix)) {
                // Longest Prefix Match: prefixLen이 더 큰 것 선택
                if (!bestMatch || parsed.prefixLen > bestMatch.prefixLen) {
                    bestMatch = { subnet: route.prefix, prefixLen: parsed.prefixLen };
                }
            }
        }

        return { matched: !!bestMatch, bestMatch };
    }, []);

    // 필터링된 서비스
    let filteredServices: NokiaServiceV3[];

    // ⭐ IP 서브넷 검색 모드 (v4.6.0)
    if (searchQuery && isValidIPv4(searchQuery.toLowerCase())) {
        const query = searchQuery.toLowerCase();

        // 타입 필터 적용
        let targetServices = services;
        if (filterType !== 'all') {
            targetServices = services.filter(s => s.serviceType === filterType);
        }

        // 서브넷 매칭 결과 수집
        const ipMatches: Array<{ service: NokiaServiceV3; match: SubnetMatch }> = [];

        targetServices.forEach(service => {
            const { matched, bestMatch } = matchServiceByIpSubnet(service, query);
            if (matched && bestMatch) {
                ipMatches.push({
                    service,
                    match: {
                        subnet: bestMatch.subnet,
                        prefixLen: bestMatch.prefixLen,
                        serviceId: service.serviceId
                    }
                });
            }
        });

        // Longest Prefix Match 정렬 (ipMatches를 직접 정렬)
        const sortedIpMatches = ipMatches.sort((a, b) => {
            // prefixLen이 큰 것이 더 구체적 (우선순위 높음)
            if (a.match.prefixLen !== b.match.prefixLen) {
                return b.match.prefixLen - a.match.prefixLen;
            }
            // prefixLen이 같으면 serviceId로 정렬 (안정성)
            return a.match.serviceId - b.match.serviceId;
        });

        // 정렬된 서비스 추출 (service 객체가 그대로 유지되므로 hostname 정보 보존)
        let matchedServices = sortedIpMatches.map(m => m.service);

        // ⭐ IES 인터페이스 레벨 필터링: 검색 IP와 관련된 Static Route를 가진 인터페이스만 포함 (v4.6.0)
        const interfaceFilteredServices = matchedServices.map((service): NokiaServiceV3 | null => {
            if (service.serviceType === 'ies') {
                const hostname = (service as any)._hostname || 'Unknown';
                const iesService = service as IESService & { _hostname: string };

                // 동일 config 내 모든 IES 서비스의 Static Routes 수집
                const parentConfig = configs.find(c => c.hostname === hostname);
                const aggregatedStaticRoutes: Array<{ prefix: string; nextHop: string }> = [];

                if (parentConfig) {
                    parentConfig.services.forEach(svc => {
                        if (svc.serviceType === 'ies') {
                            const ies = svc as IESService;
                            ies.staticRoutes?.forEach(route => {
                                aggregatedStaticRoutes.push({ prefix: route.prefix, nextHop: route.nextHop });
                            });
                        }
                    });
                }

                // V1 변환 및 각 인터페이스의 관련 라우트 확인
                const v1Device = convertIESToV1Format(iesService, hostname, aggregatedStaticRoutes);

                const relevantInterfaces = iesService.interfaces.filter(intf => {
                    const v1Intf = v1Device.interfaces.find(i => i.name === intf.interfaceName);
                    if (!v1Intf) return false;

                    const { relatedRoutes } = findPeerAndRoutes(v1Device, v1Intf);

                    // 관련 라우트 중 검색 IP를 포함하는 것이 있는지 확인
                    return relatedRoutes.some(prefix => isIpInSubnet(query, prefix));
                });

                // 관련 인터페이스가 없으면 null 반환 (서비스 제외)
                if (relevantInterfaces.length === 0) {
                    return null;
                }

                // 관련 인터페이스만 포함하는 새 서비스 반환
                return {
                    ...iesService,
                    interfaces: relevantInterfaces
                } as NokiaServiceV3;
            }

            return service;
        });

        filteredServices = interfaceFilteredServices.filter((s): s is NokiaServiceV3 => s !== null);
    } else {
        // 기존 문자열 검색 로직 (AND/OR 검색 지원 - v1.3.0)
        filteredServices = services.filter(service => {
            // 타입 필터 (IES 포함)
            if (filterType !== 'all' && service.serviceType !== filterType) {
                return false;
            }

            // 검색 필터 (Enhanced with Hostname, Interfaces, IPs, BGP/OSPF, SAP/SDP)
            if (searchQuery) {
                // AND/OR 검색 로직 (v1.3.0)
                const isAndSearch = searchQuery.includes(' + ');
                const searchTerms = isAndSearch
                    ? searchQuery.split(' + ').map(t => t.trim().toLowerCase()).filter(t => t.length > 0)
                    : searchQuery.split(/\s+/).map(t => t.trim().toLowerCase()).filter(t => t.length > 0);

                // 단일 검색어인 경우 기존 로직 유지 (성능 최적화)
                if (searchTerms.length === 1) {
                    const query = searchTerms[0];

            // 기본 서비스 정보
            const basicMatch = (
                service.serviceId.toString().includes(query) ||
                service.description.toLowerCase().includes(query) ||
                (service.serviceName && service.serviceName.toLowerCase().includes(query)) ||
                service.customerId.toString().includes(query)
            );

            if (basicMatch) return true;

            // Hostname 검색
            const hostname = (service as any)._hostname;
            if (hostname && hostname.toLowerCase().includes(query)) return true;

            // 서비스 타입별 상세 검색
            if (service.serviceType === 'epipe') {
                // SAP IDs
                if ('saps' in service && service.saps) {
                    if (service.saps.some(sap => sap.sapId.toLowerCase().includes(query))) return true;
                }
                // SDP IDs
                if ('spokeSdps' in service && service.spokeSdps) {
                    if (service.spokeSdps.some(sdp =>
                        sdp.sdpId.toString().includes(query) ||
                        sdp.vcId.toString().includes(query)
                    )) return true;
                }
            } else if (service.serviceType === 'vpls') {
                // SAP IDs
                if ('saps' in service && service.saps) {
                    if (service.saps.some(sap => sap.sapId.toLowerCase().includes(query))) return true;
                }
                // Spoke SDP IDs
                if ('spokeSdps' in service && service.spokeSdps) {
                    if (service.spokeSdps.some(sdp =>
                        sdp.sdpId.toString().includes(query) ||
                        sdp.vcId.toString().includes(query)
                    )) return true;
                }
                // Mesh SDP IDs
                if ('meshSdps' in service && service.meshSdps) {
                    if (service.meshSdps.some(sdp => sdp.sdpId.toString().includes(query))) return true;
                }
            } else if (service.serviceType === 'vprn') {
                // Interfaces
                if ('interfaces' in service && service.interfaces) {
                    for (const iface of service.interfaces) {
                        // Interface Name
                        if (iface.interfaceName && iface.interfaceName.toLowerCase().includes(query)) return true;
                        // Interface Description
                        if (iface.description && iface.description.toLowerCase().includes(query)) return true;
                        // Port ID
                        if (iface.portId && iface.portId.toLowerCase().includes(query)) return true;
                        // IP Address
                        if (iface.ipAddress && iface.ipAddress.toLowerCase().includes(query)) return true;
                        // VPLS Name
                        if (iface.vplsName && iface.vplsName.toLowerCase().includes(query)) return true;
                        // Spoke SDP
                        if (iface.spokeSdpId && iface.spokeSdpId.toLowerCase().includes(query)) return true;
                    }
                }
                // BGP Information
                if ('bgpRouterId' in service && service.bgpRouterId) {
                    if (service.bgpRouterId.toLowerCase().includes(query)) return true;
                }
                if ('bgpNeighbors' in service && service.bgpNeighbors) {
                    if (service.bgpNeighbors.some(nbr =>
                        nbr.neighborIp.toLowerCase().includes(query) ||
                        (nbr.autonomousSystem && nbr.autonomousSystem.toString().includes(query))
                    )) return true;
                }
                // OSPF Information
                if ('ospf' in service && service.ospf && service.ospf.areas) {
                    for (const area of service.ospf.areas) {
                        // Area ID
                        if (area.areaId.toLowerCase().includes(query)) return true;
                        // OSPF Interfaces
                        if (area.interfaces && area.interfaces.some(intf =>
                            intf.interfaceName.toLowerCase().includes(query)
                        )) return true;
                    }
                }
                // AS, RD
                if ('autonomousSystem' in service && service.autonomousSystem) {
                    if (service.autonomousSystem.toString().includes(query)) return true;
                }
                if ('routeDistinguisher' in service && service.routeDistinguisher) {
                    if (service.routeDistinguisher.toLowerCase().includes(query)) return true;
                }
            } else if (service.serviceType === 'ies') {
                // ⚠️ IES는 여기서 true/false 판단하지 않음!
                // 인터페이스 레벨 필터링은 별도 로직으로 처리 (v4.5.0)
                return true; // 일단 통과시키고 나중에 필터링
            }

            // Catch-all: 서비스 객체 전체를 JSON으로 변환하여 검색 (v4.5.0)
            // 파싱된 모든 필드를 누락 없이 검색합니다
            // (IES는 위에서 이미 return true 처리되어 여기 도달하지 않음)
            try {
                const serviceJson = JSON.stringify(service).toLowerCase();
                if (serviceJson.includes(query)) return true;
            } catch (e) {
                // JSON.stringify 실패 시 무시
                console.warn('[ServiceListV3] JSON.stringify failed for service:', service.serviceId, e);
            }

            return false;
                } else {
                    // 복수 검색어 (AND/OR 검색 - v1.3.0 복원)
                    // 모든 검색 가능한 필드를 수집
                    const searchFields: string[] = [];

                    // 기본 서비스 정보
                    searchFields.push(
                        service.serviceId.toString(),
                        service.description,
                        service.serviceName || '',
                        service.customerId.toString()
                    );

                    // Hostname
                    const hostname = (service as any)._hostname;
                    if (hostname) searchFields.push(hostname);

                    // 서비스 타입별 상세 필드 수집
                    if (service.serviceType === 'epipe' || service.serviceType === 'vpls') {
                        if ('saps' in service && service.saps) {
                            service.saps.forEach(sap => {
                                searchFields.push(sap.sapId, sap.description, sap.portId, sap.portDescription || '');
                            });
                        }
                        if ('spokeSdps' in service && service.spokeSdps) {
                            service.spokeSdps.forEach(sdp => {
                                searchFields.push(sdp.sdpId.toString(), sdp.vcId.toString(), sdp.description);
                            });
                        }
                        if ('meshSdps' in service && service.meshSdps) {
                            service.meshSdps.forEach(sdp => {
                                searchFields.push(sdp.sdpId.toString(), sdp.vcId.toString(), sdp.description);
                            });
                        }
                    } else if (service.serviceType === 'vprn') {
                        if ('interfaces' in service && service.interfaces) {
                            service.interfaces.forEach(iface => {
                                searchFields.push(
                                    iface.interfaceName || '',
                                    iface.description || '',
                                    iface.portId || '',
                                    iface.ipAddress || '',
                                    iface.vplsName || '',
                                    iface.spokeSdpId || ''
                                );
                            });
                        }
                        if ('bgpRouterId' in service && service.bgpRouterId) {
                            searchFields.push(service.bgpRouterId);
                        }
                        if ('bgpNeighbors' in service && service.bgpNeighbors) {
                            service.bgpNeighbors.forEach(nbr => {
                                searchFields.push(nbr.neighborIp, nbr.autonomousSystem?.toString() || '');
                            });
                        }
                        if ('ospf' in service && service.ospf && service.ospf.areas) {
                            service.ospf.areas.forEach(area => {
                                searchFields.push(area.areaId);
                                if (area.interfaces) {
                                    area.interfaces.forEach(intf => searchFields.push(intf.interfaceName));
                                }
                            });
                        }
                        if ('autonomousSystem' in service && service.autonomousSystem) {
                            searchFields.push(service.autonomousSystem.toString());
                        }
                        if ('routeDistinguisher' in service && service.routeDistinguisher) {
                            searchFields.push(service.routeDistinguisher);
                        }
                    } else if (service.serviceType === 'ies') {
                        // IES는 인터페이스 레벨 필터링으로 처리되므로 여기서는 통과
                        return true;
                    }

                    // Catch-all: 서비스 객체 전체를 JSON으로 변환하여 추가 (v4.5.0 복원)
                    // 명시적으로 수집하지 못한 필드나 필드명 자체를 검색할 수 있도록 함
                    try {
                        const serviceJson = JSON.stringify(service);
                        searchFields.push(serviceJson);
                    } catch (e) {
                        console.warn('[ServiceListV3] JSON.stringify failed for service:', service.serviceId, e);
                    }

                    // 모든 필드를 소문자로 변환
                    const lowerSearchFields = searchFields.map(f => f.toLowerCase());

                    // AND/OR 검색 로직 (v1.3.0)
                    if (isAndSearch) {
                        // AND: 모든 검색어가 각각 적어도 하나의 필드에 매칭되어야 함
                        return searchTerms.every(term =>
                            lowerSearchFields.some(field => field.includes(term))
                        );
                    } else {
                        // OR: 적어도 하나의 검색어가 적어도 하나의 필드에 매칭되면 됨
                        return searchTerms.some(term =>
                            lowerSearchFields.some(field => field.includes(term))
                        );
                    }
                }
        }

        return true;
    }).map(service => {
        // ⭐ IES 인터페이스 레벨 필터링 적용 (v4.5.0)
        if (service.serviceType === 'ies' && searchQuery) {
            return filterIESInterfaces(
                service as IESService & { _hostname: string },
                searchQuery.toLowerCase()
            );
        }
            return service;
        }).filter((service): service is NokiaServiceV3 => service !== null) // null 제거 + 타입 가드
          .sort((a, b) => a.serviceId - b.serviceId);
    }

    // 서비스를 serviceId와 serviceType별로 그룹화
    const groupedServices = filteredServices.reduce((acc, service) => {
        let key = `${service.serviceType}-${service.serviceId}`;

        // IES (Base Router) special grouping by Hostname
        if (service.serviceType === 'ies') {
            const hostname = (service as any)._hostname || 'Unknown';
            key = `ies-${hostname}`;
        }

        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(service);
        return acc;
    }, {} as Record<string, NokiaServiceV3[]>);

    // 타입별 그룹화 (그룹화된 서비스 기준)
    const epipeServices = Object.values(groupedServices).filter(group => group[0].serviceType === 'epipe');
    const vplsServices = Object.values(groupedServices).filter(group => group[0].serviceType === 'vpls');
    const vprnServices = Object.values(groupedServices).filter(group => group[0].serviceType === 'vprn');
    const iesServices = Object.values(groupedServices).filter(group => group[0].serviceType === 'ies');

    // IES 전체 인터페이스 개수 (호스트별 그룹이므로 interface 개수를 따로 계산)
    const iesInterfaceCount = iesServices.reduce((acc, group) => {
        return acc + group.reduce((sum, service) => {
            return sum + ((service as IESService).interfaces?.length || 0);
        }, 0);
    }, 0);

    // 선택된 서비스의 Type별 갯수 계산 (v4.5.0)
    const selectedEpipeCount = epipeServices.filter(group =>
        selectedServiceIds.includes(`${group[0].serviceType}-${group[0].serviceId}`)
    ).length;
    const selectedVplsCount = vplsServices.filter(group =>
        selectedServiceIds.includes(`${group[0].serviceType}-${group[0].serviceId}`)
    ).length;
    const selectedVprnCount = vprnServices.filter(group =>
        selectedServiceIds.includes(`${group[0].serviceType}-${group[0].serviceId}`)
    ).length;

    // 선택된 IES 인터페이스 개수 계산
    const selectedIesInterfaceCount = iesServices.reduce((acc, group) => {
        const hostname = (group[0] as any)._hostname || 'Unknown';
        const fullHostKey = `ies-${hostname}`;

        if (selectedServiceIds.includes(fullHostKey)) {
            // 전체 호스트가 선택된 경우, 모든 인터페이스 카운트
            return acc + group.reduce((sum, service) => {
                return sum + ((service as IESService).interfaces?.length || 0);
            }, 0);
        } else {
            // 개별 인터페이스만 선택된 경우
            const prefix = `ies___${hostname}___`;
            const selectedInterfaceKeys = selectedServiceIds.filter(id => id.startsWith(prefix));
            return acc + selectedInterfaceKeys.length;
        }
    }, 0);

    const handleSelectAll = () => {
        const allKeys: string[] = [];

        filteredServices.forEach(s => {
            if (s.serviceType === 'ies') {
                const hostname = (s as any)._hostname || 'Unknown';
                const iesService = s as IESService;
                // ⭐ v4.5.0: filteredServices의 IES는 이미 필터링된 인터페이스만 포함
                // 개별 인터페이스 키를 생성하여 검색 결과만 선택
                iesService.interfaces.forEach(intf => {
                    allKeys.push(`ies___${hostname}___${intf.interfaceName}`);
                });
            } else {
                allKeys.push(`${s.serviceType}-${s.serviceId}`);
            }
        });

        onSetSelected(allKeys);
    };

    const handleSelectNone = () => {
        onSetSelected([]);
    };

    const handleHAFilter = () => {
        const haServiceIds: string[] = [];

        console.log(`🔍 [HA Filter v4.5] Starting HA detection on filteredServices: ${filteredServices.length}`);

        // ==================================================
        // Step 0: Create set of filtered service IDs (v4.5.0)
        // ==================================================
        const filteredServiceKeys = new Set<string>();
        filteredServices.forEach(service => {
            if (service.serviceType === 'ies') {
                const hostname = (service as any)._hostname || 'Unknown';
                filteredServiceKeys.add(`ies-${hostname}`);
            } else {
                filteredServiceKeys.add(`${service.serviceType}-${service.serviceId}`);
            }
        });
        console.log(`🔍 [HA Filter v4.5] Filtered service keys: ${filteredServiceKeys.size}`);

        // ==================================================
        // Step 1: Collect static routes from filteredServices only (v4.5.0)
        // ==================================================
        interface RouteInfo {
            prefix: string;
            nextHop: string;
            hostname: string;
            serviceType: 'ies' | 'vprn';
            serviceId?: number;
        }

        const allRoutes: RouteInfo[] = [];

        configs.forEach(config => {
            config.services.forEach(service => {
                // ⭐ v4.5.0: filteredServices에 포함된 서비스만 처리
                if (service.serviceType === 'ies') {
                    const hostname = config.hostname;
                    const serviceKey = `ies-${hostname}`;
                    if (!filteredServiceKeys.has(serviceKey)) {
                        return; // Skip this service
                    }

                    const iesService = service as IESService;
                    iesService.staticRoutes?.forEach(route => {
                        allRoutes.push({
                            prefix: route.prefix,
                            nextHop: route.nextHop,
                            hostname: config.hostname,
                            serviceType: 'ies'
                        });
                    });
                } else if (service.serviceType === 'vprn') {
                    const serviceKey = `${service.serviceType}-${service.serviceId}`;
                    if (!filteredServiceKeys.has(serviceKey)) {
                        return; // Skip this service
                    }

                    const vprnService = service as VPRNService;
                    vprnService.staticRoutes?.forEach(route => {
                        allRoutes.push({
                            prefix: route.prefix,
                            nextHop: route.nextHop,
                            hostname: config.hostname,
                            serviceType: 'vprn',
                            serviceId: vprnService.serviceId
                        });
                    });
                }
            });
        });

        console.log(`📊 [HA Filter] Total static routes collected: ${allRoutes.length}`);

        // ==================================================
        // Step 2: Group routes by prefix and find HA pairs
        // (같은 prefix에 2개의 서로 다른 next-hop)
        // ==================================================
        const nextHopGroups: Record<string, Set<string>> = {};

        allRoutes.forEach(route => {
            if (!nextHopGroups[route.prefix]) {
                nextHopGroups[route.prefix] = new Set();
            }
            nextHopGroups[route.prefix].add(route.nextHop);
        });

        console.log(`📊 [HA Filter] Total unique prefixes: ${Object.keys(nextHopGroups).length}`);

        // Detect HA pairs: prefix with exactly 2 different next-hops
        interface HAPairCandidate {
            prefix: string;
            nextHop1: string;
            nextHop2: string;
        }

        const haPairs: HAPairCandidate[] = [];

        for (const [prefix, hops] of Object.entries(nextHopGroups)) {
            if (hops.size === 2) {
                const [hop1, hop2] = Array.from(hops).sort();
                haPairs.push({ prefix, nextHop1: hop1, nextHop2: hop2 });
                console.log(`✅ [HA Filter] HA Pair candidate: ${prefix} → ${hop1} & ${hop2}`);
            }
        }

        console.log(`🎯 [HA Filter] Total HA pair candidates: ${haPairs.length}`);

        // ==================================================
        // Step 3: Collect HA next-hop IPs (v1 style)
        // ==================================================
        const haIps = new Set<string>();
        haPairs.forEach(pair => {
            haIps.add(pair.nextHop1);
            haIps.add(pair.nextHop2);
        });

        console.log('🔍 [HA Filter] HA IPs from pairs:', Array.from(haIps).slice(0, 10), '...');

        // ==================================================
        // Step 4: Find interfaces whose peerIp matches HA next-hops (v4.5.0 - filteredServices only)
        // ==================================================
        let totalInterfaces = 0;
        configs.forEach(config => {
            config.services.forEach(service => {
                if (service.serviceType === 'ies') {
                    // ⭐ v4.5.0: filteredServices에 포함된 서비스만 처리
                    const hostname = config.hostname;
                    const serviceKey = `ies-${hostname}`;
                    if (!filteredServiceKeys.has(serviceKey)) {
                        return; // Skip this service
                    }

                    const iesService = service as IESService;

                    // 동일 config 내 모든 IES 서비스의 Static Routes 수집
                    const aggregatedStaticRoutes: Array<{ prefix: string; nextHop: string }> = [];
                    config.services.forEach(svc => {
                        if (svc.serviceType === 'ies') {
                            const ies = svc as IESService;
                            ies.staticRoutes?.forEach(route => {
                                aggregatedStaticRoutes.push({ prefix: route.prefix, nextHop: route.nextHop });
                            });
                        }
                    });

                    const v1Device = convertIESToV1Format(iesService, config.hostname, aggregatedStaticRoutes);

                    console.log(`🔍 [HA Filter] Processing IES: ${config.hostname}, Interfaces: ${v1Device.interfaces.length}, Static Routes: ${v1Device.staticRoutes.length}`);

                    v1Device.interfaces.forEach((intf, idx) => {
                        totalInterfaces++;
                        const { peerIp, relatedRoutes } = findPeerAndRoutes(v1Device, intf);
                        const intfIp = intf.ipAddress?.split('/')[0] || '';

                        if (idx < 3) { // Log first 3 interfaces for debugging
                            console.log(`  🔍 Interface ${intf.name}: IP=${intfIp}, Peer=${peerIp}, Routes=${relatedRoutes.length}`);
                        }

                        // Check if either the peer IP or the interface's own IP is in HA pairs
                        if (haIps.has(peerIp) || haIps.has(intfIp)) {
                            const serviceId = `ies___${config.hostname}___${intf.name}`;
                            if (!haServiceIds.includes(serviceId)) {
                                haServiceIds.push(serviceId);
                                console.log(`✅ [HA Filter] IES Selected: ${config.hostname}:${intf.name} (IP: ${intfIp}, Peer: ${peerIp})`);
                            }
                        }
                    });
                } else if (service.serviceType === 'vprn') {
                    // ⭐ v4.5.0: filteredServices에 포함된 서비스만 처리
                    const serviceKey = `${service.serviceType}-${service.serviceId}`;
                    if (!filteredServiceKeys.has(serviceKey)) {
                        return; // Skip this service
                    }

                    const vprnService = service as VPRNService;
                    const v1Device = convertVPRNToV1Format(vprnService, config.hostname);

                    console.log(`🔍 [HA Filter] Processing VPRN ${vprnService.serviceId}: ${config.hostname}, Interfaces: ${v1Device.interfaces.length}, Static Routes: ${v1Device.staticRoutes.length}`);

                    v1Device.interfaces.forEach((intf, idx) => {
                        totalInterfaces++;
                        const { peerIp, relatedRoutes } = findPeerAndRoutes(v1Device, intf);
                        const intfIp = intf.ipAddress?.split('/')[0] || '';

                        if (idx < 3) {
                            console.log(`  🔍 Interface ${intf.name}: IP=${intfIp}, Peer=${peerIp}, Routes=${relatedRoutes.length}`);
                        }

                        if (haIps.has(peerIp) || haIps.has(intfIp)) {
                            const serviceId = `vprn___${vprnService.serviceId}___${config.hostname}___${intf.name}`;
                            if (!haServiceIds.includes(serviceId)) {
                                haServiceIds.push(serviceId);
                                console.log(`✅ [HA Filter] VPRN Selected: ${config.hostname}:${intf.name} (service ${vprnService.serviceId}, IP: ${intfIp}, Peer: ${peerIp})`);
                            }
                        }
                    });
                }
            });
        });

        console.log(`📊 [HA Filter] Total interfaces processed: ${totalInterfaces}`);

        // 중복 제거 및 선택
        const uniqueIds = Array.from(new Set(haServiceIds));
        console.log(`🎯 [HA Filter v3] Total HA interfaces selected: ${uniqueIds.length}`);
        onSetSelected(uniqueIds);
    };

    // 그룹 접기/펼침 상태 (기본값: 모두 펼침)
    const [expandedGroups, setExpandedGroups] = useState<{ [key: string]: boolean }>({
        epipe: true,
        vpls: true,
        vprn: true,
        ies: true,
    });

    const [expandedIESHosts, setExpandedIESHosts] = useState<{ [key: string]: boolean }>({});
    const [expandedVPRNServices, setExpandedVPRNServices] = useState<{ [key: string]: boolean }>({});

    const toggleGroup = (group: string) => {
        setExpandedGroups(prev => ({
            ...prev,
            [group]: !prev[group]
        }));
    };

    return (
        <div className="service-list">
            <div className="service-list-header">
                <h2>Network Services</h2>
                <div className="service-count">
                    {filteredServices.length} service{filteredServices.length !== 1 ? 's' : ''}
                </div>
            </div>

            {/* AI 채팅 / 검색 */}
            <AIChatPanel
                configSummary={configSummary}
                onAIResponse={handleAIResponse}
                aiEnabled={aiEnabled}
                onToggleAI={() => setAiEnabled(prev => !prev)}
                dictionary={dictionaryCompact}
                filterType={filterType}
            />
            {aiEnabled && configs.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 8px 4px' }}>
                    <button
                        onClick={() => setShowDictionaryEditor(true)}
                        title="이름 사전 편집"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 10px',
                            background: dictionary && dictionary.entries.length > 0 ? '#eff6ff' : 'white',
                            border: `1px solid ${dictionary && dictionary.entries.length > 0 ? '#93c5fd' : '#d1d5db'}`,
                            borderRadius: '6px',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            color: dictionary && dictionary.entries.length > 0 ? '#1d4ed8' : '#6b7280',
                        }}
                    >
                        <BookOpen size={14} />
                        이름 사전{dictionary && dictionary.entries.length > 0 ? ` (${dictionary.entries.length})` : ''}
                    </button>
                </div>
            )}
            {!aiEnabled && (
                <div className="service-search">
                    <input
                        type="text"
                        placeholder="Search (OR: space, AND: ' + ')..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="search-input"
                    />
                </div>
            )}

            {/* 검색 예시 Pills (search-examples-ui) */}
            {!aiEnabled && (
                <div className="search-examples-container">
                    <span className="examples-label">💡 Examples:</span>
                    <div className="examples-pills">
                        {DYNAMIC_EXAMPLES.map((example, idx) => (
                            <button
                                key={idx}
                                className="example-pill"
                                title={example.description}
                                onClick={() => handleExampleClick(example.query)}
                                aria-label={`Search example: ${example.label}`}
                            >
                                {example.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* 필터 */}
            <div className="service-filters">
                <div className="filter-group">
                    <label>Type:</label>
                    <div className="filter-buttons">
                        <button
                            className={filterType === 'all' ? 'active' : ''}
                            onClick={() => setFilterType('all')}
                        >
                            All
                        </button>
                        <button
                            className={filterType === 'epipe' ? 'active' : ''}
                            onClick={() => setFilterType('epipe')}
                        >
                            Epipe
                        </button>
                        <button
                            className={filterType === 'vpls' ? 'active' : ''}
                            onClick={() => setFilterType('vpls')}
                        >
                            VPLS
                        </button>
                        <button
                            className={filterType === 'vprn' ? 'active' : ''}
                            onClick={() => setFilterType('vprn')}
                        >
                            VPRN
                        </button>
                        <button
                            className={filterType === 'ies' ? 'active' : ''}
                            onClick={() => setFilterType('ies')}
                        >
                            IES
                        </button>
                    </div>
                </div>
            </div>

            {/* 선택 버튼 */}
            <div className="service-actions">
                <button onClick={handleSelectAll} className="action-btn">
                    All
                </button>
                <span style={{ margin: '0 4px', color: '#ccc' }}>|</span>
                <button onClick={handleHAFilter} className="action-btn" style={{ fontWeight: 'bold', color: '#0066cc' }}>
                    이중화
                </button>
                <span style={{ margin: '0 4px', color: '#ccc' }}>|</span>
                <button onClick={handleSelectNone} className="action-btn" style={{ color: '#666' }}>
                    None
                </button>
            </div>


            {/* Services Content (Scrollable) - Force Remount on Search Change */}
            <div className="service-list-content" key={searchQuery}>
                {/* Epipe 서비스 */}
                {epipeServices.length > 0 && (
                    <div className="service-group">
                        <div
                            className="service-group-header clickable"
                            onClick={() => toggleGroup('epipe')}
                        >
                            <span className="group-toggle-icon">
                                {expandedGroups['epipe'] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </span>
                            <span className="service-icon">🔗</span>
                            <h3>Epipe Services ({selectedServiceIds.length > 0 ? `${selectedEpipeCount} / ` : ''}{epipeServices.length})</h3>
                        </div>
                        {expandedGroups['epipe'] && (
                            <div className="service-items" style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
                                {epipeServices.map(serviceGroup => {
                                    // 대표 서비스 (첫 번째)
                                    const representative = serviceGroup[0];

                                    return (
                                        <div
                                            key={representative.serviceId}
                                            className={`service-item ${selectedServiceIds.includes(`${representative.serviceType}-${representative.serviceId}`) ? 'selected' : ''}`}
                                            onClick={() => onToggleService(`${representative.serviceType}-${representative.serviceId}`)}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedServiceIds.includes(`${representative.serviceType}-${representative.serviceId}`)}
                                                onChange={() => { }}
                                                className="service-checkbox"
                                            />
                                            <div className="service-info">
                                                <div className="service-title">
                                                    Epipe {representative.serviceId}
                                                </div>
                                                <div className="service-description">
                                                    {representative.description}
                                                </div>
                                                {serviceGroup.map((service, idx) => {
                                                    // Use _hostname property that was injected in V3Page
                                                    const hostname = (service as any)._hostname || 'Unknown';

                                                    // SAP IDs 추출
                                                    const sapIds = 'saps' in service
                                                        ? service.saps.map(sap => sap.sapId).join(', ')
                                                        : '';

                                                    // SDP IDs 추출
                                                    const sdpIds = 'spokeSdps' in service && service.spokeSdps
                                                        ? service.spokeSdps.map(sdp => `${sdp.sdpId}:${sdp.vcId}`).join(', ')
                                                        : '';

                                                    return (
                                                        <div key={idx}>
                                                            <div className="service-meta">
                                                                <span className="meta-item" style={{ fontWeight: 'bold', color: '#0066cc' }}>{hostname}</span>
                                                            </div>
                                                            <div className="service-meta">
                                                                {sapIds && (
                                                                    <span className="meta-item">SAP: {sapIds}</span>
                                                                )}
                                                                {sdpIds && (
                                                                    <span className="meta-item">SDP: {sdpIds}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* VPLS 서비스 */}
                {vplsServices.length > 0 && (
                    <div className="service-group">
                        <div
                            className="service-group-header clickable"
                            onClick={() => toggleGroup('vpls')}
                        >
                            <span className="group-toggle-icon">
                                {expandedGroups['vpls'] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </span>
                            <span className="service-icon">🌐</span>
                            <h3>VPLS Services ({selectedServiceIds.length > 0 ? `${selectedVplsCount} / ` : ''}{vplsServices.length})</h3>
                        </div>
                        {expandedGroups['vpls'] && (
                            <div className="service-items" style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
                                {vplsServices.map(serviceGroup => {
                                    const representative = serviceGroup[0];

                                    return (
                                        <div
                                            key={representative.serviceId}
                                            className={`service-item ${selectedServiceIds.includes(`${representative.serviceType}-${representative.serviceId}`) ? 'selected' : ''}`}
                                            onClick={() => onToggleService(`${representative.serviceType}-${representative.serviceId}`)}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedServiceIds.includes(`${representative.serviceType}-${representative.serviceId}`)}
                                                onChange={() => { }}
                                                className="service-checkbox"
                                            />
                                            <div className="service-info">
                                                <div className="service-title">
                                                    VPLS {representative.serviceId}
                                                </div>
                                                <div className="service-description">
                                                    {representative.description}
                                                </div>
                                                {serviceGroup.map((service, idx) => {
                                                    const hostname = (service as any)._hostname || 'Unknown';

                                                    const sapIds = 'saps' in service ? service.saps.map(sap => sap.sapId).join(', ') : '';
                                                    const spokeSdpIds = 'spokeSdps' in service && service.spokeSdps ? service.spokeSdps.map(sdp => `${sdp.sdpId}:${sdp.vcId}`).join(', ') : '';
                                                    const meshSdpIds = 'meshSdps' in service && service.meshSdps ? service.meshSdps.map(sdp => `${sdp.sdpId}`).join(', ') : '';

                                                    return (
                                                        <div key={idx}>
                                                            <div className="service-meta">
                                                                <span className="meta-item" style={{ fontWeight: 'bold', color: '#0066cc' }}>{hostname}</span>
                                                            </div>
                                                            <div className="service-meta">
                                                                {sapIds && <span className="meta-item">SAP: {sapIds}</span>}
                                                                {spokeSdpIds && <span className="meta-item">Spoke SDP: {spokeSdpIds}</span>}
                                                                {meshSdpIds && <span className="meta-item">Mesh SDP: {meshSdpIds}</span>}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* VPRN 서비스 */}
                {vprnServices.length > 0 && (
                    <div className="service-group">
                        <div
                            className="service-group-header clickable"
                            onClick={() => toggleGroup('vprn')}
                        >
                            <span className="group-toggle-icon">
                                {expandedGroups['vprn'] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </span>
                            <span className="service-icon">📡</span>
                            <h3>VPRN Services ({selectedServiceIds.length > 0 ? `${selectedVprnCount} / ` : ''}{vprnServices.length})</h3>
                        </div>
                        {expandedGroups['vprn'] && (
                            <div className="service-items" style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
                                {vprnServices.map(serviceGroup => {
                                    const representative = serviceGroup[0] as VPRNService;
                                    const hostname = (representative as any)._hostname || 'Unknown';
                                    const serviceId = representative.serviceId;
                                    const serviceKey = `vprn-${serviceId}-${hostname}`;

                                    // Collect all interfaces from this service group
                                    const allInterfaces: (L3Interface & { _parentService: VPRNService })[] = [];
                                    serviceGroup.forEach(s => {
                                        if ((s as VPRNService).interfaces) {
                                            (s as VPRNService).interfaces.forEach(i => allInterfaces.push({ ...i, _parentService: s as VPRNService }));
                                        }
                                    });

                                    const isServiceExpanded = expandedVPRNServices[serviceKey];

                                    // Calculate Selection State
                                    const fullServiceKey = `vprn-${serviceId}`;
                                    const isFullServiceSelected = selectedServiceIds.includes(fullServiceKey);
                                    const selectedCount = allInterfaces.filter(intf =>
                                        isFullServiceSelected || selectedServiceIds.includes(`vprn___${serviceId}___${hostname}___${intf.interfaceName}`)
                                    ).length;
                                    const isAllSelected = allInterfaces.length > 0 && selectedCount === allInterfaces.length;
                                    const isPartialSelected = selectedCount > 0 && selectedCount < allInterfaces.length;

                                    // Handlers
                                    const toggleServiceAccordion = (e: React.MouseEvent) => {
                                        e.stopPropagation();
                                        setExpandedVPRNServices(prev => ({ ...prev, [serviceKey]: !prev[serviceKey] }));
                                    };

                                    const handleServiceSelect = (e: React.MouseEvent) => {
                                        e.stopPropagation();
                                        let newSelected = [...selectedServiceIds];

                                        // Remove full service key and all specific keys for this service
                                        newSelected = newSelected.filter(id =>
                                            id !== fullServiceKey && !id.startsWith(`vprn___${serviceId}___${hostname}___`)
                                        );

                                        if (!isAllSelected) {
                                            // Select All: Add individual keys for granular control
                                            allInterfaces.forEach(intf => {
                                                newSelected.push(`vprn___${serviceId}___${hostname}___${intf.interfaceName}`);
                                            });
                                        }
                                        onSetSelected(newSelected);
                                    };

                                    const handleInterfaceToggle = (interfaceName: string) => {
                                        const specificKey = `vprn___${serviceId}___${hostname}___${interfaceName}`;
                                        let newSelected = [...selectedServiceIds];

                                        // If full service currently selected, explode it
                                        if (newSelected.includes(fullServiceKey)) {
                                            newSelected = newSelected.filter(id => id !== fullServiceKey);
                                            // Add all other interfaces
                                            allInterfaces.forEach(intf => {
                                                if (intf.interfaceName !== interfaceName) {
                                                    newSelected.push(`vprn___${serviceId}___${hostname}___${intf.interfaceName}`);
                                                }
                                            });
                                            // Don't add specificKey (we are toggling it OFF)
                                        } else {
                                            if (newSelected.includes(specificKey)) {
                                                newSelected = newSelected.filter(id => id !== specificKey);
                                            } else {
                                                newSelected.push(specificKey);
                                            }
                                        }
                                        onSetSelected(newSelected);
                                    };

                                    return (
                                        <div key={`vprn-group-${serviceKey}`} className="service-subgroup" style={{ marginBottom: '8px', border: '1px solid #eee', borderRadius: '4px', overflow: 'hidden' }}>
                                            {/* Service Header (Accordion) */}
                                            <div
                                                className="subgroup-header clickable"
                                                onClick={toggleServiceAccordion}
                                                style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', background: '#f9fafb', cursor: 'pointer' }}
                                            >
                                                <span style={{ marginRight: '8px', display: 'flex' }}>
                                                    {isServiceExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                </span>
                                                <input
                                                    type="checkbox"
                                                    checked={isAllSelected}
                                                    ref={el => { if (el) el.indeterminate = isPartialSelected; }}
                                                    onChange={() => { }} // Handled by div click or separate click handler
                                                    onClick={handleServiceSelect}
                                                    style={{ marginRight: '8px' }}
                                                />
                                                <span className="service-title" style={{ flex: 1, margin: 0 }}>
                                                    VPRN {serviceId} - {hostname} ({allInterfaces.length})
                                                </span>
                                            </div>

                                            {/* Service Description */}
                                            {isServiceExpanded && representative.description && (
                                                <div style={{ padding: '4px 12px 8px 44px', fontSize: '0.85em', color: '#666' }}>
                                                    {representative.description}
                                                </div>
                                            )}

                                            {/* Interfaces List */}
                                            {isServiceExpanded && (
                                                <div className="subgroup-items" style={{ padding: '8px' }}>
                                                    {allInterfaces.map((intf) => {
                                                        const isSelected = isFullServiceSelected || selectedServiceIds.includes(`vprn___${serviceId}___${hostname}___${intf.interfaceName}`);
                                                        return (
                                                            <div
                                                                key={`${hostname}-vprn-${serviceId}-${intf.interfaceName}`}
                                                                className={`interface-card ${isSelected ? 'selected' : ''}`}
                                                                onClick={() => handleInterfaceToggle(intf.interfaceName)}
                                                                style={{
                                                                    display: 'flex', alignItems: 'center',
                                                                    padding: '6px 10px', marginBottom: '4px',
                                                                    background: isSelected ? '#e3f2fd' : 'white',
                                                                    border: '1px solid #eee', borderRadius: '4px',
                                                                    cursor: 'pointer'
                                                                }}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isSelected}
                                                                    onChange={() => { }}
                                                                    style={{ marginRight: '10px' }}
                                                                />
                                                                <div style={{ display: 'flex', flexDirection: 'column', fontSize: '0.9em' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                                                        <span style={{ fontWeight: 'bold', color: '#0066cc', fontSize: '12px', marginRight: '8px' }}>{intf.interfaceName}</span>
                                                                        {intf.ipAddress && (
                                                                            <span style={{
                                                                                background: '#e8f5e9', color: '#2e7d32',
                                                                                padding: '1px 6px', borderRadius: '4px', fontSize: '0.85em'
                                                                            }}>
                                                                                {intf.ipAddress}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div style={{ color: '#666', fontSize: '0.85em', marginTop: '2px' }}>
                                                                        {intf.description || ''}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* IES 서비스 (Base Router) */}
                {iesServices.length > 0 && (
                    <div className="service-group">
                        <div
                            className="service-group-header clickable"
                            onClick={() => toggleGroup('ies')}
                        >
                            <span className="group-toggle-icon">
                                {expandedGroups['ies'] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </span>
                            <span className="service-icon">🌐</span>
                            <h3>IES Services ({selectedServiceIds.length > 0 ? `${selectedIesInterfaceCount} / ` : ''}{iesInterfaceCount})</h3>
                        </div>
                        {expandedGroups['ies'] && (
                            <div className="service-items" style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
                                {iesServices.map(serviceGroup => {
                                    const representative = serviceGroup[0] as IESService;
                                    const hostname = (representative as any)._hostname || 'Unknown';
                                    const fullHostKey = `ies-${hostname}`;

                                    // Collect all interfaces from this group (usually one service object but handled loosely)
                                    const allInterfaces: (L3Interface & { _parentService: IESService })[] = [];
                                    serviceGroup.forEach(s => {
                                        if ((s as IESService).interfaces) {
                                            (s as IESService).interfaces.forEach(i => allInterfaces.push({ ...i, _parentService: s as IESService }));
                                        }
                                    });

                                    const isHostExpanded = expandedIESHosts[hostname];

                                    // Calculate Selection State
                                    const isFullHostSelected = selectedServiceIds.includes(fullHostKey);
                                    const selectedCount = allInterfaces.filter(intf =>
                                        isFullHostSelected || selectedServiceIds.includes(`ies___${hostname}___${intf.interfaceName}`)
                                    ).length;
                                    const isAllSelected = allInterfaces.length > 0 && selectedCount === allInterfaces.length;
                                    const isPartialSelected = selectedCount > 0 && selectedCount < allInterfaces.length;

                                    // Handlers
                                    const toggleHostAccordion = (e: React.MouseEvent) => {
                                        e.stopPropagation();
                                        setExpandedIESHosts(prev => ({ ...prev, [hostname]: !prev[hostname] }));
                                    };

                                    const handleHostSelect = (e: React.MouseEvent) => {
                                        e.stopPropagation();
                                        let newSelected = [...selectedServiceIds];

                                        // Remove full host key and all specific keys for this host
                                        newSelected = newSelected.filter(id =>
                                            id !== fullHostKey && !id.startsWith(`ies___${hostname}___`)
                                        );

                                        if (!isAllSelected) {
                                            // Select All: Add individual keys for granular control
                                            allInterfaces.forEach(intf => {
                                                newSelected.push(`ies___${hostname}___${intf.interfaceName}`);
                                            });
                                        }
                                        onSetSelected(newSelected);
                                    };

                                    const handleInterfaceToggle = (interfaceName: string) => {
                                        const specificKey = `ies___${hostname}___${interfaceName}`;
                                        let newSelected = [...selectedServiceIds];

                                        // If full host currently selected, explode it
                                        if (newSelected.includes(fullHostKey)) {
                                            newSelected = newSelected.filter(id => id !== fullHostKey);
                                            // Add all other interfaces
                                            allInterfaces.forEach(intf => {
                                                if (intf.interfaceName !== interfaceName) {
                                                    newSelected.push(`ies___${hostname}___${intf.interfaceName}`);
                                                }
                                            });
                                            // Don't add specificKey (we are toggling it OFF)
                                        } else {
                                            if (newSelected.includes(specificKey)) {
                                                newSelected = newSelected.filter(id => id !== specificKey);
                                            } else {
                                                newSelected.push(specificKey);
                                            }
                                        }
                                        onSetSelected(newSelected);
                                    };

                                    return (
                                        <div key={`ies-group-${hostname}`} className="service-subgroup" style={{ marginBottom: '8px', border: '1px solid #eee', borderRadius: '4px', overflow: 'hidden' }}>
                                            {/* Hostname Header (Accordion) */}
                                            <div
                                                className="subgroup-header clickable"
                                                onClick={toggleHostAccordion}
                                                style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', background: '#f9fafb', cursor: 'pointer' }}
                                            >
                                                <span style={{ marginRight: '8px', display: 'flex' }}>
                                                    {isHostExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                </span>
                                                <input
                                                    type="checkbox"
                                                    checked={isAllSelected}
                                                    ref={el => { if (el) el.indeterminate = isPartialSelected; }}
                                                    onChange={() => { }} // Handled by div click or separate click handler
                                                    onClick={handleHostSelect}
                                                    style={{ marginRight: '8px' }}
                                                />
                                                <span className="service-title" style={{ flex: 1, margin: 0 }}>{hostname} ({allInterfaces.length})</span>
                                            </div>

                                            {/* Interfaces List */}
                                            {isHostExpanded && (
                                                <div className="subgroup-items" style={{ padding: '8px' }}>
                                                    {/* Quick Filters (Optional, can add later) */}
                                                    {allInterfaces.map((intf) => {
                                                        const isSelected = isFullHostSelected || selectedServiceIds.includes(`ies___${hostname}___${intf.interfaceName}`);
                                                        return (
                                                            <div
                                                                key={`${hostname}-${intf._parentService.serviceId}-${intf.interfaceName}`}
                                                                className={`interface-card ${isSelected ? 'selected' : ''}`}
                                                                onClick={() => handleInterfaceToggle(intf.interfaceName)}
                                                                style={{
                                                                    display: 'flex', alignItems: 'center',
                                                                    padding: '6px 10px', marginBottom: '4px',
                                                                    background: isSelected ? '#e3f2fd' : 'white',
                                                                    border: '1px solid #eee', borderRadius: '4px',
                                                                    cursor: 'pointer'
                                                                }}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isSelected}
                                                                    onChange={() => { }}
                                                                    style={{ marginRight: '10px' }}
                                                                />
                                                                <div style={{ display: 'flex', flexDirection: 'column', fontSize: '0.9em' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                                                        <span style={{ fontWeight: 'bold', color: '#0066cc', fontSize: '12px', marginRight: '8px' }}>{intf.interfaceName}</span>
                                                                        {intf.ipAddress && (
                                                                            <span style={{
                                                                                background: '#e8f5e9', color: '#2e7d32',
                                                                                padding: '1px 6px', borderRadius: '4px', fontSize: '0.85em'
                                                                            }}>
                                                                                {intf.ipAddress}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div style={{ color: '#666', fontSize: '0.85em', marginTop: '2px' }}>
                                                                        {intf.description || ''}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {filteredServices.length === 0 && (
                    <div className="no-results">
                        <p>No services found matching your filters.</p>
                    </div>
                )}
            </div>

            {/* Dictionary Editor 모달 */}
            {showDictionaryEditor && (
                <DictionaryEditor
                    configs={configs}
                    dictionary={dictionary}
                    onSave={(dict) => setDictionary(dict)}
                    onClose={() => setShowDictionaryEditor(false)}
                />
            )}
        </div>
    );
}
