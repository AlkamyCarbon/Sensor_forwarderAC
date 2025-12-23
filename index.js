=// -------------------------
// Firebase → Influx Bridge
// -------------------------

// 1. Firebase Setup
const firebase = require("firebase/app");
const { getDatabase, ref, onChildAdded } = require("firebase/database");

const firebaseConfig = {
  apiKey: process.env.FB_API_KEY,
  authDomain: process.env.FB_AUTH_DOMAIN,
  databaseURL: process.env.FB_DATABASE_URL,
  projectId: process.env.FB_PROJECT_ID,
  storageBucket: process.env.FB_STORAGE_BUCKET,
  messagingSenderId: process.env.FB_MESSAGING_SENDER_ID,
  appId: process.env.FB_APP_ID
};

const fb = firebase.initializeApp(firebaseConfig);
const db = getDatabase(fb);

// 2. InfluxDB Setup
const { InfluxDB, Point } = require("@influxdata/influxdb-client");

const influx = new InfluxDB({
  url: process.env.INFLUX_URL,
  token: process.env.INFLUX_TOKEN
});

const writeApi = influx.getWriteApi(
  process.env.INFLUX_ORG,
  process.env.INFLUX_BUCKET
);

// Optional tag (useful later if you add multiple sensors)
writeApi.useDefaultTags({ sensor: "sensor1" });

// Graceful shutdown — flush buffered points
process.on("SIGTERM", async () => {
  try {
    console.log("SIGTERM received — flushing Influx buffer...");
    await writeApi.close();
    console.log("Influx buffer flushed. Exiting.");
  } catch (err) {
    console.error("Error while flushing Influx buffer:", err);
  }
  process.exit(0);
});

// 3. Subscribe to Firebase data
const phRef = ref(db, "phData");

onChildAdded(phRef, (snapshot) => {
  const val = snapshot.val();
  console.log("New Firebase data:", val);

  const phValue = parseFloat(val.ph);
  if (Number.isNaN(phValue)) {
    console.warn("Invalid pH value, skipping:", val.ph);
    return;
  }

  const timestampMs = Date.now();

  const point = new Point("ph_value")
    .floatField("value", phValue)
    .timestamp(timestampMs * 1e6); // ms → ns

  writeApi.writePoint(point);
  console.log("→ Queued for Influx");
});

