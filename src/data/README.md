`emoji.json` contains the 3,781 fully qualified Unicode Emoji 16.0 sequences.
Each row stores `[codePoints, glyph, Unicode name, picker category]`.

Source: https://unicode.org/Public/emoji/16.0/emoji-test.txt
License: [Unicode License v3](../../licenses/UNICODE.txt).

The local provider renders native glyphs in SVG data URLs. Appearance and support
for newer sequences depend on the operating system's emoji font. All skin tone
variants are individually searchable. These are Unicode names, so short names
can differ from Jira's aliases. No site-specific or custom Atlassian emoji are
included.
