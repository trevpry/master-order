#!/bin/bash
# Docker container network connectivity test
# Run this inside the Docker container to test Stash connectivity

echo "🐳 Docker Container - Stash Connectivity Test"
echo "=============================================="

echo ""
echo "📋 Container Network Information:"
ip addr show
echo ""
echo "🌐 DNS Resolution Test:"
nslookup stash.local
nslookup host.docker.internal
echo ""

URLS=(
  "http://stash.local:9999"
  "http://192.168.1.154:9999"
  "http://host.docker.internal:9999" 
  "http://172.20.0.1:9999"
  "http://172.17.0.1:9999"
)

echo "🧪 Testing Stash Connectivity:"
for url in "${URLS[@]}"; do
  echo "   Testing: $url"
  
  # Test with curl first
  if timeout 5 curl -s "$url/graphql" > /dev/null 2>&1; then
    echo "   ✅ curl SUCCESS: $url"
  else
    echo "   ❌ curl FAILED: $url"
  fi
  
  # Test with telnet for port connectivity
  host_port=(${url//http:\/\// })
  host_port=(${host_port//:/ })
  host=${host_port[0]}
  port=${host_port[1]%/*}
  
  if timeout 3 bash -c "</dev/tcp/$host/$port" 2>/dev/null; then
    echo "   ✅ port OPEN: $host:$port"
  else
    echo "   ❌ port CLOSED: $host:$port"
  fi
  echo ""
done

echo "🔍 Environment Variables:"
echo "   STASH_URL=$STASH_URL"
echo "   STASH_URL_FALLBACK_1=$STASH_URL_FALLBACK_1"
echo "   STASH_URL_FALLBACK_2=$STASH_URL_FALLBACK_2"
echo "   STASH_URL_FALLBACK_3=$STASH_URL_FALLBACK_3"

echo ""
echo "=============================================="
