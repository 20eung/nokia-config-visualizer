/**
 * Simple parser test - v5.5.0
 */
import { parseNokiaConfig, extractHostname } from './src/services/nokiaParser';

const testConfig = `
#-------------------------------------------------
echo "System Configuration"
#-------------------------------------------------
    system
        name "TEST-ROUTER"
        interface "system"
            address 10.0.0.1/32
        exit
    exit

#-------------------------------------------------
echo "Service Configuration"
#-------------------------------------------------
    service
        epipe 100 name "TEST-EPIPE" customer 1 create
            description "Test Epipe Service"
            sap 1/1/1:100 create
                description "Test SAP"
            exit
            no shutdown
        exit
    exit
`;

console.log('Testing parser...');

try {
  const hostname = extractHostname(testConfig);
  console.log(`✅ extractHostname: ${hostname}`);

  const result = parseNokiaConfig(testConfig);
  console.log(`✅ parseNokiaConfig: ${result.hostname}, ${result.services.length} services`);
  console.log(`   Service: ${result.services[0]?.serviceType} ${result.services[0]?.serviceId}`);
} catch (error) {
  console.error('❌ Parser test failed:', error);
  process.exit(1);
}

console.log('\n✅ All tests passed!');
