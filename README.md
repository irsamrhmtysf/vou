# V.O.U

V.O.U is a small, free and open-source voice-first translator. It starts with
Indonesian ↔ Arabic and also offers English, Chinese, Korean, and Japanese.

## Use it

Serve the project locally (microphone access is restricted on most `file://`
pages):

```sh
python -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000) in a supported browser.
Choose the languages, type a phrase, or select the microphone and speak. A
voice transcript is translated automatically; typed text is translated with
the **Translate** button. Use the speaker button to hear the result.

Voice input uses the browser's Web Speech API and is currently supported mainly
by Chromium-based browsers. Microphone access requires permission and HTTPS or
localhost. If voice input is unavailable, typing and translation still work.

## Translation service

Text translation uses the free [MyMemory](https://mymemory.translated.net/)
API, which works directly from the GitHub Pages app without a server or API key.
The free service is limited to about 5,000 characters per day and may be
temporarily unavailable. Text is sent to MyMemory for translation; do not
translate sensitive information.

Speech recognition is handled by the browser and may use the browser vendor's
speech service.

## Languages

Indonesian (`id`), Arabic (`ar`), English (`en`), Chinese (`zh`), Korean (`ko`),
and Japanese (`ja`). Language-pair availability and translation quality depend
on the external translation service.

## License

This project is released under the MIT License; see [LICENSE](LICENSE).
