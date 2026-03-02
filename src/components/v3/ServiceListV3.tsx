import { useState, useMemo, useCallback, useEffect, useRef, lazy, Suspense } from 'react';
import type { ParsedConfigV3, NokiaServiceV3 } from '../../utils/v3/parserV3';
import type { IESService, VPRNService, L3Interface } from '../../types/services';
import type { NameDictionary } from '../../types/dictionary';
import Bot from 'lucide-react/dist/esm/icons/bot';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right';
import BookOpen from 'lucide-react/dist/esm/icons/book-open';
import X from 'lucide-react/dist/esm/icons/x';
import { findPeerAndRoutes } from '../../utils/mermaidGenerator';
import { convertIESToV1Format } from '../../utils/v1IESAdapter';
import { convertVPRNToV1Format } from '../../utils/v1VPRNAdapter';
import { isValidIPv4, parseNetwork, isIpInSubnet, type SubnetMatch } from '../../utils/ipUtils';
import { AIChatPanel } from './AIChatPanel';
const DictionaryEditor = lazy(() =>
  import('./DictionaryEditor').then(m => ({ default: m.DictionaryEditor }))
);
import { buildConfigSummary, type ConfigSummary } from '../../utils/configSummaryBuilder';
import { toDictionaryCompact } from '../../utils/dictionaryStorage';
import { loadDictionaryFromServer } from '../../services/dictionaryApi';
import { sendChatMessage, type ChatResponse } from '../../services/chatApi';

interface ServiceListProps {
  services: NokiaServiceV3[];
  configs: ParsedConfigV3[];
  selectedServiceIds: string[];
  onToggleService: (serviceKey: string) => void;
  onSetSelected: (updater: string[] | ((prev: string[]) => string[])) => void;
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
  const [filterType, setFilterType] = useState<'all' | 'epipe' | 'vpls' | 'vprn' | 'ies' | 'ha'>('all');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<ChatResponse | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const aiAbortRef = useRef<AbortController | null>(null);
  const [showDictionaryEditor, setShowDictionaryEditor] = useState(false);
  const [dictionary, setDictionary] = useState<NameDictionary | null>(null);

  // selectedServiceIds → Set으로 O(1) 조회 (js-set-map-lookups)
  const selectedSet = useMemo(() => new Set(selectedServiceIds), [selectedServiceIds]);

  // ConfigSummary 메모이제이션 (AI 패널용)
  const configSummary = useMemo<ConfigSummary | null>(() => {
    if (configs.length === 0) return null;
    return buildConfigSummary(configs);
  }, [configs]);

