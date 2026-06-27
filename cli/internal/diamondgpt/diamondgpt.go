// Package diamondgpt wraps Genkit (Go) to provide an MLB-aware chat
// assistant (DiamondGPT) backed by Gemini, Anthropic, or OpenAI, with tools
// that call the live MLB Stats API.
package diamondgpt

import (
	"context"
	"fmt"
	"io"
	"log"
	"log/slog"
	"os"
	"time"

	"github.com/firebase/genkit/go/ai"
	aix "github.com/firebase/genkit/go/ai/exp"
	"github.com/firebase/genkit/go/ai/exp/localstore"
	"github.com/firebase/genkit/go/genkit"
	exp "github.com/firebase/genkit/go/genkit/exp"
	"github.com/firebase/genkit/go/plugins/anthropic"
	"github.com/firebase/genkit/go/plugins/compat_oai/openai"
	"github.com/firebase/genkit/go/plugins/googlegenai"
	"github.com/xavidop/diamond/cli/internal/mlb"
)

// silenceLogs routes Genkit's standard-logger and slog output to the void.
// Genkit and its plugins emit lines like "model is experimental or unstable"
// and key-presence warnings to stderr, which corrupt the full-screen TUI.
func silenceLogs() {
	log.SetOutput(io.Discard)
	slog.SetDefault(slog.New(slog.NewTextHandler(io.Discard, nil)))
}

// Provider is a selectable LLM backend. Tools indicates whether the provider
// supports tool calling through Genkit. All three do; Anthropic additionally
// needs strict tool schemas disabled (see New) to avoid a multi-minute stall.
type Provider struct {
	ID, Label, EnvVar, Model string
	Tools                    bool
}

// Providers are the supported backends, in display order.
var Providers = []Provider{
	{ID: "gemini", Label: "Google Gemini", EnvVar: "GEMINI_API_KEY", Model: "googleai/gemini-flash-latest", Tools: true},
	{ID: "anthropic", Label: "Anthropic Claude", EnvVar: "ANTHROPIC_API_KEY", Model: "anthropic/claude-sonnet-4-6", Tools: true},
	{ID: "openai", Label: "OpenAI", EnvVar: "OPENAI_API_KEY", Model: "openai/gpt-4.1-mini", Tools: true},
}

// HasKey reports whether the provider's API key is present in the environment.
func (p Provider) HasKey() bool { return os.Getenv(p.EnvVar) != "" }

// Client is a configured Genkit assistant with MLB tools and an agent-managed
// conversation. Conversation history is owned by the agent's in-memory session
// store; we only track the session ID to resume across turns.
type Client struct {
	g         *genkit.Genkit
	provider  Provider
	tools     []ai.ToolRef
	agent     *aix.Agent[any]
	sessionID string
	genConfig any // provider-specific generation config (e.g. Anthropic max_tokens)
}

// New initializes Genkit for the chosen provider. If apiKey is non-empty it is
// also exported to the provider's env var for the rest of the process.
func New(ctx context.Context, p Provider, apiKey string) (cl *Client, err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("could not initialize %s: %v", p.Label, r)
		}
	}()

	silenceLogs() // keep Genkit/plugin logs out of the TUI

	if apiKey != "" {
		_ = os.Setenv(p.EnvVar, apiKey)
	}

	var g *genkit.Genkit
	switch p.ID {
	case "gemini":
		g = genkit.Init(ctx,
			genkit.WithPlugins(&googlegenai.GoogleAI{APIKey: apiKey}),
			genkit.WithDefaultModel(p.Model),
			genkit.WithExperimental())
	case "openai":
		g = genkit.Init(ctx,
			genkit.WithPlugins(&openai.OpenAI{APIKey: apiKey}),
			genkit.WithDefaultModel(p.Model),
			genkit.WithExperimental())
	case "anthropic":
		// Native Anthropic plugin: supports tool calling and lists models
		// dynamically. Reads ANTHROPIC_API_KEY when APIKey is empty.
		g = genkit.Init(ctx,
			genkit.WithPlugins(&anthropic.Anthropic{APIKey: apiKey}),
			genkit.WithDefaultModel(p.Model),
			genkit.WithExperimental())

	default:
		return nil, fmt.Errorf("unknown provider %q", p.ID)
	}

	c := &Client{g: g, provider: p}
	var toolOpts []ai.ToolOption
	if p.ID == "anthropic" {
		// The native Anthropic plugin requires max_tokens on every request.
		c.genConfig = map[string]any{"max_tokens": 8192}
		// It also defaults tools to strict schemas, which route through
		// Anthropic's constrained decoding and stall the model call for tens of
		// seconds per tool schema — with our 18 tools the first call never
		// returns. Disabling strict keeps tool-calling responsive (~8s); Genkit
		// still validates tool input against the schema, so accuracy holds.
		toolOpts = append(toolOpts, ai.WithStrictSchema(false))
	}
	if p.Tools {
		c.tools = defineTools(g, mlb.DefaultClient(), toolOpts...)
	}

	promptOpts := aix.InlinePrompt{
		ai.WithSystem(systemPrompt(p.Tools)),
		ai.WithMaxTurns(6),
	}
	if p.Tools {
		promptOpts = append(promptOpts, ai.WithTools(c.tools...))
	}
	if c.genConfig != nil {
		promptOpts = append(promptOpts, ai.WithConfig(c.genConfig))
	}
	c.agent = exp.DefineAgent[any](g, "diamondgpt", promptOpts,
		aix.WithSessionStore(localstore.NewInMemorySessionStore[any]()))

	return c, nil
}

// ToolsEnabled reports whether this client can fetch live MLB data via tools.
func (c *Client) ToolsEnabled() bool { return len(c.tools) > 0 }

func systemPrompt(tools bool) string {
	now := time.Now()
	when := fmt.Sprintf("Today is %s and the current MLB season is %d. ", now.Format("Monday, Jan 2 2006"), now.Year())
	if tools {
		return "You are DiamondGPT, a concise and friendly baseball expert living inside a terminal app. " + when +
			"ALWAYS use the provided tools to fetch real data from the MLB Stats API — never invent scores, stats, standings, or transactions. " +
			"To answer about a specific player, first call mlb_search_player to get the player's ID, then mlb_player with that ID. " +
			"Keep answers short and easy to read in a terminal: plain text, compact lists, no markdown tables."
	}
	return "You are DiamondGPT, a concise and friendly baseball expert living inside a terminal app. " + when +
		"You do NOT have live data access in this mode, so answer from your baseball knowledge. " +
		"If asked for very recent scores, standings, or current-season stats you may not know, say so plainly and suggest switching to the Gemini or OpenAI provider for live data. " +
		"Keep answers short and terminal-friendly."
}

// Ask sends a user message to the agent and returns the reply.
func (c *Client) Ask(ctx context.Context, userMsg string) (reply string, err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("%v", r)
		}
	}()

	var opts []aix.InvocationOption[any]
	if c.sessionID != "" {
		opts = append(opts, aix.WithSessionID[any](c.sessionID))
	}
	out, err := c.agent.RunText(ctx, userMsg, opts...)
	if err != nil {
		return "", err
	}
	if out.FinishReason == aix.AgentFinishReasonFailed {
		if out.Error != nil {
			return "", out.Error
		}
		return "", fmt.Errorf("agent turn failed")
	}
	c.sessionID = out.SessionID
	if out.Message == nil {
		return "", nil
	}
	return out.Message.Text(), nil
}
