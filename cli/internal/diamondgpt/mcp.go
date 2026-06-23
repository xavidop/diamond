package diamondgpt

import (
	"context"

	"github.com/firebase/genkit/go/genkit"
	"github.com/firebase/genkit/go/plugins/mcp"
	"github.com/xavidop/diamond/cli/internal/mlb"
)

// ServeMCP starts a Model Context Protocol server over stdio that exposes the
// MLB Stats API tools (the same ones DiamondGPT uses) to any MCP client. No LLM
// provider is needed — this server only publishes tools. Blocks until stdin
// closes. JSON-RPC is spoken on stdout; logs go to stderr.
func ServeMCP(ctx context.Context, name, version string) error {
	g := genkit.Init(ctx) // registry only; no model required for a tool server
	defineTools(g, mlb.DefaultClient())
	srv := mcp.NewMCPServer(g, mcp.MCPServerOptions{Name: name, Version: version})
	return srv.ServeStdio()
}
