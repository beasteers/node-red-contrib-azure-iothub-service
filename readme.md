
# node-red-contrib-azure-iothub-service

![alt text](images/image.png)
## Installation

```
npm install -g node-red-contrib-azure-iothub-service
```

# Usage

### eventhub-recv
Receive messages sent from devices via the builtin Event Hub.

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


## other functionality
 - checkpoint store
    - I implemented a basic nodered context backed impl, but I'm not certain it's working
    - Azure Blob backed store
 - generate certs
    - https://github.com/Azure/azure-iot-hub-node/blob/main/samples/create_device_with_cert.js

### lower-priority functionality
 - device methods: 
    - https://github.com/Azure/azure-iot-hub-node/blob/main/samples/dmpatterns_reboot_service.js
    - https://github.com/Azure/azure-iot-hub-node/blob/main/samples/dmpatterns_fwupdate_service.js
    - https://github.com/Azure/azure-iot-hub-node/blob/main/samples/invoke_command.js
    - https://github.com/Azure/azure-iot-hub-node/blob/main/samples/invoke_component_command.js
    - https://github.com/Azure/azure-iot-hub-node/blob/main/samples/module_method.js
 - jobs
    - https://github.com/Azure/azure-iot-hub-node/blob/main/samples/job_query.js
    - https://github.com/Azure/azure-iot-hub-node/blob/main/samples/schedule_job.js
 - file notification
    - https://github.com/Azure/azure-iot-hub-node/blob/main/samples/receive_file_notifications.js

### stuff I don't care about
 - bulk blob import export
    - https://github.com/Azure/azure-iot-hub-node/blob/main/samples/registry_bulk_import_sample.js
    - https://github.com/Azure/azure-iot-hub-node/blob/main/samples/registry_bulk_export_sample.js
    - https://github.com/Azure/azure-iot-hub-node/blob/main/samples/registry_bulk_sample.js
    - https://github.com/Azure/azure-iot-hub-node/blob/main/samples/registry_import_managed_identity_sample.js
    - https://github.com/Azure/azure-iot-hub-node/blob/main/samples/registry_export_managed_identity_sample.js
 - device modules
    - https://github.com/Azure/azure-iot-hub-node/blob/main/samples/module_sample.js
 - token credentials
    - https://github.com/Azure/azure-iot-hub-node/blob/main/samples/send_c2d_message_with_token_credential.js
    - https://github.com/Azure/azure-iot-hub-node/blob/main/samples/create_device_with_token_credential.js
 - digital twin client
    - https://github.com/Azure/azure-iot-hub-node/blob/main/samples/update_digital_twin.js
 - edge deployment
    - https://github.com/Azure/azure-iot-hub-node/blob/main/samples/edge_deployment_sample.js