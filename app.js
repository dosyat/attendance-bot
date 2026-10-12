/* ============================================================
   ⚙️ CONFIG — កែតម្លៃទាំងនេះតាមការិយាល័យរបស់អ្នក
   ============================================================ */
const CONFIG = {
  OFFICE_LAT: 11.5564,          // ទីតាំងការិយាល័យ Latitude
  OFFICE_LNG: 104.9282,         // ទីតាំងការិយាល័យ Longitude
  ALLOWED_RADIUS_M: 200,        // កាំអនុញ្ញាត (ម៉ែត្រ)
  CHECKIN_DEADLINE: "08:30",    // ម៉ោងកំណត់ Check In
  CHECKOUT_START: "17:00",      // ម៉ោងចាប់ផ្តើម Check Out
  STORAGE_KEY: "attendance_records_v1"
};

const $ = (id) => document.getElementById(id);
const el = {
  avatar:      $("avatar"),
  userName:    $("userName"),
  userId:      $("userId"),
  liveClock:   $("liveClock"),
  statusCard:  $("statusCard"),
  statusValue: $("statusValue"),
  statusTime:  $("statusTime"),
  gpsStatus:   $("gpsStatus"),
  gpsCoords:   $("gpsCoords"),
  gpsDistance: $("gpsDistance"),
  btnCheckIn:  $("btnCheckIn"),
  btnCheckOut: $("btnCheckOut"),
  historyList: $("historyList"),
  toast:       $("toast"),
  loader:      $("loader"),
  loaderText:  $("loaderText"),
};

let state = {
  user: null,
  location: null,
  distance: null,
  records: [],
};

/* ---------- 1. Telegram Init ---------- */
function initTelegram() {
  const tg = window.Telegram?.WebApp;
  if (!tg) {
    state.user = { id: "demo", name: "អ្នកប្រើ Demo" };
    renderUser();
    return;
  }
  tg.ready();
  tg.expand();
  tg.setHeaderColor?.("#0f172a");
  tg.setBackgroundColor?.("#0f172a");

  const u = tg.initDataUnsafe?.user;
  state.user = u
    ? { id: u.id, name: [u.first_name, u.last_name].filter(Boolean).join(" ") || "គ្មានឈ្មោះ" }
    : { id: "unknown", name: "មិនស្គាល់" };
  renderUser();
}

function renderUser() {
  el.userName.textContent = state.user.name;
  el.userId.textContent = "ID: " + state.user.id;
  el.avatar.textContent = state.user.name.charAt(0).toUpperCase();
}

/* ---------- 2. Live Clock ---------- */
function startClock() {
  const tick = () => {
    el.liveClock.textContent = new Date().toLocaleTimeString("en-GB");
  };
  tick();
  setInterval(tick, 1000);
}

/* ---------- 3. GPS ---------- */
function getLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("មិនស្គាល់ GPS"));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ---------- 4. Time Helpers ---------- */
const pad = (n) => String(n).padStart(2, "0");
const nowTimeStr = () => {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};
const nowHM = () => {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
};
const hmToMinutes = (hm) => {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
};

/* ---------- 5. Storage ---------- */
function loadRecords() {
  const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
  if (!raw) return [];
  try {
    const all = JSON.parse(raw);
    return all.filter(r => r.userId === state.user.id && r.date === todayKey());
  } catch { return []; }
}

function saveRecord(record) {
  const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
  const all = raw ? JSON.parse(raw) : [];
  all.push(record);
  localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(all));
  state.records = loadRecords();
  renderHistory();
}

/* ---------- 6. UI ---------- */
function toast(msg, type = "info", duration = 2600) {
  el.toast.textContent = msg;
  el.toast.className = "toast show " + type;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.toast.className = "toast " + type; }, duration);
}

function showLoader(text = "កំពុងផ្ទុក...") {
  el.loaderText.textContent = text;
  el.loader.classList.remove("hidden");
}
function hideLoader() { el.loader.classList.add("hidden"); }

function setGpsUI(type, text) {
  el.gpsStatus.className = type;
  el.gpsStatus.textContent = text;
}

function renderStatus() {
  const last = state.records[state.records.length - 1];
  if (!last) {
    el.statusValue.textContent = "មិនទាន់ Check In";
    el.statusTime.textContent = "-";
    el.statusCard.className = "status-card";
  } else if (last.type === "in") {
    el.statusValue.textContent = "បាន Check In ✅";
    el.statusTime.textContent = "ម៉ោង: " + last.time;
    el.statusCard.className = "status-card in";
  } else {
    el.statusValue.textContent = "បាន Check Out 🚪";
    el.statusTime.textContent = "ម៉ោង: " + last.time;
    el.statusCard.className = "status-card out";
  }
}

