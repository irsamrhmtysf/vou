const languages = {
  id: { label: "Bahasa Indonesia", speech: "id-ID" },
  ar: { label: "العربية", speech: "ar-SA" },
  en: { label: "English", speech: "en-US" },
  zh: { label: "中文", speech: "zh-CN" },
  ko: { label: "한국어", speech: "ko-KR" },
  ja: { label: "日本語", speech: "ja-JP" },
};

const sourceLanguage = document.querySelector("#source-language");
const targetLanguage = document.querySelector("#target-language");
const sourceText = document.querySelector("#source-text");
const output = document.querySelector("#translation-output");
const sourceLabel = document.querySelector("#source-label");
const targetLabel = document.querySelector("#target-label");
const characterCount = document.querySelector("#character-count");
const statusMessage = document.querySelector("#status-message");
const translateButton = document.querySelector("#translate-button");
const listenButton = document.querySelector("#listen-button");
const speakButton = document.querySelector("#speak-button");
const copyButton = document.querySelector("#copy-button");
const serverUrl = document.querySelector("#server-url");
const apiKey = document.querySelector("#api-key");
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

let recognition;
let requestNumber = 0;
let speechPrefix = "";
let lastTranslation = "";

function setStatus(message, state = "ready") {
  statusMessage.textContent = message;
  statusMessage.dataset.state = state;
}

function updateLanguages() {
  const source = languages[sourceLanguage.value];
  const target = languages[targetLanguage.value];
  sourceLabel.textContent = source.label;
  targetLabel.textContent = target.label;
  sourceText.lang = source.speech;
  output.lang = target.speech;
  output.dir = targetLanguage.value === "ar" ? "rtl" : "auto";
}

function updateCharacterCount() {
  characterCount.textContent = `${sourceText.value.length} / 5000`;
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

function getTranslateUrl() {
  const base = serverUrl.value.trim().replace(/\/+$/, "");
  if (!base) {
    throw new Error("Enter a LibreTranslate server URL in translation settings.");
  }

  const url = new URL(base);
  const isLocalhost = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLocalhost)) {
    throw new Error("Use an HTTPS server URL, or HTTP on localhost.");
  }

  return `${base.endsWith("/translate") ? base : `${base}/translate`}`;
}

async function translate() {
  const text = sourceText.value.trim();
  if (!text) {
    setStatus("Type something or use the microphone first.");
    sourceText.focus();
    return;
  }

  const currentRequest = ++requestNumber;
  translateButton.disabled = true;
  translateButton.querySelector("span").textContent = "Translating";
  showTranslation("");
  setStatus("Translating…", "working");

  try {
    const requestUrl = getTranslateUrl();
    const payload = {
      q: text,
      source: sourceLanguage.value,
      target: targetLanguage.value,
      format: "text",
    };
    if (apiKey.value.trim()) {
      payload.api_key = apiKey.value.trim();
    }

    const response = await fetch(requestUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();

    if (!response.ok || typeof result.translatedText !== "string") {
      throw new Error(
        result.error || `Translation server returned an error (${response.status}).`,
      );
    }
    if (currentRequest !== requestNumber) return;

    showTranslation(result.translatedText);
    setStatus("Translation ready.");
  } catch (error) {
    if (currentRequest !== requestNumber) return;
    setStatus(error.message || "Could not reach the translation server.", "error");
  } finally {
    if (currentRequest === requestNumber) {
      translateButton.disabled = false;
      translateButton.querySelector("span").textContent = "Translate";
    }
  }
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
    setStatus("Listening… speak now.", "working");
  };

  recognition.onresult = (event) => {
    const parts = Array.from(event.results, (result) => result[0].transcript);
    const transcript = parts.join("").trim();
    sourceText.value = [speechPrefix, transcript].filter(Boolean).join(" ");
    updateCharacterCount();
  };

  recognition.onerror = (event) => {
    if (event.error === "aborted") return;
    const messages = {
      "not-allowed": "Allow microphone access in your browser to use voice input.",
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
  requestNumber += 1;
  translateButton.disabled = false;
  translateButton.querySelector("span").textContent = "Translate";
  updateLanguages();
  showTranslation("");
  setStatus("Ready when you are.");
});

targetLanguage.addEventListener("change", () => {
  requestNumber += 1;
  translateButton.disabled = false;
  translateButton.querySelector("span").textContent = "Translate";
  updateLanguages();
  if (lastTranslation) showTranslation("");
  setStatus("Ready when you are.");
});

sourceText.addEventListener("input", () => {
  updateCharacterCount();
  if (lastTranslation) showTranslation("");
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
  updateCharacterCount();
  updateLanguages();
  setStatus("Languages swapped.");
});

document.querySelector("#clear-button").addEventListener("click", () => {
  if (recognition) recognition.stop();
  requestNumber += 1;
  sourceText.value = "";
  showTranslation("");
  updateCharacterCount();
  translateButton.disabled = false;
  translateButton.querySelector("span").textContent = "Translate";
  setStatus("Ready when you are.");
  sourceText.focus();
});

speakButton.addEventListener("click", () => {
  if (!lastTranslation || !("speechSynthesis" in window)) {
    setStatus("Speech playback is not supported in this browser.");
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(lastTranslation);
  utterance.lang = languages[targetLanguage.value].speech;
  utterance.onerror = () => setStatus("Could not play the translation aloud.", "error");
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
