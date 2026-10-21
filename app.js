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
const pronunciationOutput = document.querySelector("#pronunciation-output");
const sourceFlag = document.querySelector("#source-flag");
const targetFlag = document.querySelector("#target-flag");
const sourceLanguageButton = document.querySelector("#source-language-button");
const targetLanguageButton = document.querySelector("#target-language-button");
const sourceLanguageValue = document.querySelector("#source-language-value");
const targetLanguageValue = document.querySelector("#target-language-value");
const sourceLanguageOptions = document.querySelector("#source-language-options");
const targetLanguageOptions = document.querySelector("#target-language-options");
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
  targetFlag.className = `language-flag flag-${target.flag}`;
  sourceLanguageValue.textContent = source.label;
  targetLanguageValue.textContent = target.label;
  updateLanguageOptions(sourceLanguage, sourceLanguageOptions);
  updateLanguageOptions(targetLanguage, targetLanguageOptions);
  sourceText.lang = source.speech;
  output.lang = target.speech;
  output.dir = targetLanguage.value === "ar" ? "rtl" : "auto";
}

function updateLanguageOptions(select, listbox) {
  for (const option of listbox.children) {
    option.setAttribute("aria-selected", String(option.dataset.value === select.value));
  }
}

function populateLanguageOptions(select, listbox) {
  for (const option of select.options) {
    const item = document.createElement("div");
    item.className = "language-option";
    item.setAttribute("role", "option");
    item.setAttribute("tabindex", "-1");
    item.dataset.value = option.value;

    const flag = document.createElement("span");
    flag.className = `language-flag flag-${languages[option.value].flag}`;
    flag.setAttribute("aria-hidden", "true");
    item.append(flag, document.createTextNode(option.textContent));
    listbox.append(item);
  }
}

function closeLanguagePicker(button, listbox) {
  button.setAttribute("aria-expanded", "false");
  listbox.hidden = true;
}

function openLanguagePicker(button, listbox, focusSelected = false) {
  button.setAttribute("aria-expanded", "true");
  listbox.hidden = false;
  if (focusSelected) {
    listbox.querySelector('[aria-selected="true"]')?.focus();
  }
}

function setupLanguagePicker(select, button, listbox) {
  populateLanguageOptions(select, listbox);

  button.addEventListener("click", () => {
    if (listbox.hidden) {
      openLanguagePicker(button, listbox, true);
    } else {
      closeLanguagePicker(button, listbox);
    }
  });

  button.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      openLanguagePicker(button, listbox, true);
    }
  });

  listbox.addEventListener("click", (event) => {
    const item = event.target.closest(".language-option");
    if (!item) return;
    select.value = item.dataset.value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    closeLanguagePicker(button, listbox);
    button.focus();
  });

  listbox.addEventListener("keydown", (event) => {
    const items = Array.from(listbox.children);
    const index = items.indexOf(document.activeElement);
    let nextIndex;
    if (event.key === "ArrowDown") nextIndex = (index + 1) % items.length;
    if (event.key === "ArrowUp") nextIndex = (index - 1 + items.length) % items.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = items.length - 1;

    if (nextIndex !== undefined) {
      event.preventDefault();
      items[nextIndex].focus();
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      document.activeElement.click();
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeLanguagePicker(button, listbox);
      button.focus();
    }
  });
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
    pronunciationOutput.hidden = true;
    pronunciationOutput.replaceChildren();
  }
  output.dir = targetLanguage.value === "ar" ? "rtl" : "auto";
  lastTranslation = text;
  const hasTranslation = text.length > 0;
  speakButton.disabled = !hasTranslation;
  copyButton.disabled = !hasTranslation;
}

async function showPronunciation(text, currentRequest) {
  if (!text.trim() || !["ar", "zh", "ko", "ja"].includes(targetLanguage.value)) {
    pronunciationOutput.hidden = true;
    pronunciationOutput.replaceChildren();
    return;
  }

  pronunciationOutput.hidden = false;
  pronunciationOutput.textContent = "Loading pronunciation…";
  const chunks = splitIntoChunks(text, MAX_QUERY_LENGTH);
  const pronunciations = [];

  try {
    for (const chunk of chunks) {
      const url = new URL("https://translate.googleapis.com/translate_a/single");
      url.search = new URLSearchParams({
        client: "gtx",
        sl: languages[targetLanguage.value].translation,
        tl: "en",
        dt: "rm",
        q: chunk.text,
      });
      const response = await fetch(url);
      if (!response.ok) throw new Error("Pronunciation service unavailable");
      const result = await response.json();
      const pronunciation = result[0]
        .filter((segment) => Array.isArray(segment) && typeof segment[3] === "string")
        .map((segment) => segment[3])
        .join("");
      if (!pronunciation) throw new Error("Pronunciation unavailable");
      pronunciations.push(pronunciation + chunk.separator);
    }

    if (currentRequest !== requestNumber) return;
    const label = document.createElement("span");
    label.className = "pronunciation-label";
    label.textContent = "Pronunciation";
    pronunciationOutput.replaceChildren(
      label,
      document.createTextNode(pronunciations.join("")),
    );
  } catch {
    if (currentRequest !== requestNumber) return;
    pronunciationOutput.textContent = "Pronunciation unavailable right now.";
  }
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

    const translatedText = translations
      .map((translation, index) => translation + chunks[index].separator)
      .join("");
    showTranslation(translatedText);
    setStatus("Translation ready.");
    showPronunciation(translatedText, currentRequest);
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

setupLanguagePicker(sourceLanguage, sourceLanguageButton, sourceLanguageOptions);
setupLanguagePicker(targetLanguage, targetLanguageButton, targetLanguageOptions);

document.addEventListener("click", (event) => {
  if (!sourceLanguageButton.parentElement.contains(event.target)) {
    closeLanguagePicker(sourceLanguageButton, sourceLanguageOptions);
  }
  if (!targetLanguageButton.parentElement.contains(event.target)) {
    closeLanguagePicker(targetLanguageButton, targetLanguageOptions);
  }
});

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
  const originalText = sourceText.value;
  if (translatedText) {
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
    showPronunciation(originalText, requestNumber);
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
