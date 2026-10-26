#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <EEPROM.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <DHT.h>
#include <math.h>
#include <stdlib.h>

// ================================================================
// WI-FI CREDENTIALS
// Replace these placeholders with your own 2.4 GHz Wi-Fi details.
// ================================================================
const char* WIFI_SSID = "PARAYIL";
const char* WIFI_PASS = "parayil@78";

// HTTP server on port 80
ESP8266WebServer server(80);

// ================================================================
// HARDWARE PINS — BASED ON YOUR ORIGINAL SKETCH
// ================================================================

// DHT11 sensor
#define DHT_PIN D5
#define DHT_TYPE DHT11

DHT dht(DHT_PIN, DHT_TYPE);

// OLED display: SDA = D2, SCL = D1
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
#define OLED_ADDRESS 0x3C

Adafruit_SSD1306 display(
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  &Wire,
  OLED_RESET
);

bool oledAvailable = false;

// Bulb relay and buzzer
#define RELAY_PIN D7
#define BUZZER_PIN D6

// Active-LOW relay logic
#define RELAY_ON LOW
#define RELAY_OFF HIGH

// Active-HIGH buzzer logic
#define BUZZER_ON HIGH
#define BUZZER_OFF LOW

// No fan relay is installed in this firmware.
// The API reports fanOn as null.

// ================================================================
// TEMPERATURE THRESHOLDS AND EEPROM PERSISTENCE
// ================================================================

float tempOn = 36.0f;
float tempOff = 38.0f;

const uint16_t EEPROM_MAGIC = 0xE661;

struct IncubatorSettings {
  uint16_t magic;
  float bulbOnThreshold;
  float bulbOffThreshold;
};

// ================================================================
// RUNTIME STATE AND CACHED SENSOR READINGS
// ================================================================

bool bulbOn = false;
bool highTempBeeped = false;
bool controlInitialized = false;

bool buzzerActive = false;
unsigned long buzzerOffTime = 0;

float currentTemperature = NAN;
float currentHumidity = NAN;

bool currentSensorError = true;

unsigned long lastSensorReadTime = 0;
const unsigned long SENSOR_INTERVAL = 2000UL;

// ================================================================
// BULB CONTROL
// ================================================================

// Preserve the original safety behavior:
// heating is disabled if the OLED initialization fails.
void setBulb(bool requestedOn) {
  bool permittedOn = requestedOn && oledAvailable;

  bulbOn = permittedOn;

  digitalWrite(
    RELAY_PIN,
    bulbOn ? RELAY_ON : RELAY_OFF
  );
}

// ================================================================
// NON-BLOCKING BUZZER
// ================================================================

void beepOnce() {
  buzzerActive = true;
  buzzerOffTime = millis() + 250UL;

  digitalWrite(BUZZER_PIN, BUZZER_ON);
}

void updateBuzzer() {
  if (
    buzzerActive &&
    (long)(millis() - buzzerOffTime) >= 0
  ) {
    digitalWrite(BUZZER_PIN, BUZZER_OFF);
    buzzerActive = false;
  }
}

// ================================================================
// THRESHOLD VALIDATION
// ================================================================

bool validThresholds(float onValue, float offValue) {
  return
    isfinite(onValue) &&
    isfinite(offValue) &&
    onValue >= 20.0f &&
    onValue <= 45.0f &&
    offValue >= 20.0f &&
    offValue <= 45.0f &&
    onValue < offValue &&
    (offValue - onValue) >= 0.2f;
}

// ================================================================
// EEPROM SETTINGS
// ================================================================

void loadSettingsFromEEPROM() {
  EEPROM.begin(64);

  IncubatorSettings settings;
  EEPROM.get(0, settings);

  if (
    settings.magic == EEPROM_MAGIC &&
    validThresholds(
      settings.bulbOnThreshold,
      settings.bulbOffThreshold
    )
  ) {
    tempOn = settings.bulbOnThreshold;
    tempOff = settings.bulbOffThreshold;

    Serial.print(F("Loaded ON threshold: "));
    Serial.print(tempOn, 1);

    Serial.print(F(" C | OFF threshold: "));
    Serial.print(tempOff, 1);

    Serial.println(F(" C"));
  } else {
    tempOn = 36.0f;
    tempOff = 38.0f;

    Serial.println(
      F("Using default thresholds: ON 36.0 C, OFF 38.0 C")
    );
  }
}