  // === Search Examples UI (search-examples-ui) ===
  /**
   * Config 기반 동적 검색 예시 생성 (Phase 2 - v4.8.1 Fixed)
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

  // HA 서비스 키 사전 계산 (configs 전체 기반)
  const { haServiceKeys, haInterfaceKeys } = useMemo(() => {
    const haServiceKeys = new Set<string>();
    const haInterfaceKeys = new Set<string>();

    if (configs.length === 0) return { haServiceKeys, haInterfaceKeys };

    // 1. VPLS: 동일 serviceId가 2개 이상의 config에 존재 → HA (이중화 장비 구성)
    // Epipe는 성격상 2개 장비가 1개 서비스를 구성하는 것이므로 HA 아님
    const serviceHostCounts: Record<string, Set<string>> = {};
    configs.forEach(config => {
      config.services.forEach(service => {
        if (service.serviceType === 'vpls') {
          const key = `${service.serviceType}-${service.serviceId}`;
          if (!serviceHostCounts[key]) serviceHostCounts[key] = new Set();
          serviceHostCounts[key].add(config.hostname);
        }
      });
    });
    for (const [key, hostnames] of Object.entries(serviceHostCounts)) {
      if (hostnames.size >= 2) haServiceKeys.add(key);
    }

    // 2. IES/VPRN: 동일 prefix에 2개의 next-hop → HA (정적 라우트 기반)
    const allRoutes: Array<{ prefix: string; nextHop: string }> = [];
    configs.forEach(config => {
      config.services.forEach(service => {
        if (service.serviceType === 'ies') {
          (service as IESService).staticRoutes?.forEach(r => allRoutes.push(r));
        } else if (service.serviceType === 'vprn') {
          (service as VPRNService).staticRoutes?.forEach(r => allRoutes.push(r));
        }
      });
    });

    const nextHopGroups: Record<string, Set<string>> = {};
    allRoutes.forEach(route => {
      if (!nextHopGroups[route.prefix]) nextHopGroups[route.prefix] = new Set();
      nextHopGroups[route.prefix].add(route.nextHop);
    });

    const haIps = new Set<string>();
    for (const [, hops] of Object.entries(nextHopGroups)) {
      if (hops.size === 2) hops.forEach(ip => haIps.add(ip));
    }

    if (haIps.size > 0) {
      configs.forEach(config => {
        config.services.forEach(service => {
          if (service.serviceType === 'ies') {
            const hostname = config.hostname;
            const iesService = service as IESService;
            const aggregatedRoutes: Array<{ prefix: string; nextHop: string }> = [];
            config.services.forEach(svc => {
              if (svc.serviceType === 'ies') {
                (svc as IESService).staticRoutes?.forEach(r => aggregatedRoutes.push(r));
              }
            });
            const v1Device = convertIESToV1Format(iesService, hostname, aggregatedRoutes);
            v1Device.interfaces.forEach(intf => {
              const { peerIp } = findPeerAndRoutes(v1Device, intf);
              const intfIp = intf.ipAddress?.split('/')[0] || '';
              if (haIps.has(peerIp) || haIps.has(intfIp)) {
                haServiceKeys.add(`ies-${hostname}`);
                haInterfaceKeys.add(`ies___${hostname}___${intf.name}`);
              }
            });
          } else if (service.serviceType === 'vprn') {
            const vprnService = service as VPRNService;
            const v1Device = convertVPRNToV1Format(vprnService, config.hostname);
            v1Device.interfaces.forEach(intf => {
              const { peerIp } = findPeerAndRoutes(v1Device, intf);
              const intfIp = intf.ipAddress?.split('/')[0] || '';
              if (haIps.has(peerIp) || haIps.has(intfIp)) {
                haServiceKeys.add(`vprn-${vprnService.serviceId}`);
              }
            });
          }
        });
      });
    }

    return { haServiceKeys, haInterfaceKeys };
  }, [configs]);

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

  // AI 쿼리 전송
  const handleAISubmit = useCallback(async () => {
    const trimmed = aiQuery.trim();
    if (!trimmed || !configSummary || aiLoading) return;

    aiAbortRef.current?.abort();
    const controller = new AbortController();
    aiAbortRef.current = controller;

    setAiLoading(true);
    setAiError(null);
    setAiResponse(null);

    try {
      const result = await sendChatMessage(trimmed, configSummary, controller.signal, dictionaryCompact, filterType === 'ha' ? 'all' : filterType);
      setAiResponse(result);
      handleAIResponse(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      setAiError(message);
    } finally {
      setAiLoading(false);
    }
  }, [aiQuery, configSummary, aiLoading, handleAIResponse, dictionaryCompact, filterType]);

  const handleAIClear = useCallback(() => {
    setAiResponse(null);
    setAiError(null);
    setAiQuery('');
  }, []);

  // 키보드 단축키: / → 검색창 포커스, Escape → 검색 초기화
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
      if (e.key === '/' && !isInput) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape' && isInput) {
        if (aiEnabled) {
          setAiQuery('');
        } else {
          setSearchQuery('');
        }
        searchInputRef.current?.blur();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [aiEnabled]);

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
    if (filterType === 'ha') {
      targetServices = services.filter(s => {
        if (s.serviceType === 'ies') return haServiceKeys.has(`ies-${(s as any)._hostname || 'Unknown'}`);
        return haServiceKeys.has(`${s.serviceType}-${s.serviceId}`);
      });
    } else if (filterType !== 'all') {
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

    // Longest Prefix Match 정렬 (js-tosorted-immutable: 원본 배열 보존)
    const sortedIpMatches = ipMatches.toSorted((a, b) => {
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
      // 타입 필터 (IES 포함, HA 포함)
      if (filterType === 'ha') {
        if (service.serviceType === 'ies') {
          if (!haServiceKeys.has(`ies-${(service as any)._hostname || 'Unknown'}`)) return false;
        } else if (!haServiceKeys.has(`${service.serviceType}-${service.serviceId}`)) {
          return false;
        }
      } else if (filterType !== 'all' && service.serviceType !== filterType) {
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
      .toSorted((a, b) => a.serviceId - b.serviceId);
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

  // 타입별 그룹화 — 1회 순회로 통합 (js-combine-iterations: 4회 → 1회)
  const { epipeServices, vplsServices, vprnServices, iesServices } = useMemo(() => {
    const result = {
      epipeServices: [] as NokiaServiceV3[][],
      vplsServices: [] as NokiaServiceV3[][],
      vprnServices: [] as NokiaServiceV3[][],
      iesServices: [] as NokiaServiceV3[][],
    };
    for (const group of Object.values(groupedServices)) {
      switch (group[0].serviceType) {
        case 'epipe': result.epipeServices.push(group); break;
        case 'vpls': result.vplsServices.push(group); break;
        case 'vprn': result.vprnServices.push(group); break;
        case 'ies': result.iesServices.push(group); break;
      }
    }
    return result;
  }, [groupedServices]);

  // IES 전체 인터페이스 개수 (호스트별 그룹이므로 interface 개수를 따로 계산)
  const iesInterfaceCount = iesServices.reduce((acc, group) => {
    return acc + group.reduce((sum, service) => {
      return sum + ((service as IESService).interfaces?.length || 0);
    }, 0);
  }, 0);

  // 선택된 서비스의 Type별 갯수 계산 (v4.5.0)
  const selectedEpipeCount = epipeServices.filter(group =>
    selectedSet.has(`${group[0].serviceType}-${group[0].serviceId}`)
  ).length;
  const selectedVplsCount = vplsServices.filter(group =>
    selectedSet.has(`${group[0].serviceType}-${group[0].serviceId}`)
  ).length;
  const selectedVprnCount = vprnServices.filter(group =>
    selectedSet.has(`${group[0].serviceType}-${group[0].serviceId}`)
  ).length;

  // 선택된 IES 인터페이스 개수 계산
  const selectedIesInterfaceCount = iesServices.reduce((acc, group) => {
    const hostname = (group[0] as any)._hostname || 'Unknown';
    const fullHostKey = `ies-${hostname}`;

    if (selectedSet.has(fullHostKey)) {
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

  // Epipe 정상/비정상 카운트 (Epipe는 반드시 2개 장비에 설정되어야 정상)
  const normalEpipeCount = epipeServices.filter(g => g.length === 2).length;
  const abnormalEpipeCount = epipeServices.filter(g => g.length !== 2).length;

  const handleSelectAll = () => {
    const allKeys: string[] = [];

    filteredServices.forEach(s => {
      if (s.serviceType === 'ies') {
        const hostname = (s as any)._hostname || 'Unknown';
        const iesService = s as IESService;
        iesService.interfaces.forEach(intf => {
          allKeys.push(`ies___${hostname}___${intf.interfaceName}`);
        });
      } else {
        allKeys.push(`${s.serviceType}-${s.serviceId}`);
      }
    });

    onSetSelected(Array.from(new Set(allKeys)));
  };

  // 그룹 접기/펼침 상태 (기본값: 모두 펼침)
  const [expandedGroups, setExpandedGroups] = useState<{ [key: string]: boolean }>({
    epipe: true,
    vpls: true,
    vprn: true,
    ies: true,
  });

  // Type 버튼 클릭 후 filteredServices 업데이트 시 자동 전체선택 트리거용 ref
  const pendingSelectAll = useRef(false);

  const [expandedIESHosts, setExpandedIESHosts] = useState<{ [key: string]: boolean }>({});
  const [expandedVPRNServices, setExpandedVPRNServices] = useState<{ [key: string]: boolean }>({});

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [group]: !prev[group]
    }));
  };

  // Type 버튼 토글: 다른 타입 → 필터 전환 + 전체선택, 같은 타입 → 해제/재선택
  const handleTypeButtonClick = (type: 'all' | 'epipe' | 'vpls' | 'vprn' | 'ies' | 'ha') => {
    if (filterType === type) {
      // 같은 버튼 재클릭: 선택된 항목 있으면 해제, 없으면 재선택
      if (selectedServiceIds.length > 0) {
        onSetSelected([]);
      } else {
        if (type === 'ha') {
          const keys = filteredServices.flatMap(s => {
            if (s.serviceType === 'ies') {
              const hostname = (s as any)._hostname || 'Unknown';
              return (s as IESService).interfaces
                .filter(intf => haInterfaceKeys.has(`ies___${hostname}___${intf.interfaceName}`))
                .map(intf => `ies___${hostname}___${intf.interfaceName}`);
            }
            return [`${s.serviceType}-${s.serviceId}`];
          });
          onSetSelected(Array.from(new Set(keys)));
        } else {
          handleSelectAll();
        }
      }
    } else {
      // 다른 타입 클릭: HA는 기존 useEffect가 처리, 나머지는 pendingSelectAll로 처리
      if (type !== 'ha') pendingSelectAll.current = true;
      setFilterType(type);
    }
  };

  // non-HA 타입 버튼 클릭 후 filteredServices 업데이트 시 자동 전체선택
  useEffect(() => {
    if (!pendingSelectAll.current) return;
    pendingSelectAll.current = false;
    handleSelectAll();
    setExpandedGroups({ epipe: false, vpls: false, vprn: false, ies: false });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredServices]);

  // 검색어 입력 시 그룹 자동 접기 (결과 카운트 한눈에 확인)
  useEffect(() => {
    if (searchQuery) {
      setExpandedGroups({ epipe: false, vpls: false, vprn: false, ies: false });
    } else {
      setExpandedGroups({ epipe: true, vpls: true, vprn: true, ies: true });
    }
  }, [searchQuery]);

  // AI 응답 수신 시 그룹 자동 접기
  useEffect(() => {
    if (aiResponse) {
      setExpandedGroups({ epipe: false, vpls: false, vprn: false, ies: false });
    }
  }, [aiResponse]);

  // HA 필터 활성화 시 HA 서비스 자동 선택 (filteredServices 기준 - 검색 필터 존중)
  useEffect(() => {
    if (filterType !== 'ha') return;
    const keys = filteredServices.flatMap(s => {
      if (s.serviceType === 'ies') {
        const hostname = (s as any)._hostname || 'Unknown';
        return (s as IESService).interfaces
          .filter(intf => haInterfaceKeys.has(`ies___${hostname}___${intf.interfaceName}`))
          .map(intf => `ies___${hostname}___${intf.interfaceName}`);
      }
      return [`${s.serviceType}-${s.serviceId}`];
    });
    onSetSelected(Array.from(new Set(keys)));
    setExpandedGroups({ epipe: false, vpls: false, vprn: false, ies: false });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, filteredServices, haInterfaceKeys]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <h2 className="m-0 text-lg font-semibold">Network Services</h2>
        <div className="flex items-center gap-2">
          {selectedServiceIds.length > 0 && (
            <div className="text-sm bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2.5 py-1 rounded-lg font-medium">
              ✓ {selectedServiceIds.length}
            </div>
          )}
          <div className="text-sm text-gray-500 bg-gray-100 dark:bg-gray-700 dark:text-gray-300 px-3 py-1 rounded-xl">
            {filteredServices.length} service{filteredServices.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* 통합 검색/AI 바 */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className={`flex items-center border rounded-lg overflow-hidden transition-all duration-200 ${
          aiEnabled
            ? 'border-blue-500 dark:border-blue-400 ring-2 ring-blue-500/20'
            : 'border-gray-300 dark:border-gray-600'
        }`}>
          {/* AI 토글 버튼 */}
          <button
            className={`flex items-center justify-center w-10 h-9 shrink-0 transition-colors duration-200 ${
              aiEnabled
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            onClick={() => setAiEnabled(prev => !prev)}
            title={aiEnabled ? 'AI 검색 끄기' : 'AI 검색 켜기'}
          >
            <Bot size={18} />
          </button>
          {/* 구분선 */}
          <div className="w-px h-5 bg-gray-200 dark:bg-gray-600 shrink-0" />
          {/* 입력창 */}
          <input
            ref={searchInputRef}
            type="text"
            placeholder={aiEnabled ? 'AI에게 질문하세요...' : 'Search... (OR: space, AND: +)'}
            value={aiEnabled ? aiQuery : searchQuery}
            onChange={(e) => aiEnabled ? setAiQuery(e.target.value) : setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (aiEnabled && e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAISubmit();
              }
            }}
            disabled={aiEnabled && (!configSummary || aiLoading)}
            className="flex-1 px-3 py-2 text-sm outline-none bg-transparent text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 disabled:text-gray-400 dark:disabled:text-gray-500"
          />
          {/* 지우기 버튼 */}
          {(aiEnabled ? aiQuery : searchQuery) && (
            <button
              className="flex items-center justify-center w-8 h-9 shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              onClick={() => aiEnabled ? setAiQuery('') : setSearchQuery('')}
              title="지우기"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* AI 모드: 사전 버튼 */}
        {aiEnabled && configs.length > 0 && (
          <div className="flex justify-end mt-1.5">
            <button
              onClick={() => setShowDictionaryEditor(true)}
              title="이름 사전 편집"
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs cursor-pointer border ${
                dictionary && dictionary.entries.length > 0
                  ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:border-blue-600 dark:text-blue-300'
                  : 'bg-white border-gray-300 text-gray-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400'
              }`}
            >
              <BookOpen size={14} />
              이름 사전{dictionary && dictionary.entries.length > 0 ? ` (${dictionary.entries.length})` : ''}
            </button>
          </div>
        )}

        {/* AI 응답/로딩/에러 표시 */}
        {aiEnabled && (
          <AIChatPanel
            loading={aiLoading}
            response={aiResponse}
            error={aiError}
            onClear={handleAIClear}
          />
        )}
      </div>

      {/* 검색 예시 Pills (search-examples-ui) - 검색어 없을 때만 표시 */}
      {!aiEnabled && !searchQuery && (
        <div className="mt-2 flex items-center gap-2 flex-wrap px-3 md:max-lg:flex-col md:max-lg:items-start max-md:flex-col max-md:items-start">
          <span className="text-[0.85rem] text-slate-500 font-medium whitespace-nowrap max-md:mb-1">💡 Examples:</span>
          <div className="flex flex-wrap gap-1.5 max-md:w-full">
            {DYNAMIC_EXAMPLES.map((example, idx) => (
              <button
                key={idx}
                className="px-3 py-1 text-[0.8rem] font-mono bg-slate-100 border border-slate-300 text-slate-700 rounded-2xl cursor-pointer whitespace-nowrap outline-none transition-all duration-200 hover:bg-sky-100 hover:border-sky-500 hover:text-sky-700 hover:-translate-y-px hover:shadow-sm focus:outline-2 focus:outline-sky-500 focus:outline-offset-2 active:translate-y-0 active:shadow-none disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-sky-900/40 dark:hover:border-sky-500 dark:hover:text-sky-300 max-md:text-[0.75rem] md:max-lg:text-[0.75rem] md:max-lg:px-2.5 md:max-lg:py-0.5"
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

      {/* 타입 필터 버튼 (클릭: 전체선택 + 다이어그램 표시 / 재클릭: 해제) */}
      <div className="px-4 py-2.5 border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-1 flex-nowrap">
          {(['all', 'epipe', 'vpls', 'vprn', 'ies', 'ha'] as const).map(type => (
            <button
              key={type}
              className={`px-2 py-1 border rounded text-xs cursor-pointer whitespace-nowrap transition-all duration-200 ${
                filterType === type
                  ? type === 'ha'
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-blue-600 text-white border-blue-600'
                  : type === 'ha'
                    ? 'border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40'
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              onClick={() => handleTypeButtonClick(type)}
            >
              {type === 'all' ? 'All' : type === 'ha' ? '이중화' : type.toUpperCase()}
            </button>
          ))}
        </div>
      </div>


      {/* Services Content (Scrollable) - Force Remount on Search Change */}
      <div className="flex-1 overflow-y-auto min-h-0" key={searchQuery}>
        {/* Epipe 서비스 */}
        {epipeServices.length > 0 && (
          <div className="mb-4">
            <div
              className="px-4 py-3 bg-gray-50 dark:bg-gray-700 flex items-center gap-2 border-b border-gray-200 dark:border-gray-600 cursor-pointer select-none transition-colors duration-200 hover:bg-gray-100 dark:hover:bg-gray-600"
              onClick={() => toggleGroup('epipe')}
            >
              <span className="inline-flex items-center justify-center w-5 h-5 text-gray-500 dark:text-gray-400 mr-1 text-[10px] transition-transform duration-200">
                {expandedGroups['epipe'] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </span>
              <span className="text-lg">🔗</span>
              <h3 className="m-0 text-[15px] font-semibold dark:text-gray-200">
                Epipe{selectedServiceIds.length > 0 ? ` (${selectedEpipeCount}/${epipeServices.length})` : ''}
              </h3>
              <span className="px-2 py-0.5 text-[11px] font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                ✅ {normalEpipeCount}
              </span>
              {abnormalEpipeCount > 0 && (
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-full">
                  ⚠️ {abnormalEpipeCount}
                </span>
              )}
            </div>
            {expandedGroups['epipe'] && (
              <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
                {epipeServices.map(serviceGroup => {
                  // 대표 서비스 (첫 번째)
                  const representative = serviceGroup[0];
                  // 비정상: Epipe는 반드시 2개 장비에 설정되어야 함
                  const isAbnormal = serviceGroup.length !== 2;

                  return (
                    <div
                      key={representative.serviceId}
                      className={`px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-start gap-3 cursor-pointer transition-colors duration-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                        selectedSet.has(`${representative.serviceType}-${representative.serviceId}`) ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                      } ${isAbnormal ? 'border-l-4 border-l-orange-400 dark:border-l-orange-500' : ''}`}
                      onClick={() => onToggleService(`${representative.serviceType}-${representative.serviceId}`)}
                    >
                      <input
                        type="checkbox"
                        checked={selectedSet.has(`${representative.serviceType}-${representative.serviceId}`)}
                        onChange={() => { }}
                        className="mt-0.5 cursor-pointer"
                      />
                      <div className="flex-1">
                        <div className="font-semibold text-sm mb-1 dark:text-gray-200 flex items-center gap-2">
                          Epipe {representative.serviceId}
                          {isAbnormal && (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded">
                              ⚠️ 현행화 필요 ({serviceGroup.length}개 장비)
                            </span>
                          )}
                        </div>
                        <div className="text-[13px] text-gray-500 dark:text-gray-400 mb-1.5">
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
                              <div className="flex gap-3 flex-wrap">
                                <span className="text-xs text-gray-400 px-2 py-0.5 rounded font-bold text-blue-600 dark:text-blue-400">{hostname}</span>
                              </div>
                              <div className="flex gap-3 flex-wrap">
                                {sapIds && (
                                  <span className="text-xs text-gray-400 dark:text-gray-500 px-2 py-0.5 rounded">SAP: {sapIds}</span>
                                )}
                                {sdpIds && (
                                  <span className="text-xs text-gray-400 dark:text-gray-500 px-2 py-0.5 rounded">SDP: {sdpIds}</span>
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
          <div className="mb-4">
            <div
              className="px-4 py-3 bg-gray-50 dark:bg-gray-700 flex items-center gap-2 border-b border-gray-200 dark:border-gray-600 cursor-pointer select-none transition-colors duration-200 hover:bg-gray-100 dark:hover:bg-gray-600"
              onClick={() => toggleGroup('vpls')}
            >
              <span className="inline-flex items-center justify-center w-5 h-5 text-gray-500 dark:text-gray-400 mr-1 text-[10px] transition-transform duration-200">
                {expandedGroups['vpls'] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </span>
              <span className="text-lg">🌐</span>
              <h3 className="m-0 text-[15px] font-semibold dark:text-gray-200">VPLS Services ({selectedServiceIds.length > 0 ? `${selectedVplsCount} / ` : ''}{vplsServices.length})</h3>
            </div>
            {expandedGroups['vpls'] && (
              <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
                {vplsServices.map(serviceGroup => {
                  const representative = serviceGroup[0];

                  return (
                    <div
                      key={representative.serviceId}
                      className={`px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-start gap-3 cursor-pointer transition-colors duration-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                        selectedSet.has(`${representative.serviceType}-${representative.serviceId}`) ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                      }`}
                      onClick={() => onToggleService(`${representative.serviceType}-${representative.serviceId}`)}
                    >
                      <input
                        type="checkbox"
                        checked={selectedSet.has(`${representative.serviceType}-${representative.serviceId}`)}
                        onChange={() => { }}
                        className="mt-0.5 cursor-pointer"
                      />
                      <div className="flex-1">
                        <div className="font-semibold text-sm mb-1 dark:text-gray-200 flex items-center gap-2">
                          VPLS {representative.serviceId}
                          {haServiceKeys.has(`vpls-${representative.serviceId}`) && (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">HA</span>
                          )}
                        </div>
                        <div className="text-[13px] text-gray-500 dark:text-gray-400 mb-1.5">
                          {representative.description}
                        </div>
                        {serviceGroup.map((service, idx) => {
                          const hostname = (service as any)._hostname || 'Unknown';

                          const sapIds = 'saps' in service ? service.saps.map(sap => sap.sapId).join(', ') : '';
                          const spokeSdpIds = 'spokeSdps' in service && service.spokeSdps ? service.spokeSdps.map(sdp => `${sdp.sdpId}:${sdp.vcId}`).join(', ') : '';
                          const meshSdpIds = 'meshSdps' in service && service.meshSdps ? service.meshSdps.map(sdp => `${sdp.sdpId}`).join(', ') : '';

                          return (
                            <div key={idx}>
                              <div className="flex gap-3 flex-wrap">
                                <span className="text-xs text-gray-400 px-2 py-0.5 rounded font-bold text-blue-600 dark:text-blue-400">{hostname}</span>
                              </div>
                              <div className="flex gap-3 flex-wrap">
                                {sapIds && <span className="text-xs text-gray-400 dark:text-gray-500 px-2 py-0.5 rounded">SAP: {sapIds}</span>}
                                {spokeSdpIds && <span className="text-xs text-gray-400 dark:text-gray-500 px-2 py-0.5 rounded">Spoke SDP: {spokeSdpIds}</span>}
                                {meshSdpIds && <span className="text-xs text-gray-400 dark:text-gray-500 px-2 py-0.5 rounded">Mesh SDP: {meshSdpIds}</span>}
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
          <div className="mb-4">
            <div
              className="px-4 py-3 bg-gray-50 dark:bg-gray-700 flex items-center gap-2 border-b border-gray-200 dark:border-gray-600 cursor-pointer select-none transition-colors duration-200 hover:bg-gray-100 dark:hover:bg-gray-600"
              onClick={() => toggleGroup('vprn')}
            >
              <span className="inline-flex items-center justify-center w-5 h-5 text-gray-500 dark:text-gray-400 mr-1 text-[10px] transition-transform duration-200">
                {expandedGroups['vprn'] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </span>
              <span className="text-lg">📡</span>
              <h3 className="m-0 text-[15px] font-semibold dark:text-gray-200">VPRN Services ({selectedServiceIds.length > 0 ? `${selectedVprnCount} / ` : ''}{vprnServices.length})</h3>
            </div>
            {expandedGroups['vprn'] && (
              <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
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
                  const isFullServiceSelected = selectedSet.has(fullServiceKey);
                  const selectedCount = allInterfaces.filter(intf =>
                    isFullServiceSelected || selectedSet.has(`vprn___${serviceId}___${hostname}___${intf.interfaceName}`)
                  ).length;
                  const isAllSelected = allInterfaces.length > 0 && selectedCount === allInterfaces.length;
                  const isPartialSelected = selectedCount > 0 && selectedCount < allInterfaces.length;

                  // Handlers
                  const toggleServiceAccordion = (e: React.MouseEvent) => {
                    e.stopPropagation();
                    setExpandedVPRNServices(prev => ({ ...prev, [serviceKey]: !prev[serviceKey] }));
                  };

                  // functional updater 패턴 — stale closure 방지 (rerender-functional-setstate)
                  const handleServiceSelect = (e: React.MouseEvent) => {
                    e.stopPropagation();
                    onSetSelected(prev => {
                      let newSelected = prev.filter(id =>
                        id !== fullServiceKey && !id.startsWith(`vprn___${serviceId}___${hostname}___`)
                      );
                      if (!isAllSelected) {
                        // Select All: Add individual keys for granular control
                        allInterfaces.forEach(intf => {
                          newSelected.push(`vprn___${serviceId}___${hostname}___${intf.interfaceName}`);
                        });
                      }
                      return newSelected;
                    });
                  };

                  const handleInterfaceToggle = (interfaceName: string) => {
                    const specificKey = `vprn___${serviceId}___${hostname}___${interfaceName}`;
                    onSetSelected(prev => {
                      // If full service currently selected, explode it
                      if (prev.includes(fullServiceKey)) {
                        const newSelected = prev.filter(id => id !== fullServiceKey);
                        // Add all other interfaces
                        allInterfaces.forEach(intf => {
                          if (intf.interfaceName !== interfaceName) {
                            newSelected.push(`vprn___${serviceId}___${hostname}___${intf.interfaceName}`);
                          }
                        });
                        // Don't add specificKey (we are toggling it OFF)
                        return newSelected;
                      }
                      if (prev.includes(specificKey)) {
                        return prev.filter(id => id !== specificKey);
                      }
                      return [...prev, specificKey];
                    });
                  };

                  return (
                    <div key={`vprn-group-${serviceKey}`} className="mb-2 border border-gray-200 dark:border-gray-700 rounded overflow-hidden">
                      {/* Service Header (Accordion) */}
                      <div
                        className="flex items-center px-3 py-2 bg-gray-50 dark:bg-gray-800 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                        onClick={toggleServiceAccordion}
                      >
                        <span className="mr-2 flex">
                          {isServiceExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </span>
                        <input
                          type="checkbox"
                          checked={isAllSelected}
                          ref={el => { if (el) el.indeterminate = isPartialSelected; }}
                          onChange={() => { }} // Handled by div click or separate click handler
                          onClick={handleServiceSelect}
                          className="mr-2"
                        />
                        <span className="font-semibold text-sm flex-1 m-0 dark:text-gray-200">
                          VPRN {serviceId} - {hostname} ({allInterfaces.length})
                        </span>
                        {haServiceKeys.has(`vprn-${serviceId}`) && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded ml-2">HA</span>
                        )}
                      </div>

                      {/* Service Description */}
                      {isServiceExpanded && representative.description && (
                        <div className="py-1 px-3 pl-11 text-[0.85em] text-gray-500 dark:text-gray-400">
                          {representative.description}
                        </div>
                      )}

                      {/* Interfaces List */}
                      {isServiceExpanded && (
                        <div className="p-2">
                          {allInterfaces.map((intf) => {
                            const isSelected = isFullServiceSelected || selectedSet.has(`vprn___${serviceId}___${hostname}___${intf.interfaceName}`);
                            return (
                              <div
                                key={`${hostname}-vprn-${serviceId}-${intf.interfaceName}`}
                                className={`flex items-center px-2.5 py-1.5 mb-1 border rounded cursor-pointer ${
                                  isSelected
                                    ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700'
                                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                                }`}
                                onClick={() => handleInterfaceToggle(intf.interfaceName)}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => { }}
                                  className="mr-2.5"
                                />
                                <div className="flex flex-col text-[0.9em]">
                                  <div className="flex items-center">
                                    <span className="font-bold text-blue-600 dark:text-blue-400 text-xs mr-2">{intf.interfaceName}</span>
                                    {intf.ipAddress && (
                                      <span className="bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-1.5 py-px rounded text-[0.85em]">
                                        {intf.ipAddress}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-gray-500 dark:text-gray-400 text-[0.85em] mt-0.5">
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
          <div className="mb-4">
            <div
              className="px-4 py-3 bg-gray-50 dark:bg-gray-700 flex items-center gap-2 border-b border-gray-200 dark:border-gray-600 cursor-pointer select-none transition-colors duration-200 hover:bg-gray-100 dark:hover:bg-gray-600"
              onClick={() => toggleGroup('ies')}
            >
              <span className="inline-flex items-center justify-center w-5 h-5 text-gray-500 dark:text-gray-400 mr-1 text-[10px] transition-transform duration-200">
                {expandedGroups['ies'] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </span>
              <span className="text-lg">🌐</span>
              <h3 className="m-0 text-[15px] font-semibold dark:text-gray-200">IES Services ({selectedServiceIds.length > 0 ? `${selectedIesInterfaceCount} / ` : ''}{iesInterfaceCount})</h3>
            </div>
            {expandedGroups['ies'] && (
              <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
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
                  const isFullHostSelected = selectedSet.has(fullHostKey);
                  const selectedCount = allInterfaces.filter(intf =>
                    isFullHostSelected || selectedSet.has(`ies___${hostname}___${intf.interfaceName}`)
                  ).length;
                  const isAllSelected = allInterfaces.length > 0 && selectedCount === allInterfaces.length;
                  const isPartialSelected = selectedCount > 0 && selectedCount < allInterfaces.length;

                  // Handlers
                  const toggleHostAccordion = (e: React.MouseEvent) => {
                    e.stopPropagation();
                    setExpandedIESHosts(prev => ({ ...prev, [hostname]: !prev[hostname] }));
                  };

                  // functional updater 패턴 — stale closure 방지 (rerender-functional-setstate)
                  const handleHostSelect = (e: React.MouseEvent) => {
                    e.stopPropagation();
                    onSetSelected(prev => {
                      let newSelected = prev.filter(id =>
                        id !== fullHostKey && !id.startsWith(`ies___${hostname}___`)
                      );
                      if (!isAllSelected) {
                        // Select All: Add individual keys for granular control
                        allInterfaces.forEach(intf => {
                          newSelected.push(`ies___${hostname}___${intf.interfaceName}`);
                        });
                      }
                      return newSelected;
                    });
                  };

                  const handleInterfaceToggle = (interfaceName: string) => {
                    const specificKey = `ies___${hostname}___${interfaceName}`;
                    onSetSelected(prev => {
                      // If full host currently selected, explode it
                      if (prev.includes(fullHostKey)) {
                        const newSelected = prev.filter(id => id !== fullHostKey);
                        // Add all other interfaces
                        allInterfaces.forEach(intf => {
                          if (intf.interfaceName !== interfaceName) {
                            newSelected.push(`ies___${hostname}___${intf.interfaceName}`);
                          }
                        });
                        // Don't add specificKey (we are toggling it OFF)
                        return newSelected;
                      }
                      if (prev.includes(specificKey)) {
                        return prev.filter(id => id !== specificKey);
                      }
                      return [...prev, specificKey];
                    });
                  };

                  return (
                    <div key={`ies-group-${hostname}`} className="mb-2 border border-gray-200 dark:border-gray-700 rounded overflow-hidden">
                      {/* Hostname Header (Accordion) */}
                      <div
                        className="flex items-center px-3 py-2 bg-gray-50 dark:bg-gray-800 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                        onClick={toggleHostAccordion}
                      >
                        <span className="mr-2 flex">
                          {isHostExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </span>
                        <input
                          type="checkbox"
                          checked={isAllSelected}
                          ref={el => { if (el) el.indeterminate = isPartialSelected; }}
                          onChange={() => { }} // Handled by div click or separate click handler
                          onClick={handleHostSelect}
                          className="mr-2"
                        />
                        <span className="font-semibold text-sm flex-1 m-0 dark:text-gray-200">{hostname} ({allInterfaces.length})</span>
                      </div>

                      {/* Interfaces List */}
                      {isHostExpanded && (
                        <div className="p-2">
                          {/* Quick Filters (Optional, can add later) */}
                          {allInterfaces.map((intf) => {
                            const isSelected = isFullHostSelected || selectedSet.has(`ies___${hostname}___${intf.interfaceName}`);
                            return (
                              <div
                                key={`${hostname}-${intf._parentService.serviceId}-${intf.interfaceName}`}
                                className={`flex items-center px-2.5 py-1.5 mb-1 border rounded cursor-pointer ${
                                  isSelected
                                    ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700'
                                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                                }`}
                                onClick={() => handleInterfaceToggle(intf.interfaceName)}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => { }}
                                  className="mr-2.5"
                                />
                                <div className="flex flex-col text-[0.9em]">
                                  <div className="flex items-center">
                                    <span className="font-bold text-blue-600 dark:text-blue-400 text-xs mr-2">{intf.interfaceName}</span>
                                    {haInterfaceKeys.has(`ies___${hostname}___${intf.interfaceName}`) && (
                                      <span className="px-1.5 py-0.5 text-[10px] font-bold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded mr-2">HA</span>
                                    )}
                                    {intf.ipAddress && (
                                      <span className="bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-1.5 py-px rounded text-[0.85em]">
                                        {intf.ipAddress}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-gray-500 dark:text-gray-400 text-[0.85em] mt-0.5">
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
          <div className="py-10 px-4 text-center text-gray-400 dark:text-gray-500">
            <p className="m-0 text-sm">No services found matching your filters.</p>
          </div>
        )}
      </div>

      {/* Dictionary Editor 모달 */}
      {showDictionaryEditor && (
        <Suspense fallback={null}>
          <DictionaryEditor
            configs={configs}
            dictionary={dictionary}
            onSave={(dict) => setDictionary(dict)}
            onClose={() => setShowDictionaryEditor(false)}
          />
        </Suspense>
      )}
    </div>
  );
}
