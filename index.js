// -------------------------
// Firebase → Influx Bridge
// -------------------------

const firebase = require("firebase/app");
const { getDatabase, ref, onChildAdded } = require("firebase/database");
const { InfluxDB, Point } = require("@influxdata/influxdb-client");

// Firebase config
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

// InfluxDB config — tuned for free tier + cross-region
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

// 🔒 Prevent crashes on write failure
writeApi
  .getWriteFailedEvents()
  .on("writeFailed", (error, lines, attempt) => {
    console.error(
      `Influx write failed (attempt ${attempt}):`,
      error.message
    );
  });

// Graceful shutdown
process.on("SIGTERM", async () => {
  try {
    console.log("SIGTERM received — flushing Influx buffer...");
    await writeApi.close();
    console.log("Influx buffer flushed. Exiting.");
  } catch (err) {
    console.error("Error flushing Influx buffer:", err);
  }
  process.exit(0);
});

// Firebase listener
const phRef = ref(db, "phData");

onChildAdded(phRef, (snapshot) =>
