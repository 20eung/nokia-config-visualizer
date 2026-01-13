
import * as fs from 'fs';
import * as path from 'path';
import { parseL2VPNConfig } from './src/utils/v2/l2vpnParser';

// Mock types if needed or just rely on ts-node to handle imports if path mapping allows
// simpler to just run it with ts-node if project is set up, or just use a simple robust script

const configPath = '/Users/a04258/Project/mermaid-web/config/SKNet_PangyoITC2F_7750SR_MPLS_1 20260113.txt';

try {
    const configText = fs.readFileSync(configPath, 'utf8');
    console.log(`Successfully read config file: ${configPath} (${configText.length} bytes)`);

    console.log('Parsing configuration...');
    const result = parseL2VPNConfig(configText);

    console.log('---------------------------------------------------');
    console.log(`Hostname: ${result.hostname}`);
    console.log(`System IP: ${result.systemIp}`);
    console.log(`Total Services: ${result.services.length}`);
    console.log(`Total SDPs: ${result.sdps.length}`);
    console.log('---------------------------------------------------');

    const vprns = result.services.filter(s => s.serviceType === 'vprn');
    console.log(`VPRN Services: ${vprns.length}`);

    vprns.forEach(v => {
        // Cast to VPRNService to access specific fields (in JS this is implicit)
        const vprn = v as any;
        console.log(`\nVPRN ID: ${vprn.serviceId}`);
        console.log(`  Description: ${vprn.description}`);
        console.log(`  AS: ${vprn.autonomousSystem}, RD: ${vprn.routeDistinguisher}`);
        console.log(`  Interfaces: ${vprn.interfaces.length}`);
        vprn.interfaces.forEach((iface: any) => {
            console.log(`    - Interface: ${iface.interfaceName} (IP: ${iface.ipAddress}, Port: ${iface.portId || 'N/A'}, VRRP: ${iface.vrrpGroupId || 'N/A'})`);
        });
        console.log(`  Static Routes: ${vprn.staticRoutes.length}`);
        console.log(`  BGP Neighbors: ${vprn.bgpNeighbors.length}`);
    });

    const epipes = result.services.filter(s => s.serviceType === 'epipe');
    console.log(`\nEpipe Services: ${epipes.length}`);
    if (epipes.length > 0) {
        const first = epipes[0] as any;
        console.log(`Example Epipe ${first.serviceId}: SAPs=${first.saps?.length}, SpokeSDPs=${first.spokeSdps?.length}`);
    }

} catch (error) {
    console.error('Error running test:', error);
}
