# Recommended MCP Servers for Kvota

**MCP (Model Context Protocol)** servers extend Claude Code's capabilities.

## Currently Installed

- ✅ **chrome-devtools** - Browser debugging via remote debugging port 9222
- ✅ **postgres** - Direct Supabase database queries and schema inspection
- ✅ **github** - GitHub issue and PR management from Claude

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

## Installation Instructions

### Via Claude Code Settings

1. Open Claude Code settings
2. Go to MCP section
3. Add server configuration
4. Restart Claude Code

### Manual Configuration

Edit `.claude/settings.json`:
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
        "GITHUB_TOKEN": "your_github_token_here"
      }
    }
  }
}
```

## Resources

- **Official MCP Servers:** https://github.com/modelcontextprotocol/servers
- **Awesome MCP List:** https://github.com/punkpeye/awesome-mcp-servers
- **MCP Documentation:** https://modelcontextprotocol.io/

---

**Note:** Install these as needed. Start with PostgreSQL and GitHub for maximum benefit.
