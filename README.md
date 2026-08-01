# Jianpu Web

Jianpu Web is a browser-based playground for composing, previewing, and sharing simplified notation with the ABCJS engine. The project now opens directly at the repository root so GitHub Pages can serve the experience as a real product landing page.

## Open the playground

Visit the live demo at:

- https://zeppelintsai.github.io/jianpu-web/

The main entry point is the root [index.html](index.html) file, which loads the simplified-notation editor and playback tools directly.

## What you can do

- Write and edit jianpu-style notation in the browser
- Render sheet music instantly with ABCJS
- Play the result, print it, or save it as PDF
- Use the same project as a lightweight local playground or a GitHub Pages deployment

## Representative example

Here is a short sample melody in the spirit of the opening phrase of "思愁":

```abc
X:1
T:思愁
M:4/4
L:1/4
K:C
| C E G A | G E D2 | C E G A | G E D2 |]
```

## Local development

If you want to run the project locally, open [index.html](index.html) directly or serve the repository root with a simple web server.

```bash
python -m http.server 8000
```

Then open http://127.0.0.1:8000/ in your browser.

## License

This project is distributed under the MIT license. See [LICENSE.md](LICENSE.md) for details.
