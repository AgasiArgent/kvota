# Recommended MCP Servers for Kvota

**MCP (Model Context Protocol)** servers extend Claude Code's capabilities.

## Currently Configured

- ✅ **postgres** - Direct Supabase database queries and schema inspection
  - Status: **Working** (verified 2025-10-19)
  - Can query database, inspect schemas, test SQL

- ⚠️ **github** - GitHub issue and PR management from Claude
  - Status: **MCP tools not working (env var issue), using direct API calls instead**
  - Token: Has full scopes including `repo` (verified working via curl)
  - Workaround: Using `curl -H "Authorization: token <token>" https://api.github.com/...` for GitHub operations
  - Repository: https://github.com/AgasiArgent/kvota (private, accessible via API)

- ✅ **chrome-devtools** - Browser debugging via remote debugging port 9222
  - Status: **Configured**

**Configuration:** See [.mcp.json](/.mcp.json) and [.claude/settings.json](/.claude/settings.json)

## Additional MCP Servers (Optional)

### Medium Priority

**1. Filesystem MCP Server**
- **Why:** Enhanced file operations
- **Use case:** Better file search, bulk operations
- **Install:** `npx -y @modelcontextprotocol/server-filesystem`
- **Benefit:** More powerful file operations

**2. SQLite MCP Server** (for local development)
- **Why:** Local database for testing without Supabase
- **Use case:** Offline development, faster tests
- **Install:** `npx -y @modelcontextprotocol/server-sqlite`
- **Benefit:** Test database operations locally

### Low Priority

**3. Memory MCP Server**
- **Why:** Persistent memory across sessions
- **Use case:** Remember project decisions, patterns
- **Install:** `npx -y @modelcontextprotocol/server-memory`
- **Benefit:** Better context retention

## Current Configuration

MCP servers are configured in two files:

### 1. `.mcp.json` - Server Definitions

Defines which MCP servers to run and their configuration:

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres", "postgresql://..."]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_..."
      }
    }
  }
}
```

### 2. `.claude/settings.json` - Enable Servers

Tells Claude Code to enable the servers from `.mcp.json`:

```json
{
  "enableAllProjectMcpServers": true,
  "enabledMcpjsonServers": ["postgres", "github", "chrome-devtools"]
}
```

### Adding New MCP Servers

1. Add server definition to `.mcp.json`
2. Add server name to `enabledMcpjsonServers` in `.claude/settings.json`
3. Reload VSCode window (Ctrl+Shift+P → "Developer: Reload Window")

## Resources

- **Official MCP Servers:** https://github.com/modelcontextprotocol/servers
- **Awesome MCP List:** https://github.com/punkpeye/awesome-mcp-servers
- **MCP Documentation:** https://modelcontextprotocol.io/

---

**Note:** Install these as needed. Start with PostgreSQL and GitHub for maximum benefit.
