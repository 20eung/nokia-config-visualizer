// Test HA Detection
const config1 = `
system name "AlNet_NewYork_7750SR_I_BB3"
interface "p3/1/2"
  address 213.46.33.141/30
  port 3/1/2
  description "AIN_NewYork2F_Internet_1"
exit
`;

const config2 = `
system name "AlNet_NewYork_7750SR_I_BB4"
interface "p3/1/2"
  address 213.46.33.145/30
  port 3/1/2
  description "AIN_NewYork2F_Internet_2"
exit
`;

// When you select both interfaces, the system should:
// 1. Parse both configs
// 2. For each interface, find the peerIp (next-hop from static routes)
// 3. Check if those IPs belong to the same HA pair
// 4. If yes, generate a combined diagram

// Problem: There are NO static routes in these configs!
// So peerIp will be "Unknown" for both
// Without static routes, the HA detection logic cannot work

console.log("Missing static routes - this is why HA detection fails!");
