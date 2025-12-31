#!/usr/bin/env node

const os = require('os');
const { execSync } = require('child_process');

function isPrivateIPv4(ip) {
  if (typeof ip !== 'string') return false;
  if (ip.startsWith('10.')) return true;
  if (ip.startsWith('192.168.')) return true;

  // 172.16.0.0 – 172.31.255.255
  const m = ip.match(/^172\.(\d{1,3})\./);
  if (m) {
    const second = Number(m[1]);
    return second >= 16 && second <= 31;
  }

  return false;
}

function getDefaultRouteIPv4() {
  // On Linux, this is the most reliable way to get the IP address used for outbound traffic
  // (typically the same one your phone can reach on the LAN).
  if (process.platform !== 'linux') return null;

  try {
    const out = execSync('ip route get 1.1.1.1', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString('utf8')
      .trim();

    // Example: "1.1.1.1 via 192.168.1.1 dev wlp2s0 src 192.168.1.50 uid 1000"
    const m = out.match(/\bsrc\s+(\d+\.\d+\.\d+\.\d+)\b/);
    if (m && isPrivateIPv4(m[1])) return m[1];
  } catch {
    // Ignore and fall back to interface inspection
  }

  return null;
}

function isLikelyReachableInterface(name) {
  const n = String(name || '').toLowerCase();

  // Exclude common virtual / container / tunnel interfaces
  if (
    n === 'lo' ||
    n.startsWith('docker') ||
    n.startsWith('br-') ||
    n.startsWith('veth') ||
    n.startsWith('virbr') ||
    n.startsWith('wg') ||
    n.startsWith('tun') ||
    n.startsWith('tap')
  ) {
    return false;
  }

  return true;
}

function scoreIp(ip) {
  // Prefer typical home/office LAN ranges first.
  if (ip.startsWith('192.168.')) return 300;
  if (ip.startsWith('10.')) return 200;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return 100;
  return 0;
}

function getCandidateIPv4s() {
  const nets = os.networkInterfaces();
  const ips = [];

  for (const name of Object.keys(nets)) {
    if (!isLikelyReachableInterface(name)) continue;
    for (const net of nets[name] || []) {
      if (net.family !== 'IPv4') continue;
      if (net.internal) continue;
      ips.push(net.address);
    }
  }

  return ips;
}

const ips = getCandidateIPv4s();
const privateIps = ips.filter(isPrivateIPv4);

const defaultRouteIp = getDefaultRouteIPv4();
const chosenIp =
  defaultRouteIp ||
  [...privateIps].sort((a, b) => scoreIp(b) - scoreIp(a))[0] ||
  ips[0];

if (!chosenIp) {
  process.stderr.write(
    'Could not determine a LAN IP address.\n' +
      'Set EXPO_PUBLIC_API_BASE_URL manually, e.g.:\n' +
      '  EXPO_PUBLIC_API_BASE_URL=http://192.168.1.50:8080/api/v1 npx expo start --tunnel -c\n'
  );
  process.exit(1);
}

process.stdout.write(`http://${chosenIp}:8080/api/v1`);
