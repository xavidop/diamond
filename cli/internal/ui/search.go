package ui

import (
	"strings"

	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
)

type SearchInput struct {
	input textinput.Model
}

func NewSearchInput(placeholder string) SearchInput {
	ti := textinput.New()
	ti.Placeholder = placeholder
	ti.Focus()
	return SearchInput{input: ti}
}

func (s SearchInput) Update(msg tea.Msg) (SearchInput, tea.Cmd) {
	var cmd tea.Cmd
	s.input, cmd = s.input.Update(msg)
	return s, cmd
}

func (s SearchInput) View() string  { return s.input.View() }
func (s SearchInput) Value() string { return s.input.Value() }

func (s *SearchInput) SetValue(v string) {
	s.input.SetValue(v)
}

// Filter returns the indices of items whose lowercase name contains the query.
func Filter(items []string, query string) []int {
	q := strings.ToLower(query)
	var matches []int
	for i, item := range items {
		if strings.Contains(strings.ToLower(item), q) {
			matches = append(matches, i)
		}
	}
	return matches
}
