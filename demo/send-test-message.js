// Sends a few test messages to the Event Hub emulator so they show up in the
// demo flow. Run from the repo root:
//
//   node demo/send-test-message.js
//
// Uses the emulator by default (localhost); set EVENTHUB_CONNECTION_STRING to
// point at a real Event Hub instead.
"use strict";

const { EventHubProducerClient } = require("@azure/event-hubs");

const connectionString =
  process.env.EVENTHUB_CONNECTION_STRING ||
  "Endpoint=sb://localhost;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=SAS_KEY_VALUE;UseDevelopmentEmulator=true;EntityPath=eh1";

(async () => {
  const producer = new EventHubProducerClient(connectionString);
  for (let i = 1; i <= 5; i++) {
    await producer.sendBatch([
      {
        body: { deviceId: "demo-device", reading: i, ts: new Date().toISOString() },
      },
    ]);
  }
  await producer.close();
  console.log("Sent 5 messages to the emulator.");
})().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