bool saveSettingsToEEPROM(float newOn, float newOff) {
  if (!validThresholds(newOn, newOff)) {
    return false;
  }

  // Do not write to flash when the values have not changed.
  if (
    fabsf(tempOn - newOn) > 0.05f ||
    fabsf(tempOff - newOff) > 0.05f
  ) {
    IncubatorSettings settings;

    settings.magic = EEPROM_MAGIC;
    settings.bulbOnThreshold = newOn;
    settings.bulbOffThreshold = newOff;

    EEPROM.put(0, settings);

    if (!EEPROM.commit()) {
      Serial.println(F("ERROR: EEPROM commit failed"));
      return false;
    }

    // Update active configuration after persistence succeeds.
    tempOn = newOn;
    tempOff = newOff;

    Serial.print(F("Saved ON threshold: "));
    Serial.print(tempOn, 1);

    Serial.print(F(" C | OFF threshold: "));
    Serial.print(tempOff, 1);

    Serial.println(F(" C"));
  }

  return true;
}

// ================================================================
// JSON FLOAT EXTRACTION
// No additional JSON library required.
// ================================================================

bool extractJsonFloat(
  const String& json,
  const char* key,
  float& outValue
) {
  String quotedKey = String("\"") + key + "\"";

  int keyIndex = json.indexOf(quotedKey);

  if (keyIndex < 0) {
    return false;
  }

  int colonIndex = json.indexOf(
    ':',
    keyIndex + quotedKey.length()
  );

  if (colonIndex < 0) {
    return false;
  }

  int valueStart = colonIndex + 1;

  while (
    valueStart < (int)json.length() &&
    (
      json[valueStart] == ' ' ||
      json[valueStart] == '\t' ||
      json[valueStart] == '\r' ||
      json[valueStart] == '\n'
    )
  ) {
    valueStart++;
  }

  if (valueStart >= (int)json.length()) {
    return false;
  }

  String remaining = json.substring(valueStart);

  char* endPtr = nullptr;

  float parsedValue = strtof(
    remaining.c_str(),
    &endPtr
  );

  if (
    endPtr == remaining.c_str() ||
    !isfinite(parsedValue)
  ) {
    return false;
  }

  int consumed = endPtr - remaining.c_str();

  int nextIndex = valueStart + consumed;

  while (
    nextIndex < (int)json.length() &&
    (
      json[nextIndex] == ' ' ||
      json[nextIndex] == '\t' ||
      json[nextIndex] == '\r' ||
      json[nextIndex] == '\n'
    )
  ) {
    nextIndex++;
  }

  // Require a comma or closing brace after the number.
  if (
    nextIndex >= (int)json.length() ||
    (
      json[nextIndex] != ',' &&
      json[nextIndex] != '}'
    )
  ) {
    return false;
  }

  outValue = parsedValue;

  return true;
}

// ================================================================
// HTTP HELPERS
// ================================================================

void sendCorsHeaders() {
  server.sendHeader(
    "Access-Control-Allow-Origin",
    "*"
  );

  server.sendHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS"
  );

  server.sendHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Accept"
  );

  server.sendHeader("Cache-Control", "no-store");
}

void handleOptions() {
  sendCorsHeaders();

  server.send(204, "text/plain", "");
}

// ================================================================
// ROOT ENDPOINT
// ================================================================

void handleRoot() {
  sendCorsHeaders();

  server.send(
    200,
    "application/json",
    "{\"name\":\"Egg Incubator ESP8266 API\","
    "\"version\":1,"
    "\"endpoints\":["
    "\"GET /api/status\","
    "\"GET /api/config\","
    "\"POST /api/config\"]}"
  );
}

// ================================================================
// GET /api/status
// Returns actual cached sensor readings and actuator state.
// ================================================================

