// countdown.js
const $ = (id) => document.getElementById(id);

const el = {
  d: $("d"),
  h: $("h"),
  m: $("m"),
  s: $("s"),
  titleText: $("titleText"),
  endTime: $("endTime"),
  btnStart: $("btnStart"),
  btnPause: $("btnPause"),
  btnReset: $("btnReset"),
  statusPill: $("statusPill"),
  targetText: $("targetText"),
  remainText: $("remainText"),
  barFill: $("barFill"),
  toast: $("toast"),

  // Modal
  resumeModal: $("resumeModal"),
  resumeText: $("resumeText"),
  resumeOk: $("resumeOk"),
  resumeCancel: $("resumeCancel"),
};

const REDIRECT_URL = "./happly.html";
const NEXT_DELAY_MS = 24 * 60 * 60 * 1000;

// 保存上次设置
const LS_END_TIME = "ying_alarm_endTime";

let timer = null;
let targetMs = null;
let startMs = null;
let paused = false;

// 防重复跳转（本页生命周期内）
let redirectedOnceForThisTarget = false;
let redirectedTargetMs = null;

function pad2(n) {
  return String(n).padStart(2, "0");
}

function showToast(msg) {
  el.toast.textContent = msg;
  el.toast.classList.add("show");
  setTimeout(() => el.toast.classList.remove("show"), 1600);
}

function formatLocal(ms) {
  const d = new Date(ms);
  const y = d.getFullYear();
  const mo = pad2(d.getMonth() + 1);
  const da = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const mm = pad2(d.getMinutes());
  const ss = pad2(d.getSeconds());
  return `${y}-${mo}-${da} ${hh}:${mm}:${ss}`;
}

function setStatus(text) {
  el.statusPill.textContent = text;
}

function setDefaultEndTimeToToday18() {
  const now = new Date();
  const y = now.getFullYear();
  const mo = pad2(now.getMonth() + 1);
  const da = pad2(now.getDate());
  el.endTime.value = `${y}-${mo}-${da}T18:00:00`;
}

// 保存 input 到 localStorage
function persistEndTime() {
  const v = (el.endTime.value || "").trim();
  if (v) localStorage.setItem(LS_END_TIME, v);
}

// ===== Modal =====
function showResumeModal(targetMsToShow) {
  el.resumeText.textContent = `检测到你上次设置的结束时间为：${formatLocal(targetMsToShow)}。是否继续开始？`;
  el.resumeModal.classList.add("show");
  el.resumeModal.setAttribute("aria-hidden", "false");
}

function hideResumeModal() {
  el.resumeModal.classList.remove("show");
  el.resumeModal.setAttribute("aria-hidden", "true");
}

// 点击遮罩关闭（可选）
el.resumeModal.addEventListener("click", (e) => {
  if (e.target === el.resumeModal) {
    hideResumeModal();
    showToast("已保留时间，未开始倒计时");
  }
});

// Esc 关闭（可选）
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && el.resumeModal.classList.contains("show")) {
    hideResumeModal();
    showToast("已保留时间，未开始倒计时");
  }
});

// Modal 按钮
el.resumeOk.addEventListener("click", () => {
  hideResumeModal();
  startTimer();
});

el.resumeCancel.addEventListener("click", () => {
  hideResumeModal();
  showToast("已保留时间，未开始倒计时");
});

