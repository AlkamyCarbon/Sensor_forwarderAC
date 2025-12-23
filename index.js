// -------------------------
// Firebase → Influx Bridge
// -------------------------

const firebase = require("firebase/app");
const { getDatabase, ref, onChildAdded } = require("firebase/database");
const { InfluxDB, Point } = require("@influxdata/influxdb-client");

// ---------- Firebase ----------
const firebaseConfig = {
  apiKey: process.env.FB_API_KEY,
  authDomain: process.env.FB_AUTH_DOMAIN,
  databaseURL: process.env.FB_DATABASE_URL,
  projectId: process.env.FB_PROJECT_ID,
  storageBucket: process.env.FB_STORAGE_BUCKET,
  messagingSenderId: process.env.FB_MESSAGING_SENDER_ID,
  appId: process.env.FB_APP_ID
};

const fbApp = firebase.initializeApp(firebaseConfig);
const db = getDatabase(fbApp);

// ---------- InfluxDB ----------
const influx = new InfluxDB({
  url: process.env.INFLUX_URL,
  token: process.env.INFLUX_TOKEN
});

const writeApi = influx.getWriteApi(
  process.env.INFLUX_ORG,
  process.env.INFLUX_BUCKET,
  "ns",
  {
    batchSize: 100,
    flushInterval: 5000,
    maxRetries: 5,
    maxRetryDelay: 30000
  }
);

writeApi.useDefaultTags({ sensor: "sensor1" });

// Handle write failures WITHOUT crashing
writeApi.getWriteFailedEvents().on("writeFailed", (error, lines, attempt) => {
  console.error(
    `Influx write failed (attempt ${attempt}):`,
    error.message
  );
});

// Graceful shutdown (Render restarts)
process.on("SIGTERM", async () => {
  try {
    console.log("SIGTERM received — closing Influx writer");
    await writeApi.close();
    console.log("Influx writer closed");
  } catch (err) {
    console.error("Error closing Influx writer:", err);
  }
  process.exit(0);
});

// ---------- Firebase Listener ----------
const phRef = ref(db, "phData");

onChildAdded(phRef, (snapshot) => {
  const val = snapshot.val();
  if (!val || val.ph === undefined) return;

  const ph = parseFloat(val.ph);
  if (Number.isNaN(ph)) return;

  const point = new Point("ph_value")
    .floatField("value", ph)
    .timestamp(Date.now() * 1e6);

  writeApi.writePoint(point);
  console.log("Queued pH:", ph);
});
