#!/usr/bin/env bash
# Better Slido only needs file edits — disable Intuit/work MCPs that open browser auth.
set -euo pipefail
for id in auth-mcp-server intuit-google-drive-mcp intuit-remote-mcp-proxy intuit-github-mcp jira-mcp databricks-mcp; do
  agent mcp disable "$id" 2>/dev/null || true
  echo "disabled: $id"
done
echo "Done. Run: agent mcp list"