function renderHistory() {
  if (state.records.length === 0) {
    el.historyList.innerHTML = '<li class="empty">មិនមានទិន្នន័យ</li>';
    return;
  }
  el.historyList.innerHTML = state.records.slice().reverse().map(r => {
    const cls = r.type === "in" ? "in" : "out";
    const txt = r.type === "in" ? "ចូល" : "ចេញ";
    return `<li>
      <div><span class="tag ${cls}">${txt}</span>
      <span style="margin-left:8px;">${r.time}</span></div>
      <small style="color:#94a3b8;">${Math.round(r.distance)}m</small>
    </li>`;
  }).join("");
}

function updateButtons() {
  const last = state.records[state.records.length - 1];
  const hasLoc = !!state.location;
  const inRange = state.distance !== null && state.distance <= CONFIG.ALLOWED_RADIUS_M;

  el.btnCheckIn.disabled = !(hasLoc && inRange && (!last || last.type === "out"));
  el.btnCheckOut.disabled = !(hasLoc && inRange && last && last.type === "in");
}

/* ---------- 7. Actions ---------- */
function doCheckIn() {
  const cur = hmToMinutes(nowHM());
  const deadline = hmToMinutes(CONFIG.CHECKIN_DEADLINE);

  const record = {
    userId: state.user.id,
    userName: state.user.name,
    date: todayKey(),
    type: "in",
    time: nowTimeStr(),
    lat: state.location.lat,
    lng: state.location.lng,
    distance: state.distance,
    late: cur > deadline,
  };
  saveRecord(record);
  renderStatus();
  updateButtons();
  toast(record.late ? "⚠️ Check In ជោគជ័យ (មកយឺត)" : "✅ Check In ជោគជ័យ",
        record.late ? "info" : "success");
}

function doCheckOut() {
  const record = {
    userId: state.user.id,
    userName: state.user.name,
    date: todayKey(),
    type: "out",
    time: nowTimeStr(),
    lat: state.location.lat,
    lng: state.location.lng,
    distance: state.distance,
  };
  saveRecord(record);
  renderStatus();
  updateButtons();
  toast("🚪 Check Out ជោគជ័យ", "success");
}

/* ---------- 8. Location Refresh ---------- */
async function refreshLocation() {
  showLoader("កំពុងទាញយកទីតាំង GPS...");
  setGpsUI("load", "កំពុងរក...");
  try {
    const loc = await getLocation();
    state.location = loc;
    const dist = haversine(loc.lat, loc.lng, CONFIG.OFFICE_LAT, CONFIG.OFFICE_LNG);
    state.distance = dist;

    el.gpsCoords.textContent = `Lat: ${loc.lat.toFixed(5)}, Lng: ${loc.lng.toFixed(5)}`;
    el.gpsDistance.textContent = `ចម្ងាយពីការិយាល័យ: ${Math.round(dist)} ម៉ែត្រ`;

    if (dist <= CONFIG.ALLOWED_RADIUS_M) {
      setGpsUI("ok", `✅ ក្នុងរង្វង់អនុញ្ញាត (${Math.round(dist)}m)`);
    } else {
      setGpsUI("err", `❌ ឆ្ងាយពីការិយាល័យ (${Math.round(dist)}m)`);
    }
  } catch (err) {
    state.location = null;
    state.distance = null;
    setGpsUI("err", "❌ មិនអាចទាញ GPS បាន");
    el.gpsCoords.textContent = "សូមបើក Location Permission";
    el.gpsDistance.textContent = "-";
    toast("សូមអនុញ្ញាត Location", "error", 3200);
  } finally {
    hideLoader();
    updateButtons();
  }
}

/* ---------- 9. Init ---------- */
function init() {
  initTelegram();
  startClock();
  state.records = loadRecords();
  renderStatus();
  renderHistory();

  el.btnCheckIn.addEventListener("click", doCheckIn);
  el.btnCheckOut.addEventListener("click", doCheckOut);
  document.querySelector(".gps-card").addEventListener("click", refreshLocation);

  refreshLocation();
  setInterval(refreshLocation, 60000);
  setInterval(updateButtons, 30000);
}

document.addEventListener("DOMContentLoaded", init);