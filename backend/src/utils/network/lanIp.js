const os = require('os');

const SKIP = /^(docker|br-|veth|vEthernet|VMware|VirtualBox|utun|tun|tap)/i;

function getLanIp() {
  const candidates = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    if (SKIP.test(name)) continue;
    for (const a of addrs || []) {
      if (a.family !== 'IPv4' || a.internal) continue;
      if (a.address.startsWith('169.254.')) continue; // link-local
      candidates.push({ name, address: a.address });
    }
  }
  // prefer the usual physical adapters
  const preferred = candidates.find((c) => /^(en0|eth0|wlan0|Wi-Fi|Ethernet)$/i.test(c.name));
  return (preferred ?? candidates[0])?.address ?? null;
}

module.exports = { getLanIp };