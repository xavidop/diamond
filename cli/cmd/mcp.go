package cmd

import (
	"context"

	"github.com/spf13/cobra"
	"github.com/xavidop/diamond/cli/internal/diamondgpt"
)

var (
	mcpName    string
	mcpVersion string
)

var mcpCmd = &cobra.Command{
	Use:   "mcp",
	Short: "Run an MCP server exposing the MLB data tools",
	Long: `Run a Model Context Protocol (MCP) server over stdio that exposes Diamond's
MLB Stats API tools — schedule, standings, leaders, players, teams, rosters,
splits, awards, postseason, draft, venues, transactions and more — to any MCP
client (Claude Desktop, Cursor, another Genkit app, …).

Built with Genkit Go; the tools are the exact ones DiamondGPT uses.

Configure it in your MCP client. For example, Claude Desktop
(claude_desktop_config.json):

    {
      "mcpServers": {
        "diamond": { "command": "diamond", "args": ["mcp"] }
      }
    }

The server speaks JSON-RPC on stdout — run it from an MCP client, not
interactively, and don't pipe other data to its stdin.`,
	SilenceUsage: true,
	Args:         cobra.NoArgs,
	RunE: func(cmd *cobra.Command, args []string) error {
		return diamondgpt.ServeMCP(context.Background(), mcpName, mcpVersion)
	},
}

func init() {
	mcpCmd.Flags().StringVar(&mcpName, "name", "diamond-mlb", "MCP server name advertised to clients")
	mcpCmd.Flags().StringVar(&mcpVersion, "server-version", "1.0.0", "MCP server version advertised to clients")
}
