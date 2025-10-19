# MCP Server Installation Guide

**Status:** Infrastructure setup complete. MCP servers require manual installation.

## What's Already Done

✅ All infrastructure tools installed and configured
✅ Documentation created: RECOMMENDED_MCP_SERVERS.md
✅ Committed and pushed to GitHub (4 commits total)

## MCP Servers - Manual Installation Required

**Currently Active:**
- ✅ chrome-devtools MCP (pre-installed)

**Recommended to Install Next:**

### Option 1: Through Claude Code Settings UI (Easiest)

1. Open Claude Code settings (click gear icon or use Command/Ctrl + ,)
2. Navigate to "MCP Servers" section
3. Click "Add MCP Server"
4. Add the following servers:

**PostgreSQL MCP** (Priority 1)
```
Name: postgres
Command: npx
Args: -y @modelcontextprotocol/server-postgres
Connection: Your Supabase PostgreSQL connection string
```

**GitHub MCP** (Priority 2)
```
Name: github
Command: npx
Args: -y @modelcontextprotocol/server-github
Env: GITHUB_TOKEN=your_github_personal_access_token
```

5. Restart Claude Code to activate

### Option 2: Manual Configuration File

Edit Claude Code's MCP configuration file (location varies by OS):
- **Windows:** `%APPDATA%\Code\User\globalStorage\anthropic.claude-code\settings.json`
- **macOS:** `~/Library/Application Support/Code/User/globalStorage/anthropic.claude-code/settings.json`
- **Linux:** `~/.config/Code/User/globalStorage/anthropic.claude-code/settings.json`

Add to configuration:
```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres", "postgresql://user:password@host:port/database"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "ghp_your_token_here"
      }
    }
  }
}
```

## Benefits Once Installed

**PostgreSQL MCP:**
- Query database directly from Claude Code
- Inspect schema without Supabase dashboard
- Debug data issues faster

**GitHub MCP:**
- Create issues from Claude
- Manage PRs and projects
- Stay in coding flow

## Next Steps After MCP Installation

1. **Test ag-Grid Implementation** (from Session 8)
   - Phases 2-6 await testing
   - File upload → product editing flow

2. **Write More Tests**
   - Expand calculation engine tests
   - Add E2E tests for quote creation

3. **Start Feature Development**
   - All infrastructure ready
   - Best practices in place
   - Quality gates active

## Resources

- Full recommendations: `.claude/RECOMMENDED_MCP_SERVERS.md`
- Infrastructure summary: `.claude/INFRASTRUCTURE_SETUP_SUMMARY.md`
- GitHub repo: https://github.com/AgasiArgent/kvota

---

**Installation Note:** MCP servers are installed per-machine, not per-project. Once installed, they'll be available for all your Claude Code projects.