void handleGetStatus() {
  sendCorsHeaders();

  String json = "{";

  if (
    currentSensorError ||
    isnan(currentTemperature) ||
    isnan(currentHumidity)
  ) {
    json += "\"temperature\":null,";
    json += "\"humidity\":null,";
    json += "\"sensorStatus\":\"SENSOR_ERROR\",";
  } else {
    json += "\"temperature\":";
    json += String(currentTemperature, 1);
    json += ",";

    json += "\"humidity\":";
    json += String(currentHumidity, 1);
    json += ",";

    json += "\"sensorStatus\":\"OK\",";
  }

  json += "\"bulbOn\":";
  json += bulbOn ? "true" : "false";

  // Fan is unavailable because no fan relay is installed.
  json += ",\"fanOn\":null,";

  json += "\"buzzerOn\":";
  json += buzzerActive ? "true" : "false";

  json += "}";

  server.send(
    200,
    "application/json",
    json
  );
}

// ================================================================
// GET /api/config
// Returns active temperature thresholds.
// ================================================================

void handleGetConfig() {
  sendCorsHeaders();

  String json = "{";

  json += "\"bulbOnThreshold\":";
  json += String(tempOn, 1);

  json += ",\"bulbOffThreshold\":";
  json += String(tempOff, 1);

  json += "}";

  server.send(
    200,
    "application/json",
    json
  );
}

// ================================================================
// POST /api/config
// Updates thresholds after validation.
// ================================================================

void handlePostConfig() {
  sendCorsHeaders();

  if (!server.hasArg("plain")) {
    server.send(
      400,
      "application/json",
      "{\"error\":\"Missing request body\"}"
    );

    return;
  }

  String body = server.arg("plain");

  float newOn = NAN;
  float newOff = NAN;

  bool hasOn = extractJsonFloat(
    body,
    "bulbOnThreshold",
    newOn
  );

  bool hasOff = extractJsonFloat(
    body,
    "bulbOffThreshold",
    newOff
  );

  if (!hasOn || !hasOff) {
    server.send(
      400,
      "application/json",
      "{\"error\":\"Missing or invalid bulbOnThreshold or bulbOffThreshold\"}"
    );

    return;
  }

  if (
    newOn < 20.0f || newOn > 45.0f ||
    newOff < 20.0f || newOff > 45.0f
  ) {
    server.send(
      400,
      "application/json",
      "{\"error\":\"Thresholds must be between 20.0 C and 45.0 C\"}"
    );

    return;
  }

  if (newOn >= newOff) {
    server.send(
      400,
      "application/json",
      "{\"error\":\"Bulb ON threshold must be strictly lower than Bulb OFF threshold\"}"
    );

    return;
  }

  if ((newOff - newOn) < 0.2f) {
    server.send(
      400,
      "application/json",
      "{\"error\":\"Hysteresis deadband must be at least 0.2 C\"}"
    );

    return;
  }

  if (!saveSettingsToEEPROM(newOn, newOff)) {
    server.send(
      500,
      "application/json",
      "{\"error\":\"Could not persist configuration\"}"
    );

    return;
  }

  String responseJson = "{";

  responseJson += "\"bulbOnThreshold\":";
  responseJson += String(tempOn, 1);

  responseJson += ",\"bulbOffThreshold\":";
  responseJson += String(tempOff, 1);

  responseJson += "}";

  server.send(
    200,
    "application/json",
    responseJson
  );
}

// ================================================================
// UNKNOWN ENDPOINT
// ================================================================

void handleNotFound() {
  sendCorsHeaders();

  server.send(
    404,
    "application/json",
    "{\"error\":\"Endpoint not found\"}"
  );
}

// ================================================================
// SENSOR ERROR HANDLING
// ================================================================

