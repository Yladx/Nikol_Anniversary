const DATA = {
  welcome: "data/welcome.json",
  journey: "data/journey.json",
  months: "data/months.json",
  final: "data/final.json",
};

const INTRO_MIN_MS = 4200;
const INTRO_MAX_MS = 15000;
const WORDS_PER_MINUTE = 195;

const stage = document.getElementById("stage");
const stageWrap = document.getElementById("stageWrap");
const introLayer = document.getElementById("introLayer");
const introStage = document.getElementById("introStage");
const introTimerBar = document.getElementById("introTimerBar");
const navControls = document.getElementById("navControls");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const dotsEl = document.getElementById("dots");
const progressLabel = document.getElementById("progressLabel");
const loadError = document.getElementById("loadError");
const musicToggle = document.getElementById("musicToggle");
const bgMusic = document.getElementById("bgMusic");

const finalLayer = document.getElementById("finalLayer");
const finalStage = document.getElementById("finalStage");
const finalPrevBtn = document.getElementById("finalPrevBtn");
const finalNextBtn = document.getElementById("finalNextBtn");
const finalPageLabel = document.getElementById("finalPageLabel");
const finalMeasure = document.getElementById("finalMeasure");
const epilogueLayer = document.getElementById("epilogueLayer");
const epilogueStage = document.getElementById("epilogueStage");
const restartBtn = document.getElementById("restartBtn");
const confettiContainer = document.getElementById("confettiContainer");

let slides = [];
let currentIndex = 0;
let isTransitioning = false;
let introRunning = false;
let inFinal = false;
let inEpilogue = false;

