// Purpose: The private address ranges our own proxies live in (loopback, Docker / LAN,
// link-local). One list for two jobs:
//  - app.js trusts only these as proxies (`trust proxy`), so req.ip is the real client
//    address taken from X-Forwarded-For and a client can't fake it;
//  - the login limiter never limits these — such an "IP" is a proxy, not a user, and
//    limiting it would lock out everyone behind it.

const net = require('net');

const PRIVATE_RANGES = [
  ['127.0.0.0', 8, 'ipv4'],
  ['10.0.0.0', 8, 'ipv4'],
  ['172.16.0.0', 12, 'ipv4'],
  ['192.168.0.0', 16, 'ipv4'],
  ['169.254.0.0', 16, 'ipv4'],
  ['::1', 128, 'ipv6'],
  ['fc00::', 7, 'ipv6'],
  ['fe80::', 10, 'ipv6'],
];

// For app.set('trust proxy', ...): CIDR strings.
const TRUSTED_PROXIES = PRIVATE_RANGES.map(([address, prefix]) => `${address}/${prefix}`);

const privateList = new net.BlockList();
for (const [address, prefix, type] of PRIVATE_RANGES) privateList.addSubnet(address, prefix, type);

// True for a private / proxy address — and for a missing or unparsable one, which is
// never a known user either. IPv4 written as IPv6 (::ffff:172.18.0.3) is handled.
function isPrivateAddress(ip) {
  const type = net.isIPv4(ip) ? 'ipv4' : net.isIPv6(ip) ? 'ipv6' : null;
  return !type || privateList.check(ip, type);
}

// The key the login limiter counts a client under, or null for a private / unknown
// address (never limited). IPv4 (also written as ::ffff:a.b.c.d) is the address itself;
// IPv6 is its /64 network, since one user or phone line usually holds a whole /64.
function clientKey(ip) {
  if (isPrivateAddress(ip)) return null;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (net.isIPv4(ip) || mapped) return `ip:${mapped ? mapped[1] : ip}`;
  return `ip6:${expandIPv6(ip).slice(0, 4).join(':')}::/64`;
}

// '2401:4900::1' -> ['2401','4900','0','0','0','0','0','1'] (lower case, no leading zeros).
function expandIPv6(ip) {
  const [head, tail] = ip.toLowerCase().split('::');
  const left = head ? head.split(':') : [];
  const right = tail !== undefined && tail !== '' ? tail.split(':') : [];
  const groups = tail === undefined ? left : [...left, ...Array(8 - left.length - right.length).fill('0'), ...right];
  return groups.map(g => parseInt(g, 16).toString(16));
}

module.exports = { TRUSTED_PROXIES, isPrivateAddress, clientKey };
