export interface NokiaPort {
  id: string; // e.g., "1/1/1"
  description?: string;
  mode?: string; // access or network
}

export interface NokiaInterface {
  name: string; // e.g., "system", "to-router-b"
  ipAddress?: string; // e.g., "192.168.1.1/30"
  portId?: string; // e.g., "1/1/1"
  description?: string;
  qos?: string;
  serviceId?: string; // e.g., "100" from vprn
  serviceType?: string; // e.g., "VPRN 100", "IES 200"
  serviceDescription?: string; // Service-level description
  toDevice?: string; // Parsed from description, e.g., "RouterB"
  portDescription?: string; // Description from the physical port
  ingressQos?: string; // Ingress QoS policy ID
  egressQos?: string; // Egress QoS policy ID
  vrrpVip?: string; // VRRP Virtual IP
  vrrpPriority?: number; // VRRP Priority (for master detection)
  portEthernet?: { mode?: string; encapType?: string; mtu?: number; speed?: string; autonegotiate?: string };
}

export interface NokiaStaticRoute {
  prefix: string;
  nextHop: string;
  preference?: string;
  metric?: string;
}

export interface NokiaDevice {
  hostname: string;
  ports: NokiaPort[];
  interfaces: NokiaInterface[];
  staticRoutes: NokiaStaticRoute[];
}

export interface HAPair {
  device1: string; // hostname
  device2: string; // hostname
  type: 'vrrp' | 'static-route' | 'manual' | 'interface-based';
  commonNetwork?: string;
}

export interface Link {
  source: string; // hostname
  target: string; // hostname
  sourceInterface?: string;
  targetInterface?: string;
}

export interface NetworkTopology {
  devices: NokiaDevice[];
  links: Link[];
  haPairs: HAPair[];
}