let finalData = null;
let finalPages = [];
let finalPageIndex = 0;

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${url} (${res.status})`);
  return res.json();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setBodyPhase(phase) {
  document.body.classList.remove("phase-intro", "phase-months", "phase-final", "phase-epilogue");
  document.body.classList.add(phase);
}

function estimateReadMs(...parts) {
  const text = parts.filter(Boolean).join(" ");
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const fromReading = (words / WORDS_PER_MINUTE) * 60 * 1000;
  const withAnimations = fromReading + 2400;
  return Math.round(Math.min(Math.max(withAnimations, INTRO_MIN_MS), INTRO_MAX_MS));
}

function buildIntroScreens(welcome, journey) {
  return [
    {
      duration: estimateReadMs(welcome.greeting, welcome.names, welcome.message),
      html: `
        <article class="intro-card">
          <p class="month-badge reveal reveal--1">${escapeHtml(welcome.greeting)}</p>
          <h1 class="display-title reveal reveal--2">${escapeHtml(welcome.names)}</h1>
          <p class="body-text body-text--center reveal reveal--3">${escapeHtml(welcome.message)}</p>
        </article>
      `,
    },
    {
      duration: estimateReadMs(journey.title, journey.subtitle, journey.message),
      html: `
        <article class="intro-card">
          <h2 class="display-title reveal reveal--1">${escapeHtml(journey.title)}</h2>
          <p class="display-sub reveal reveal--2">${escapeHtml(journey.subtitle)}</p>
          <p class="body-text body-text--center reveal reveal--3">${escapeHtml(journey.message)}</p>
        </article>
      `,
    },
  ];
}

function isVideoSrc(src) {
  return /\.(mp4|webm|mov|m4v|ogg)(\?.*)?$/i.test(String(src || ""));
}

function monthMediaHtml(month) {
  const src = month.video || month.image || "";
  const label = escapeHtml(month.label);

  if (isVideoSrc(src)) {
    return `
      <video
        class="polaroid-media polaroid-video"
        src="${escapeHtml(src)}"
        autoplay
        muted
        loop
        playsinline
        webkit-playsinline
        disablepictureinpicture
        disableremoteplayback
        preload="auto"
        aria-label="${label}"
      ></video>
    `;
  }

  return `<img class="polaroid-media" src="${escapeHtml(src)}" alt="${label}" loading="lazy" decoding="async" />`;
}

function playActiveSlideVideo(root = stage) {
  if (!root) return;

  root.querySelectorAll("video").forEach((video) => {
    const onActiveSlide = video.closest(".slide")?.classList.contains("is-active");
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");

    if (onActiveSlide) {
      video.currentTime = 0;
      const playPromise = video.play();
      if (playPromise && playPromise.catch) playPromise.catch(() => {});
    } else {
      video.pause();
    }
  });
}

function buildMonthSlides(monthsData) {
  return monthsData.months.map((month, i) => ({
    type: "month",
    label: month.label,
    html: `
      <article class="scrap-card scrap-card--photo">
        <figure class="polaroid reveal reveal--1">
          ${monthMediaHtml(month)}
        </figure>
        <div>
          <p class="month-badge reveal reveal--2">${escapeHtml(month.label)}</p>
          <p class="body-text reveal reveal--3">${escapeHtml(month.message)}</p>
        </div>
      </article>
    `,
    index: i + 1,
    totalMonths: monthsData.months.length,
  }));
}

function resetRevealAnimations(root) {
  root.querySelectorAll(".reveal").forEach((el) => {
    el.style.animation = "none";
    void el.offsetHeight;
    el.style.animation = "";
  });
}

function runIntroTimer(durationMs) {
  introTimerBar.style.transition = "none";
  introTimerBar.style.width = "0%";
  void introTimerBar.offsetWidth;
  introTimerBar.style.transition = `width ${durationMs}ms linear`;
  introTimerBar.style.width = "100%";
}

function showIntroScreen(html, durationMs) {
  return new Promise((resolve) => {
    introStage.innerHTML = `<div class="intro-slide is-active">${html}</div>`;
    resetRevealAnimations(introStage);
    runIntroTimer(durationMs);
    window.setTimeout(resolve, durationMs);
  });
}

async function runIntroSequence(introScreens) {
  introRunning = true;
  setBodyPhase("phase-intro");
  stageWrap.classList.add("is-hidden");
  navControls.classList.add("is-hidden");
  progressLabel.textContent = "Opening…";

  for (const screen of introScreens) {
    await showIntroScreen(screen.html, screen.duration);
  }

  introLayer.classList.add("is-done");
  introRunning = false;
  setBodyPhase("phase-months");
  stageWrap.classList.remove("is-hidden");
  navControls.classList.remove("is-hidden");
  keepMusicGoing();
  updateProgress();
}

function renderSlideElements() {
  stage.innerHTML = slides
    .map(
      (_, i) =>
        `<div class="slide${i === 0 ? " is-active" : ""}" data-index="${i}" aria-hidden="${i === 0 ? "false" : "true"}"></div>`
    )
    .join("");

  slides.forEach((slide, i) => {
    stage.querySelector(`.slide[data-index="${i}"]`).innerHTML = slide.html;
  });

  dotsEl.innerHTML = slides
    .map(
      (_, i) =>
        `<button type="button" class="dot" role="tab" aria-selected="${i === 0 ? "true" : "false"}" aria-label="${escapeHtml(slides[i].label)}" data-goto="${i}"></button>`
    )
    .join("");
}

function updateProgress() {
  if (!slides.length || introRunning || inFinal || inEpilogue) return;

  const slide = slides[currentIndex];
  progressLabel.textContent = `${slide.label} · ${slide.index} of ${slide.totalMonths}`;

  prevBtn.disabled = currentIndex === 0 || isTransitioning;
  nextBtn.disabled = isTransitioning;

  const onLastMonth = currentIndex === slides.length - 1;
  nextBtn.innerHTML = onLastMonth
    ? 'Letter <span aria-hidden="true">→</span>'
    : 'Next <span aria-hidden="true">→</span>';

  dotsEl.querySelectorAll(".dot").forEach((dot, i) => {
    dot.setAttribute("aria-selected", i === currentIndex ? "true" : "false");
  });
}

function goTo(index) {
  if (introRunning || inFinal || inEpilogue || isTransitioning || index === currentIndex || index < 0 || index >= slides.length) {
    return;
  }

  isTransitioning = true;
  const outgoing = stage.querySelector(".slide.is-active");
  const incoming = stage.querySelector(`.slide[data-index="${index}"]`);

  outgoing.classList.add("is-leaving");
  outgoing.classList.remove("is-active");
  outgoing.setAttribute("aria-hidden", "true");

  incoming.classList.add("is-active");
  incoming.setAttribute("aria-hidden", "false");
  resetRevealAnimations(incoming);
  playActiveSlideVideo();

  window.setTimeout(() => {
    outgoing.classList.remove("is-leaving");
    isTransitioning = false;
    currentIndex = index;
    updateProgress();
    playActiveSlideVideo();
  }, 780);
}

function goNext() {
  if (introRunning || inFinal || inEpilogue) return;
  if (currentIndex === slides.length - 1) {
    openFinal();
    return;
  }
  goTo(currentIndex + 1);
}

function goPrev() {
  if (introRunning || inFinal || inEpilogue) return;
  goTo(currentIndex - 1);
}

function splitIntoSentences(text) {
  const parts = String(text).match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g);
  return parts && parts.length ? parts.map((s) => s.trim()).filter(Boolean) : [text];
}

function letterParagraphs(text) {
  const sentences = splitIntoSentences(text);
  if (sentences.length <= 2) return [sentences.join(" ")];

  const paras = [];
  for (let i = 0; i < sentences.length; i += 2) {
    paras.push(sentences.slice(i, i + 2).join(" "));
  }
  return paras;
}

function letterBodyHtml(messagePart, reveal) {
  return letterParagraphs(messagePart)
    .map(
      (para, i) =>
        `<p class="letter-body${reveal ? ` reveal reveal--${Math.min(i + 1, 4)}` : ""}">${escapeHtml(para)}</p>`
    )
    .join("");
}

function buildFinalPageHtml(finalMsg, messagePart, pageIndex, totalPages) {
  const isLast = pageIndex === totalPages - 1;

  return `
    <article class="scrap-card scrap-card--final letter-sheet final-paper is-entering">
      <div class="letter-content">
        ${letterBodyHtml(messagePart, true)}
      </div>
      ${
        isLast
          ? `
        <footer class="letter-close reveal reveal--3">
          <p class="final-sign">${escapeHtml(finalMsg.closing)}</p>
          <p class="final-date">${escapeHtml(finalMsg.date)}</p>
        </footer>
      `
          : `<p class="final-continued-hint reveal reveal--3">Turn the page when you're ready…</p>`
      }
    </article>
  `;
}

function measureFinalOverflow(finalMsg, messagePart, { isLast }) {
  const html = `
    <article class="scrap-card scrap-card--final letter-sheet">
      <div class="letter-content">${letterBodyHtml(messagePart, false)}</div>
      ${
        isLast
          ? `
        <footer class="letter-close">
          <p class="final-sign">${escapeHtml(finalMsg.closing)}</p>
          <p class="final-date">${escapeHtml(finalMsg.date)}</p>
        </footer>
      `
          : `<p class="final-continued-hint">Turn the page when you're ready…</p>`
      }
    </article>
  `;
  finalMeasure.innerHTML = html;
  return finalMeasure.scrollHeight > finalMeasure.clientHeight + 2;
}

function composeFinalPages(finalMsg) {
  if (Array.isArray(finalMsg.pages) && finalMsg.pages.length) {
    return finalMsg.pages.map((part) => String(part).trim()).filter(Boolean);
  }

  const sentences = splitIntoSentences(finalMsg.message.trim());
  const parts = [];
  let chunk = "";

  for (const sentence of sentences) {
    const candidate = chunk ? `${chunk} ${sentence}` : sentence;
    const overflows = measureFinalOverflow(finalMsg, candidate, { isLast: false });

    if (overflows && chunk) {
      parts.push(chunk);
      chunk = sentence;
    } else if (overflows && !chunk) {
      parts.push(candidate);
      chunk = "";
    } else {
      chunk = candidate;
    }
  }

  if (chunk) parts.push(chunk);
  return parts.length ? parts : [finalMsg.message];
}

function renderFinalPage(index, direction = 1) {
  const total = finalPages.length;
  const html = buildFinalPageHtml(finalData, finalPages[index], index, total);

  finalStage.innerHTML = `<div class="final-slide" data-direction="${direction}">${html}</div>`;
  resetRevealAnimations(finalStage);

  finalPrevBtn.disabled = index === 0;
  finalNextBtn.disabled = false;
  finalNextBtn.innerHTML =
    index === total - 1 ? "The end" : 'Next page <span aria-hidden="true">→</span>';

  finalPageLabel.textContent = total > 1 ? `Page ${index + 1} of ${total}` : "";
  progressLabel.textContent = "Final letter";
}

function openFinal() {
  if (!finalData) return;

  inFinal = true;
  setBodyPhase("phase-final");
  stageWrap.classList.add("is-hidden");
  navControls.classList.add("is-hidden");
  finalLayer.classList.remove("is-hidden");
  keepMusicGoing();

  finalPages = composeFinalPages(finalData);
  finalPageIndex = 0;
  renderFinalPage(0, 1);
}

function turnFinalPage(nextIndex) {
  const direction = nextIndex > finalPageIndex ? 1 : -1;
  finalPageIndex = nextIndex;
  renderFinalPage(finalPageIndex, direction);
}

function triggerConfetti() {
  confettiContainer.innerHTML = "";
  const colors = ["#ff6b9d", "#ff9ed2", "#ffb3d9", "#ffd6e8", "#ffccd5"];
  const shapes = ["confetti--heart", "confetti--square", "confetti--circle", "confetti--star"];

  for (let i = 0; i < 50; i++) {
    setTimeout(() => {
      const confetti = document.createElement("div");
      const shape = shapes[Math.floor(Math.random() * shapes.length)];
      confetti.className = `confetti ${shape}`;
      confetti.style.left = Math.random() * 100 + "%";
      confetti.style.animationDuration = (Math.random() * 2 + 2) + "s";
      confetti.style.animationDelay = Math.random() * 0.5 + "s";
      confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
      confettiContainer.appendChild(confetti);

      setTimeout(() => {
        confetti.remove();
      }, 4000);
    }, i * 30);
  }
}

function openEpilogue() {
  const epilogue = finalData.epilogue || {
    title: "Happy Anniversary",
    message:
      "Every single day, I am so grateful for the life and the love we are building together.",
  };

  inFinal = false;
  inEpilogue = true;
  setBodyPhase("phase-epilogue");

  finalLayer.classList.add("is-hidden");
  epilogueLayer.classList.remove("is-hidden");
  progressLabel.textContent = epilogue.title;
  keepMusicGoing();

  epilogueStage.innerHTML = `
    <div class="epilogue-plain">
      <p class="epilogue-title reveal reveal--1">${escapeHtml(epilogue.title)}</p>
      <p class="epilogue-message reveal reveal--2">${escapeHtml(epilogue.message)}</p>
    </div>
  `;
  resetRevealAnimations(epilogueStage);

  triggerConfetti();
}

function setupFinalNav() {
  finalPrevBtn.addEventListener("click", () => {
    if (inEpilogue) return;
    if (finalPageIndex > 0) turnFinalPage(finalPageIndex - 1);
  });

  finalNextBtn.addEventListener("click", () => {
    if (inEpilogue) return;
    if (finalPageIndex < finalPages.length - 1) {
      turnFinalPage(finalPageIndex + 1);
      return;
    }
    openEpilogue();
  });

  restartBtn.addEventListener("click", () => {
    window.location.reload();
  });
}

let userPausedMusic = false;

function syncMusicUi() {
  const playing = !bgMusic.paused && !bgMusic.ended;
  musicToggle.setAttribute("aria-pressed", playing ? "true" : "false");
}

function canUnmute() {
  const activation = navigator.userActivation;
  return !activation || activation.isActive || activation.hasBeenActive;
}

async function keepMusicGoing() {
  if (userPausedMusic) {
    syncMusicUi();
    return;
  }

  window.__annivWantMusic = true;
  bgMusic.loop = true;
  bgMusic.autoplay = true;
  bgMusic.volume = 0.08;

  const tryPlay = async (muted) => {
    bgMusic.muted = muted;
    await bgMusic.play();
  };

  try {
    await tryPlay(false);
  } catch {
    try {
      await tryPlay(true);
      bgMusic.muted = false;
      if (bgMusic.paused) {
        await tryPlay(true);
        if (canUnmute()) {
          bgMusic.muted = false;
          await bgMusic.play().catch(() => {});
        }
      }
    } catch {
      /* waiting for the next chance */
    }
  }

  syncMusicUi();
}

function setupMusic() {
  bgMusic.loop = true;
  bgMusic.preload = "auto";
  bgMusic.autoplay = true;
  bgMusic.setAttribute("playsinline", "");
  bgMusic.setAttribute("webkit-playsinline", "true");

  musicToggle.addEventListener("click", async (e) => {
    e.stopPropagation();
    if (!bgMusic.paused && !bgMusic.muted) {
      userPausedMusic = true;
      window.__annivWantMusic = false;
      bgMusic.pause();
      syncMusicUi();
      return;
    }
    userPausedMusic = false;
    window.__annivWantMusic = true;
    bgMusic.muted = false;
    await keepMusicGoing();
  });

  bgMusic.addEventListener("play", syncMusicUi);
  bgMusic.addEventListener("pause", () => {
    syncMusicUi();
    if (!userPausedMusic) {
      window.setTimeout(() => keepMusicGoing(), 80);
    }
  });
  bgMusic.addEventListener("ended", () => {
    if (userPausedMusic) return;
    bgMusic.currentTime = 0;
    keepMusicGoing();
  });
  bgMusic.addEventListener("stalled", () => keepMusicGoing());

  const unlock = () => {
    if (userPausedMusic) return;
    keepMusicGoing();
  };
  document.addEventListener("pointerdown", unlock, { capture: true, passive: true });
  document.addEventListener("touchstart", unlock, { capture: true, passive: true });
  document.addEventListener("keydown", unlock, { capture: true, passive: true });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) keepMusicGoing();
  });
  window.addEventListener("pageshow", () => keepMusicGoing());
  window.addEventListener("focus", () => keepMusicGoing());

  keepMusicGoing();
  [200, 600, 1200, 2500].forEach((ms) => {
    window.setTimeout(() => keepMusicGoing(), ms);
  });
}

function bindEvents() {
  prevBtn.addEventListener("click", goPrev);
  nextBtn.addEventListener("click", goNext);

  dotsEl.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-goto]");
    if (!btn || introRunning || inFinal) return;
    goTo(Number(btn.dataset.goto));
  });

  window.addEventListener("keydown", (e) => {
    if (introRunning) return;

    if (inEpilogue) return;

    if (inFinal) {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        if (finalPageIndex < finalPages.length - 1) turnFinalPage(finalPageIndex + 1);
        else openEpilogue();
      } else if (e.key === "ArrowLeft" && finalPageIndex > 0) {
        e.preventDefault();
        turnFinalPage(finalPageIndex - 1);
      }
      return;
    }

    if (e.key === "ArrowRight" || e.key === "PageDown") {
      e.preventDefault();
      goNext();
    } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
      e.preventDefault();
      goPrev();
    }
  });

  let touchStartX = 0;
  stage.addEventListener(
    "touchstart",
    (e) => {
      touchStartX = e.changedTouches[0].screenX;
    },
    { passive: true }
  );
  stage.addEventListener(
    "touchend",
    (e) => {
      if (introRunning || inFinal) return;
      const dx = e.changedTouches[0].screenX - touchStartX;
      if (Math.abs(dx) < 50) return;
      if (dx < 0) goNext();
      else goPrev();
    },
    { passive: true }
  );
}

async function init() {
  try {
    setupMusic();

    const [welcome, journey, monthsData, finalMsg] = await Promise.all([
      fetchJson(DATA.welcome),
      fetchJson(DATA.journey),
      fetchJson(DATA.months),
      fetchJson(DATA.final),
    ]);

    finalData = finalMsg;
    slides = buildMonthSlides(monthsData);

    await runIntroSequence(buildIntroScreens(welcome, journey));

    renderSlideElements();
    playActiveSlideVideo();
    bindEvents();
    setupFinalNav();
    updateProgress();
  } catch (err) {
    loadError.textContent = err.message;
    loadError.classList.remove("hidden");
    progressLabel.textContent = "Unable to load";
  }
}

init();
