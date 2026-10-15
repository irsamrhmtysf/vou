const languages = {
  id: { label: "Indonesia", flag: "id", speech: "id-ID", translation: "id" },
  ar: { label: "العربية", flag: "eg", speech: "ar-EG", translation: "ar" },
  en: { label: "English", flag: "us", speech: "en-US", translation: "en" },
  zh: { label: "中文", flag: "cn", speech: "zh-CN", translation: "zh-CN" },
  ko: { label: "한국어", flag: "kr", speech: "ko-KR", translation: "ko" },
  ja: { label: "日本語", flag: "jp", speech: "ja-JP", translation: "ja" },
};

const MAX_INPUT_LENGTH = 1000;
const MAX_QUERY_LENGTH = 500;
const sourceLanguage = document.querySelector("#source-language");
const targetLanguage = document.querySelector("#target-language");
const sourceText = document.querySelector("#source-text");
const output = document.querySelector("#translation-output");
const sourceFlag = document.querySelector("#source-flag");
const targetFlag = document.querySelector("#target-flag");
const sourceCardFlag = document.querySelector("#source-card-flag");
const targetCardFlag = document.querySelector("#target-card-flag");
const sourceLabel = document.querySelector("#source-label");
const targetLabel = document.querySelector("#target-label");
const characterCount = document.querySelector("#character-count");
const statusMessage = document.querySelector("#status-message");
const translateButton = document.querySelector("#translate-button");
const listenButton = document.querySelector("#listen-button");
const speakButton = document.querySelector("#speak-button");
const copyButton = document.querySelector("#copy-button");
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

const AUTO_TRANSLATE_DELAY = 900;

let recognition;
let requestNumber = 0;
let speechPlaybackId = 0;
let speechPrefix = "";
let lastTranslation = "";
let autoTranslateTimer;

function setStatus(message, state = "ready") {
  statusMessage.textContent = message;
  statusMessage.dataset.state = state;
}

function updateLanguages() {
  const source = languages[sourceLanguage.value];
  const target = languages[targetLanguage.value];
  sourceFlag.className = `language-flag flag-${source.flag}`;
  sourceCardFlag.className = `language-flag flag-${source.flag}`;
  targetFlag.className = `language-flag flag-${target.flag}`;
  targetCardFlag.className = `language-flag flag-${target.flag}`;
  sourceLabel.textContent = source.label;
  targetLabel.textContent = target.label;
  sourceText.lang = source.speech;
  output.lang = target.speech;
  output.dir = targetLanguage.value === "ar" ? "rtl" : "auto";
}

function updateCharacterCount() {
  characterCount.textContent = `${sourceText.value.length} / ${MAX_INPUT_LENGTH}`;
}

function splitIntoChunks(text, maxLength) {
  const chunks = [];
  let remaining = text;

  while (remaining.length > maxLength) {
    let splitAt = Math.max(
      remaining.lastIndexOf(" ", maxLength),
      remaining.lastIndexOf("\n", maxLength),
    );
    if (splitAt <= 0) splitAt = maxLength;
    if (
      splitAt < remaining.length &&
      /[\uD800-\uDBFF]/.test(remaining[splitAt - 1]) &&
      /[\uDC00-\uDFFF]/.test(remaining[splitAt])
    ) {
      splitAt -= 1;
    }

    const chunk = remaining.slice(0, splitAt);
    const trailingWhitespace = chunk.match(/\s+$/)?.[0] || "";
    const next = remaining.slice(splitAt);
    const leadingWhitespace = next.match(/^\s+/)?.[0] || "";
    chunks.push({
      text: chunk.slice(0, chunk.length - trailingWhitespace.length),
      separator: trailingWhitespace + leadingWhitespace,
    });
    remaining = next.slice(leadingWhitespace.length);
  }

  if (remaining) chunks.push({ text: remaining, separator: "" });
  return chunks;
}

function showTranslation(text) {
  if (text) {
    output.textContent = text;
  } else {
    const placeholder = document.createElement("span");
    placeholder.className = "placeholder";
    placeholder.textContent = "Your translation will appear here.";
    output.replaceChildren(placeholder);
  }
  output.dir = targetLanguage.value === "ar" ? "rtl" : "auto";
  lastTranslation = text;
  const hasTranslation = text.length > 0;
  speakButton.disabled = !hasTranslation;
  copyButton.disabled = !hasTranslation;
}