void showSensorError() {
  // Fail-safe: turn off the heating bulb.
  setBulb(false);

  controlInitialized = false;
  highTempBeeped = false;

  if (oledAvailable) {
    display.clearDisplay();

    display.setTextColor(SSD1306_WHITE);
    display.setTextSize(1);
    display.setCursor(0, 0);

    display.println(F("EGG INCUBATOR"));
    display.drawLine(
      0, 11, 127, 11, SSD1306_WHITE
    );

    display.setCursor(0, 22);

    display.println(F("SENSOR ERROR!"));
    display.println();
    display.println(F("Bulb: OFF"));
    display.println(F("Check DHT11 wiring"));

    display.display();
  }

  Serial.println(F("SENSOR ERROR - BULB OFF"));
}

// ================================================================
// SENSOR READING AND HYSTERESIS CONTROL
// ================================================================

void readSensorAndControl() {
  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();

  bool sensorError =
    isnan(temperature) ||
    isnan(humidity) ||
    temperature < 0.0f ||
    temperature > 50.0f ||
    humidity < 0.0f ||
    humidity > 100.0f;

  if (sensorError) {
    currentSensorError = true;

    currentTemperature = NAN;
    currentHumidity = NAN;

    showSensorError();

    return;
  }

  currentSensorError = false;

  currentTemperature = temperature;
  currentHumidity = humidity;

  // Preserve the original OLED-failure safety interlock.
  if (!oledAvailable) {
    setBulb(false);

    controlInitialized = false;
  }
  else if (!controlInitialized) {
    // Startup or sensor recovery:
    // Below OFF threshold -> bulb ON.
    // At or above OFF threshold -> bulb OFF and beep.

    if (temperature >= tempOff) {
      setBulb(false);

      beepOnce();

      highTempBeeped = true;
    }
    else {
      setBulb(true);

      highTempBeeped = false;
    }

    controlInitialized = true;
  }
  else if (temperature >= tempOff) {
    // At or above OFF threshold: bulb OFF.
    setBulb(false);

    if (!highTempBeeped) {
      beepOnce();

      highTempBeeped = true;
    }
  }
  else if (temperature <= tempOn) {
    // At or below ON threshold: bulb ON.
    setBulb(true);

    highTempBeeped = false;
  }

  // Between the two thresholds, retain the prior bulb state.

  // ==============================================================
  // OLED DISPLAY
  // ==============================================================

  if (oledAvailable) {
    display.clearDisplay();

    display.setTextColor(SSD1306_WHITE);
    display.setTextSize(1);
    display.setCursor(0, 0);

    display.println(F("EGG INCUBATOR"));

    display.drawLine(
      0, 11, 127, 11, SSD1306_WHITE
    );

    // Temperature
    display.setTextSize(2);
    display.setCursor(0, 14);

    display.print(temperature, 1);
    display.print(F(" C"));

    // Humidity
    display.setTextSize(1);
    display.setCursor(0, 36);

    display.print(F("Humidity: "));
    display.print(humidity, 1);
    display.print(F("%"));

    // Bulb status
    display.setCursor(0, 46);

    display.print(F("Bulb: "));
    display.print(
      bulbOn ? F("ON") : F("OFF")
    );

    // Status
    display.setCursor(0, 56);

    if (temperature >= tempOff) {
      display.print(F("HIGH TEMP - BULB OFF"));
    }
    else if (temperature <= tempOn) {
      display.print(F("HEATING - BULB ON"));
    }
    else {
      display.print(
        bulbOn
          ? F("Holding: BULB ON")
          : F("Holding: BULB OFF")
      );
    }

    display.display();
  }

  // ==============================================================
  // SERIAL MONITOR
  // ==============================================================

  Serial.print(F("Temperature: "));
  Serial.print(temperature, 1);

  Serial.print(F(" C | Humidity: "));
  Serial.print(humidity, 1);

  Serial.print(F("% | Bulb: "));
  Serial.print(bulbOn ? F("ON") : F("OFF"));

  if (temperature >= tempOff) {
    Serial.println(F(" | HIGH TEMP - BEEP"));
  }
  else if (temperature <= tempOn) {
    Serial.println(F(" | HEATING"));
  }
  else {
    Serial.println(F(" | HOLDING PREVIOUS STATE"));
  }
}

// ================================================================
// SETUP
// ================================================================

