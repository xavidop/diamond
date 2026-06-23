package ui

import "strings"

// ANSI-Shadow block letters, 6 rows tall, joined row-wise into the DIAMOND logo.
var letterBlocks = map[rune][]string{
	'D': {"██████╗ ", "██╔══██╗", "██║  ██║", "██║  ██║", "██████╔╝", "╚═════╝ "},
	'I': {"██╗", "██║", "██║", "██║", "██║", "╚═╝"},
	'A': {" █████╗ ", "██╔══██╗", "███████║", "██╔══██║", "██║  ██║", "╚═╝  ╚═╝"},
	'M': {"███╗   ███╗", "████╗ ████║", "██╔████╔██║", "██║╚██╔╝██║", "██║ ╚═╝ ██║", "╚═╝     ╚═╝"},
	'O': {" ██████╗ ", "██╔═══██╗", "██║   ██║", "██║   ██║", "╚██████╔╝", " ╚═════╝ "},
	'N': {"███╗   ██╗", "████╗  ██║", "██╔██╗ ██║", "██║╚██╗██║", "██║ ╚████║", "╚═╝  ╚═══╝"},
}

func buildLogo(word string) []string {
	rows := make([]string, 6)
	for _, ch := range word {
		blk, ok := letterBlocks[ch]
		if !ok {
			continue
		}
		for i := 0; i < 6; i++ {
			rows[i] += blk[i]
		}
	}
	return rows
}

var diamondLogo = buildLogo("DIAMOND")

// renderLogo draws the animated DIAMOND banner centered within width w.
func renderLogo(w int) string {
	start, end := headerColors()
	phase := float64(animFrame) * 0.018
	var b strings.Builder
	for i, row := range diamondLogo {
		b.WriteString(centerBlock(gradientShimmer(row, start, end, phase), w))
		if i < len(diamondLogo)-1 {
			b.WriteByte('\n')
		}
	}
	return b.String()
}