async function translate() {
  clearTimeout(autoTranslateTimer);
  autoTranslateTimer = undefined;
  const text = sourceText.value.trim();
  if (!text) {
    setStatus("Type something or use the microphone first.");
    sourceText.focus();
    return;
  }

  const currentRequest = ++requestNumber;
  translateButton.disabled = true;
  translateButton.querySelector("span").textContent = "Translating";
  translateButton.setAttribute("aria-label", "Translating");
  translateButton.title = "Translating";
  showTranslation("");
  const chunks = splitIntoChunks(text, MAX_QUERY_LENGTH);
  const translations = [];

  try {
    for (let index = 0; index < chunks.length; index += 1) {
      if (currentRequest !== requestNumber) return;
      setStatus(
        chunks.length > 1
          ? `Translating part ${index + 1} of ${chunks.length}…`
          : "Translating…",
        "working",
      );
      const requestUrl = new URL("https://api.mymemory.translated.net/get");
      requestUrl.search = new URLSearchParams({
        q: chunks[index].text,
        langpair: `${languages[sourceLanguage.value].translation}|${
          languages[targetLanguage.value].translation
        }`,
      });
      const response = await fetch(requestUrl);
      const result = await response.json();

      if (currentRequest !== requestNumber) return;
      if (result.quotaFinished) {
        throw new Error("The free daily translation limit has been reached. Try again tomorrow.");
      }
      if (!response.ok || result.responseStatus !== 200) {
        throw new Error(
          result.responseDetails ||
            `Translation service returned an error (${result.responseStatus || response.status}).`,
        );
      }
      if (typeof result.responseData?.translatedText !== "string") {
        throw new Error("The translation service returned an invalid response.");
      }
      translations.push(result.responseData.translatedText);
    }

    showTranslation(
      translations.map((translation, index) => translation + chunks[index].separator).join(""),
    );
    setStatus("Translation ready.");
  } catch (error) {
    if (currentRequest !== requestNumber) return;
    setStatus(
      error instanceof TypeError
        ? "Could not reach the translation service. Check your connection and try again."
        : error.message,
      "error",
    );
  } finally {
    if (currentRequest === requestNumber) {
      translateButton.disabled = false;
      translateButton.querySelector("span").textContent = "Translate";
      translateButton.setAttribute("aria-label", "Translate now");
      translateButton.title = "Translate now";
    }
  }
}

function scheduleAutoTranslate() {
  clearTimeout(autoTranslateTimer);
  autoTranslateTimer = undefined;
  requestNumber += 1;
  translateButton.disabled = false;
  translateButton.querySelector("span").textContent = "Translate";
  translateButton.setAttribute("aria-label", "Translate now");
  translateButton.title = "Translate now";

  if (recognition) return;
  if (!sourceText.value.trim()) {
    setStatus("Ready when you are.");
    return;
  }

  showTranslation("");
  setStatus("Translating when you finish typing…", "working");
  autoTranslateTimer = setTimeout(translate, AUTO_TRANSLATE_DELAY);
}

