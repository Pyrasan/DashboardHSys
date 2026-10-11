import json
import time
import paho.mqtt.client as mqtt

MQTT_BROKER = "localhost"
MQTT_PORT = 1883
TOPIC_COMMAND = "gate/command"
TOPIC_STATUS = "gate/status"

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("[MQTT] Connected to broker")
        client.subscribe(TOPIC_STATUS)
    else:
        print(f"[MQTT] Connection failed: {rc}")

def on_message(client, userdata, msg):
    print(f"[MQTT] {msg.topic}: {msg.payload.decode()}")

client = mqtt.Client()
client.on_connect = on_connect
client.on_message = on_message
client.connect(MQTT_BROKER, MQTT_PORT, 60)
client.loop_start()

try:
    while True:
        cmd = input("Command (open-entry / open-exit / q): ").strip().lower()
        if cmd == "q":
            break
        if cmd == "open-entry":
            payload = json.dumps({"command": "OPEN - ENTRY", "time": time.strftime("%Y-%m-%dT%H:%M:%S")})
            client.publish(TOPIC_COMMAND, payload)
            print(f"[SENT] {TOPIC_COMMAND}: {payload}")
        elif cmd == "open-exit":
            payload = json.dumps({"command": "OPEN - EXIT", "time": time.strftime("%Y-%m-%dT%H:%M:%S")})
            client.publish(TOPIC_COMMAND, payload)
            print(f"[SENT] {TOPIC_COMMAND}: {payload}")
        else:
            print("Commands: open-entry, open-exit, q")
except KeyboardInterrupt:
    pass
finally:
    client.loop_stop()
    client.disconnect()
