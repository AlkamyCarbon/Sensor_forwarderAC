// -------------------------
// Firebase → Influx Bridge
// -------------------------

// 1. Firebase Setup
const firebase = require("firebase/app");
const { getDatabase, ref, onChildAdded } = require("firebase/database");

// TODO: REPLACE with your Firebase config
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

// 2. Influx Setup
const { InfluxDB, Point } = require('@influxdata/influxdb-client');

// TODO: REPLACE with your Influx credentials
const influx = new InfluxDB({
  url: process.env.INFLUX_URL,
  token: process.env.INFLUX_TOKEN
});

const writeApi = influx.getWriteApi(
  process.env.INFLUX_ORG,
  process.env.INFLUX_BUCKET
);

writeApi.useDefaultTags({ sensor: "sensor1" });

// 3. Subscribe to Firebase child additions
const phRef = ref(db, "phData");

// each time new data is added
onChildAdded(phRef, (snapshot) => {
  const val = snapshot.val();
  console.log("New Firebase data:", val);

  const phValue = parseFloat(val.ph);
  const ts = Date.now(); // using real timestamp now

  const point = new Point("ph_value")
    .floatField("value", phValue)
    .timestamp(ts * 1e6); // convert ms → ns

  writeApi.writePoint(point);
  writeApi.flush();
  console.log("→ Written to Influx");
});