function startListening() {
  if (!SpeechRecognition) {
    setStatus("Voice input is not supported in this browser. You can still type.");
    return;
  }

  if (recognition) {
    recognition.stop();
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = languages[sourceLanguage.value].speech;
  recognition.interimResults = true;
  recognition.continuous = false;
  speechPrefix = sourceText.value.trim();

  recognition.onstart = () => {
    listenButton.classList.add("is-listening");
    listenButton.setAttribute("aria-label", "Stop voice input");
    listenButton.title = "Stop voice input";
    setStatus(
      sourceLanguage.value === "ar"
        ? "Listening for Arabic… speak now."
        : "Listening… speak now.",
      "working",
    );
  };

  recognition.onresult = (event) => {
    const parts = Array.from(event.results, (result) => result[0].transcript);
    const transcript = parts.join("").trim();
    let text = [speechPrefix, transcript].filter(Boolean).join(" ");
    if (text.length > MAX_INPUT_LENGTH) {
      text = text.slice(0, MAX_INPUT_LENGTH);
      if (/[\uD800-\uDBFF]$/.test(text)) text = text.slice(0, -1);
    }
    sourceText.value = text;
    updateCharacterCount();
  };

  recognition.onerror = (event) => {
    if (event.error === "aborted") return;
    const messages = {
      "not-allowed": "Allow microphone access in your browser to use voice input.",
      "language-not-supported": "Voice input is not available for this language in your browser. Try another browser.",
      "no-speech": "No speech detected. Try again when you're ready.",
      "audio-capture": "No microphone was found. Check your microphone connection.",
      "network": "Voice recognition needs an internet connection in this browser.",
    };
    setStatus(messages[event.error] || `Voice input failed: ${event.error}.`, "error");
  };

  recognition.onend = () => {
    const shouldTranslate = sourceText.value.trim().length > speechPrefix.length;
    recognition = undefined;
    listenButton.classList.remove("is-listening");
    listenButton.setAttribute("aria-label", "Start voice input");
    listenButton.title = "Start voice input";
    if (shouldTranslate) {
      translate();
    } else if (statusMessage.dataset.state === "working") {
      setStatus("Ready when you are.");
    }
  };

  try {
    recognition.start();
  } catch (error) {
    recognition = undefined;
    setStatus(`Could not start voice input: ${error.message}`, "error");
  }
}

sourceLanguage.addEventListener("change", () => {
  if (recognition) recognition.stop();
  updateLanguages();
  showTranslation("");
  scheduleAutoTranslate();
});

targetLanguage.addEventListener("change", () => {
  updateLanguages();
  scheduleAutoTranslate();
});

sourceText.addEventListener("input", () => {
  updateCharacterCount();
  scheduleAutoTranslate();
});
translateButton.addEventListener("click", translate);
listenButton.addEventListener("click", startListening);

document.querySelector("#swap-languages").addEventListener("click", () => {
  const previousSource = sourceLanguage.value;
  sourceLanguage.value = targetLanguage.value;
  targetLanguage.value = previousSource;

  const translatedText = lastTranslation;
  if (translatedText) {
    const originalText = sourceText.value;
    sourceText.value = translatedText;
    showTranslation(originalText);
  } else {
    showTranslation("");
  }
  requestNumber += 1;
  translateButton.disabled = false;
  translateButton.querySelector("span").textContent = "Translate";
  translateButton.setAttribute("aria-label", "Translate now");
  translateButton.title = "Translate now";
  updateCharacterCount();
  updateLanguages();
  if (translatedText) {
    setStatus("Languages swapped.");
  } else {
    scheduleAutoTranslate();
  }
});

document.querySelector("#clear-button").addEventListener("click", () => {
  clearTimeout(autoTranslateTimer);
  autoTranslateTimer = undefined;
  if (recognition) recognition.stop();
  requestNumber += 1;
  sourceText.value = "";
  showTranslation("");
  updateCharacterCount();
  translateButton.disabled = false;
  translateButton.querySelector("span").textContent = "Translate";
  translateButton.setAttribute("aria-label", "Translate now");
  translateButton.title = "Translate now";
  setStatus("Ready when you are.");
  sourceText.focus();
});

speakButton.addEventListener("click", () => {
  if (!lastTranslation || !("speechSynthesis" in window)) {
    setStatus("Speech playback is not supported in this browser.");
    return;
  }
  const playbackId = ++speechPlaybackId;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(lastTranslation);
  utterance.lang = languages[targetLanguage.value].speech;
  utterance.onstart = () => {
    if (playbackId !== speechPlaybackId) return;
    speakButton.classList.add("is-speaking");
    setStatus("Speaking translation…", "working");
  };
  utterance.onend = () => {
    if (playbackId !== speechPlaybackId) return;
    speakButton.classList.remove("is-speaking");
    setStatus("Playback finished.");
  };
  utterance.onerror = () => {
    if (playbackId !== speechPlaybackId) return;
    speakButton.classList.remove("is-speaking");
    setStatus("Could not play the translation aloud.", "error");
  };
  window.speechSynthesis.speak(utterance);
});

copyButton.addEventListener("click", async () => {
  if (!lastTranslation) return;
  try {
    await navigator.clipboard.writeText(lastTranslation);
    setStatus("Translation copied.");
  } catch (error) {
    setStatus("Could not copy. Check clipboard permissions in your browser.", "error");
  }
});

if (!SpeechRecognition) {
  listenButton.disabled = true;
  listenButton.title = "Voice input is not supported in this browser";
  listenButton.setAttribute("aria-label", "Voice input is not supported");
}

updateLanguages();
updateCharacterCount();