function render(diff) {
  const totalSec = Math.max(0, Math.floor(diff / 1000));
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor(totalSec / 3600) % 24;
  const minutes = Math.floor(totalSec / 60) % 60;
  const seconds = totalSec % 60;

  el.d.textContent = String(days);
  el.h.textContent = pad2(hours);
  el.m.textContent = pad2(minutes);
  el.s.textContent = pad2(seconds);

  const time = `${days}天 ${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
  const title = el.titleText.value?.replace('{{time}}', time) || "剩余"+time;
  document.title = title;

  el.remainText.textContent =
    diff <= 0
      ? "剩余：0 秒"
      : `剩余：${days}天 ${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;

  el.targetText.textContent = targetMs
    ? `目标时间：${formatLocal(targetMs)}`
    : "目标时间：未设置";

  if (startMs && targetMs && targetMs > startMs) {
    const p = Math.min(100, Math.max(0, ((Date.now() - startMs) / (targetMs - startMs)) * 100));
    el.barFill.style.width = p.toFixed(2) + "%";
  } else {
    el.barFill.style.width = "0%";
  }
}

function stopTimer() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function tick() {
  if (!targetMs) return;

  const diff = targetMs - Date.now();
  render(diff);

  if (diff <= 0) {
    stopTimer();
    setStatus("已结束");
    render(0);

    // 同一 target 只跳一次（本页生命周期）
    if (redirectedOnceForThisTarget && redirectedTargetMs === targetMs) {
      showToast("已结束（不再重复跳转）");
      return;
    }
    redirectedOnceForThisTarget = true;
    redirectedTargetMs = targetMs;

    // 结束时间 +10 秒，并保存，刷新还能继续
    const nextTargetMs = targetMs + NEXT_DELAY_MS;
    const nd = new Date(nextTargetMs);
    const y = nd.getFullYear();
    const mo = pad2(nd.getMonth() + 1);
    const da = pad2(nd.getDate());
    const hh = pad2(nd.getHours());
    const mm = pad2(nd.getMinutes());
    const ss = pad2(nd.getSeconds());
    const nextValue = `${y}-${mo}-${da}T${hh}:${mm}:${ss}`;

    el.endTime.value = nextValue;
    localStorage.setItem(LS_END_TIME, nextValue);

    showToast("倒计时结束，正在跳转…");
    window.open(REDIRECT_URL);
  }
}

function startTimer() {
  const v = (el.endTime.value || "").trim();
  if (!v) {
    showToast("请先选择结束时间");
    return;
  }

  const ms = new Date(v).getTime();
  if (Number.isNaN(ms)) {
    showToast("时间格式无效");
    return;
  }

  // 开始时也保存一次
  localStorage.setItem(LS_END_TIME, v);

  targetMs = ms;
  startMs = Date.now();
  paused = false;
  setStatus("进行中");

  // 切换目标允许再跳一次
  redirectedOnceForThisTarget = false;
  redirectedTargetMs = null;

  stopTimer();
  tick();
  timer = setInterval(tick, 250);
  showToast("已开始/已更新");
}

function togglePause() {
  if (!targetMs) return;

  if (!paused) {
    paused = true;
    setStatus("已暂停");
    stopTimer();
    showToast("已暂停");
  } else {
    paused = false;
    setStatus("进行中");
    tick();
    timer = setInterval(tick, 250);
    showToast("继续运行");
  }
}

function resetToDefault() {
  stopTimer();
  targetMs = null;
  startMs = null;
  paused = false;

  setDefaultEndTimeToToday18();
  persistEndTime();

  setStatus("未开始");
  render(0);
  showToast("已重置为今天 18:00");
}

// ===== 事件绑定 =====
el.btnStart.addEventListener("click", startTimer);
el.btnPause.addEventListener("click", togglePause);
el.btnReset.addEventListener("click", resetToDefault);
el.endTime.addEventListener("keydown", (e) => e.key === "Enter" && startTimer());

// 用户改时间时立刻保存（刷新可恢复）
el.endTime.addEventListener("change", persistEndTime);
el.endTime.addEventListener("input", persistEndTime);

// ===== 初始化 =====
(function init() {
  const saved = localStorage.getItem(LS_END_TIME);

  if (saved) {
    el.endTime.value = saved;
    setStatus("未开始");
    render(0);

    const ms = new Date(saved).getTime();
    if (!Number.isNaN(ms)) showResumeModal(ms);
  } else {
    setDefaultEndTimeToToday18();
    persistEndTime();
    setStatus("未开始");
    render(0);
  }
})();