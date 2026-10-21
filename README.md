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
Choose the languages, then type a phrase and pause briefly for it to translate
automatically, or select the microphone and speak. The **Translate** button is
still available for an immediate translation. Use the speaker button to hear
the result. When translating into Arabic, Chinese, Japanese, or Korean, a
Latin-script pronunciation guide appears below the translation. Each entry can
contain up to 1,000 characters; longer entries are sent as multiple requests
of at most 500 characters each.

Voice input uses the browser's Web Speech API and is currently supported mainly
by Chromium-based browsers. Microphone access requires permission and HTTPS or
localhost. If voice input is unavailable, typing and translation still work.

## Translation service

Text translation uses the free [MyMemory](https://mymemory.translated.net/)
API first. If MyMemory is unavailable or reaches its daily limit, the app
automatically tries Google Translate. Both services are accessed from the
browser without an API key. MyMemory requests are limited to 500 characters,
so the app divides entries of up to 1,000 characters into smaller chunks.
Google Translate also provides pronunciation guides for Arabic, Chinese,
Japanese, and Korean. The Google endpoint is an undocumented public endpoint
and may be rate-limited or change without notice. Text may be sent to either
service; do not translate sensitive information.

Speech recognition is handled by the browser and may use the browser vendor's
speech service.

## Languages

Indonesian (`id`), Arabic (`ar`), English (`en`), Chinese (`zh`), Korean (`ko`),
and Japanese (`ja`). Language-pair availability and translation quality depend
on the external translation service.

## License

This project is released under the MIT License; see [LICENSE](LICENSE).