void setup() {
  Serial.begin(115200);

  delay(500);

  // Initialize relay to its OFF state.
  digitalWrite(RELAY_PIN, RELAY_OFF);
  pinMode(RELAY_PIN, OUTPUT);

  // Initialize buzzer OFF.
  digitalWrite(BUZZER_PIN, BUZZER_OFF);
  pinMode(BUZZER_PIN, OUTPUT);

  setBulb(false);

  // Load saved settings or use defaults.
  loadSettingsFromEEPROM();

  // Initialize OLED: SDA D2, SCL D1.
  Wire.begin(D2, D1);

  if (
    display.begin(
      SSD1306_SWITCHCAPVCC,
      OLED_ADDRESS
    )
  ) {
    oledAvailable = true;

    display.clearDisplay();

    display.setTextColor(SSD1306_WHITE);
    display.setTextSize(1);
    display.setCursor(0, 0);

    display.println(F("EGG INCUBATOR"));
    display.println();
    display.println(F("Connecting Wi-Fi..."));

    display.display();
  }
  else {
    oledAvailable = false;

    Serial.println(
      F("OLED initialization failed! Heating interlock active; bulb will remain OFF.")
    );

    setBulb(false);
  }

  dht.begin();

  // ==============================================================
  // WI-FI CONNECTION
  // ==============================================================

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.persistent(false);

  Serial.print(F("Connecting to Wi-Fi SSID: "));
  Serial.println(WIFI_SSID);

  WiFi.begin(WIFI_SSID, WIFI_PASS);

  int attempts = 0;

  while (
    WiFi.status() != WL_CONNECTED &&
    attempts < 20
  ) {
    delay(500);

    Serial.print('.');

    attempts++;
  }

  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print(F("Wi-Fi connected! ESP8266 IP address: "));
    Serial.println(WiFi.localIP());

    if (oledAvailable) {
      display.clearDisplay();

      display.setCursor(0, 0);

      display.println(F("EGG INCUBATOR"));
      display.println();
      display.println(F("Wi-Fi Connected!"));

      display.print(F("IP: "));
      display.println(WiFi.localIP());

      display.display();

      delay(1500);
    }
  }
  else {
    Serial.println(
      F("Wi-Fi connection failed or timed out. Local controller continues.")
    );

    if (oledAvailable) {
      display.clearDisplay();

      display.setCursor(0, 0);

      display.println(F("EGG INCUBATOR"));
      display.println();
      display.println(F("Wi-Fi: OFFLINE"));
      display.println(F("Local control"));

      display.display();

      delay(1500);
    }
  }

  // ==============================================================
  // HTTP REST API ROUTES
  // ==============================================================

  server.on("/", HTTP_GET, handleRoot);

  server.on(
    "/api/status",
    HTTP_GET,
    handleGetStatus
  );

  server.on(
    "/api/status",
    HTTP_OPTIONS,
    handleOptions
  );

  server.on(
    "/api/config",
    HTTP_GET,
    handleGetConfig
  );

  server.on(
    "/api/config",
    HTTP_POST,
    handlePostConfig
  );

  server.on(
    "/api/config",
    HTTP_OPTIONS,
    handleOptions
  );

  server.onNotFound(handleNotFound);

  server.begin();

  Serial.println(
    F("HTTP REST API server started on port 80")
  );

  Serial.println(
    F("Endpoints ready: GET /api/status, GET /api/config, POST /api/config")
  );

  Serial.print(F("Bulb ON threshold: "));
  Serial.print(tempOn, 1);

  Serial.print(F(" C | Bulb OFF threshold: "));
  Serial.print(tempOff, 1);

  Serial.println(F(" C"));
}

// ================================================================
// MAIN LOOP
// ==============================================================

void loop() {
  // Handle API requests.
  server.handleClient();

  // Maintain buzzer timing without a blocking delay.
  updateBuzzer();

  // Read the DHT11 and run temperature control every 2 seconds.
  unsigned long now = millis();

  if (
    now - lastSensorReadTime >= SENSOR_INTERVAL ||
    lastSensorReadTime == 0
  ) {
    lastSensorReadTime = now;

    readSensorAndControl();
  }
}