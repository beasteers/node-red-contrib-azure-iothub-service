
# node-red-contrib-azure-iothub-service

![alt text](images/image.png)
## Installation

```
npm install -g node-red-contrib-azure-eventhub-receive
```

# Usage

### eventhub-recv
Receive messages sent from devices.

### iothub-send
Send cloud2device messages to your IoT Hub devices.

### iothub-devices
Manage IoT Hub Devices.

<h4>List devices:</h4>
<code>method: <b>"device"</b></code>
<h4>Get device:</h4>
<code>method: <b>"device"</b>, deviceId: str</code>
<h4>Create device:</h4>
<code>method: <b>"device.create"</b>, deviceId: str</code>

<div>
<b>payload (optional):</b>
<div>
    <code>
        {
            status: 'enabled',
            authentication: {
                x509Thumbprint: { primaryThumbprint: XXX, secondaryThumbprint: XXX }
            }
        }
    </code>
</div>
</div>
<h4>Get twin:</h4>
<code>method: <b>"twin"</b>, deviceId: str</code>
<h4>Update twin:</h4>
<code>method: <b>"twin.update"</b>, deviceId: str</code>

<div>
<b>payload:</b>
<div>
    <code>
        {
            tags: { city: "Redmond" },
            properties: {
                desired: { telemetryInterval: 1000 },
            }
        }
    </code>
</div>
</div>
<h4>Delete device:</h4>
<code>method: <b>"device.delete"</b>, deviceId: str</code>