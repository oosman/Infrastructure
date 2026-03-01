// PAC file: route only Claude.ai API traffic through mitmproxy
// All other traffic goes direct.
function FindProxyForURL(url, host) {
  if (shExpMatch(host, "api.claude.ai") ||
      shExpMatch(host, "claude.ai") ||
      shExpMatch(host, "*.claude.ai")) {
    return "PROXY 127.0.0.1:8080";
  }
  return "DIRECT";
}
