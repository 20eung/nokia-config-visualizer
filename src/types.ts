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
    toDevice?: string; // Parsed from description, e.g., "RouterB"
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
