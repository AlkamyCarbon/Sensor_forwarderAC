// -------------------------
// Firebase → Influx Bridge
// -------------------------

// 1. Firebase Setup
const firebase = require("firebase/app");
const { getDatabase, ref, onChildAdded } = require("firebase/database");

// TODO: REPLACE with your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDV3J3lrmpas-_zjqMRSYwm4zsRe75_lbI",
  authDomain: "experimental-5494e.firebaseapp.com",
  databaseURL: "https://experimental-5494e-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "experimental-5494e",
  storageBucket: "experimental-5494e.firebasestorage.app",
  messagingSenderId: "376350307630",
  appId: "1:376350307630:web:5bdc65bed00883dd3936bf"
};


const fb = firebase.initializeApp(firebaseConfig);
const db = getDatabase(fb);

// 2. Influx Setup
const { InfluxDB, Point } = require('@influxdata/influxdb-client');

// TODO: REPLACE with your Influx credentials
const influx = new InfluxDB({
  url: "https://eu-central-1-1.aws.cloud2.influxdata.com",
  token: "NHwIOxUMf3a_6kteflfAM8J4Fv_a5G8WijXuW2JjaaGbwAu522zMRSbIF_zzKFOHKMm5-J9EhmDWdltWj-eMqg=="
});

const writeApi = influx.getWriteApi("77f119fe622e6529", "labtrials");
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
