// v2 L2 VPN Parser API

export {
    parseL2VPNConfig,
    parseL2VPNServices,
    parseEpipe,
    parseVPLS,
    parseSAPs,
    parseSDPs,
    parseSpokeSDP,
    parseMeshSDP,
    extractSection,
    extractHostname,
    extractSystemIp,
} from './l2vpnParser';

export type {
    ParsedL2VPNConfig,
    L2VPNService,
    EpipeService,
    VPLSService,
    SAP,
    SDP,
    SpokeSDP,
    MeshSDP,
    ServiceConnection,
    Customer,
} from '../../types/v2';
