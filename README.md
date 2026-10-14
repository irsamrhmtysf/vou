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

Text translation uses the open-source [LibreTranslate](https://libretranslate.com/)
API. The app starts with a public LibreTranslate server, which may be busy,
unavailable, or require an API key. Open **Translation settings** to enter a
different server URL and, if needed, an API key. For more control, run your own
LibreTranslate server; for example:

```sh
docker run --rm -p 5000:5000 libretranslate/libretranslate
```

Then set the server URL to `http://localhost:5000`. Speech recognition is
handled by the browser and may use the browser vendor's speech service. The
resulting text is sent to the selected translation server; check both services'
policies before translating private information.

## Languages

Indonesian (`id`), Arabic (`ar`), English (`en`), Chinese (`zh`), Korean (`ko`),
and Japanese (`ja`). Actual language-pair availability depends on the selected
LibreTranslate server and its installed translation models.

## License

This project is released under the MIT License; see [LICENSE](LICENSE).
