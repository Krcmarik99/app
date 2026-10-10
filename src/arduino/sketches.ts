/** Vzorové programy pre Arduino (s komentármi po slovensky). */

export const BLINK_SKETCH = `// Blikanie LED – prvý program pre Arduino.
// LED na pine 13 (aj malá LED „L“ na doske) sa zapne a vypne každú pol sekundu.

const int LED = 13;

void setup() {
  pinMode(LED, OUTPUT);     // pin 13 bude výstup
}

void loop() {
  digitalWrite(LED, HIGH);  // zapni LED (5 V)
  delay(500);               // počkaj 500 ms
  digitalWrite(LED, LOW);   // vypni LED (0 V)
  delay(500);
}
`;

export const BUTTON_SKETCH = `// Tlačidlo ovláda LED.
// Tlačidlo spája pin 2 s napätím 5 V. Rezistor 10 kΩ drží pin na 0 V,
// keď tlačidlo nie je stlačené (pull-down). Klikni na tlačidlo v schéme a drž ho.

const int TLACIDLO = 2;
const int LED = 13;
int predtym = LOW;

void setup() {
  pinMode(TLACIDLO, INPUT);
  pinMode(LED, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int stav = digitalRead(TLACIDLO);
  digitalWrite(LED, stav);
  if (stav != predtym) {             // vypíš len zmenu
    Serial.println(stav == HIGH ? "stlačené" : "pustené");
    predtym = stav;
  }
}
`;

export const FADE_SKETCH = `// Plynulé rozsvecovanie LED pomocou PWM (analogWrite).
// Na osciloskope vidíš obdĺžnikový signál: čím dlhšie je pin v každej perióde
// zapnutý, tým jasnejšie LED svieti.

const int LED = 9;   // PWM pin (na doske označený ~)
int jas = 0;
int krok = 5;

void setup() {
  pinMode(LED, OUTPUT);
}

void loop() {
  analogWrite(LED, jas);       // 0 = vypnutá, 255 = naplno
  jas = jas + krok;
  if (jas <= 0 || jas >= 255) {
    krok = -krok;              // obráť smer
  }
  delay(30);
}
`;

export const POT_SKETCH = `// Potenciometer na A0 nastavuje jas LED na pine 9.
// analogRead vracia 0 až 1023, analogWrite potrebuje 0 až 255 – prepočíta to map().
// Polohu jazdca zmeníš vo vlastnostiach potenciometra. Hodnoty sú na sériovom monitore.

void setup() {
  pinMode(9, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int hodnota = analogRead(A0);
  int jas = map(hodnota, 0, 1023, 0, 255);
  analogWrite(9, jas);

  float napatie = hodnota * 5.0 / 1023;
  Serial.print("A0 = ");
  Serial.print(hodnota);
  Serial.print("   U = ");
  Serial.print(napatie);
  Serial.println(" V");
  delay(200);
}
`;

export const TRAFFIC_SKETCH = `// Semafor: červená – červená a žltá – zelená – žltá – a znova.

const int CERVENA = 12;
const int ZLTA = 11;
const int ZELENA = 10;

void setup() {
  pinMode(CERVENA, OUTPUT);
  pinMode(ZLTA, OUTPUT);
  pinMode(ZELENA, OUTPUT);
}

// Zapne zvolené svetlá a počká zadaný čas.
void svetla(int c, int z, int ze, int ms) {
  digitalWrite(CERVENA, c);
  digitalWrite(ZLTA, z);
  digitalWrite(ZELENA, ze);
  delay(ms);
}

void loop() {
  svetla(HIGH, LOW, LOW, 3000);   // stoj
  svetla(HIGH, HIGH, LOW, 1000);  // priprav sa
  svetla(LOW, LOW, HIGH, 3000);   // choď
  svetla(LOW, HIGH, LOW, 1000);   // pozor
}
`;

export const SEG7_SKETCH = `// Počítadlo 0 až 9 na 7-segmentovom displeji so spoločnou katódou.
// Segmenty a až g sú na pinoch 2 až 8 (f na 8, g na 7 – tak sa vodiče nekrížia).

const int SEGMENTY[7] = {2, 3, 4, 5, 6, 8, 7};   // a, b, c, d, e, f, g

// Ktoré segmenty svietia pri číslici 0 až 9 (1 = svieti), poradie a b c d e f g.
const byte CISLICE[10][7] = {
  {1, 1, 1, 1, 1, 1, 0},  // 0
  {0, 1, 1, 0, 0, 0, 0},  // 1
  {1, 1, 0, 1, 1, 0, 1},  // 2
  {1, 1, 1, 1, 0, 0, 1},  // 3
  {0, 1, 1, 0, 0, 1, 1},  // 4
  {1, 0, 1, 1, 0, 1, 1},  // 5
  {1, 0, 1, 1, 1, 1, 1},  // 6
  {1, 1, 1, 0, 0, 0, 0},  // 7
  {1, 1, 1, 1, 1, 1, 1},  // 8
  {1, 1, 1, 1, 0, 1, 1}   // 9
};

void setup() {
  for (int i = 0; i < 7; i++) {
    pinMode(SEGMENTY[i], OUTPUT);
  }
}

void zobraz(int cislo) {
  for (int i = 0; i < 7; i++) {
    digitalWrite(SEGMENTY[i], CISLICE[cislo][i]);
  }
}

void loop() {
  for (int c = 0; c <= 9; c++) {
    zobraz(c);
    delay(1000);
  }
}
`;

export const LCD_SKETCH = `// LCD displej 16×2 s prevodníkom I2C.
// Zapojenie: GND na GND, VCC na 5V, SDA na A4, SCL na A5.

#include <Wire.h>
#include <LiquidCrystal_I2C.h>

LiquidCrystal_I2C lcd(0x27, 16, 2);   // adresa 0x27, 16 znakov, 2 riadky

void setup() {
  lcd.init();
  lcd.backlight();            // zapni podsvietenie
  lcd.setCursor(0, 0);        // stĺpec 0, riadok 0
  lcd.print("Ahoj, Arduino!");
}

void loop() {
  lcd.setCursor(0, 1);        // druhý riadok
  lcd.print("Cas: ");
  lcd.print(millis() / 1000);
  lcd.print(" s");
  delay(200);
}
`;

export const SERVO_SKETCH = `// Servo nasleduje potenciometer – ako gombík.
// Polohu jazdca potenciometra zmeníš v jeho vlastnostiach.

#include <Servo.h>

Servo servo;

void setup() {
  servo.attach(9);            // signál serva je na pine 9
}

void loop() {
  int hodnota = analogRead(A0);              // 0 až 1023
  int uhol = map(hodnota, 0, 1023, 0, 180);  // 0° až 180°
  servo.write(uhol);
  delay(15);
}
`;

export const SWEEP_SKETCH = `// Servo sa otáča tam a späť od 0° do 180°.
// Šírka impulzov na pine 9 určuje uhol – pozri ich na osciloskope.

#include <Servo.h>

Servo servo;

void setup() {
  servo.attach(9);            // signál serva je na pine 9
}

void loop() {
  for (int uhol = 0; uhol <= 180; uhol++) {
    servo.write(uhol);
    delay(15);
  }
  for (int uhol = 180; uhol >= 0; uhol--) {
    servo.write(uhol);
    delay(15);
  }
}
`;

export const TMP36_SERIAL_SKETCH = `// Teplomer: senzor TMP36 dáva 0,5 V pri 0 °C a pridá 10 mV na každý stupeň.
// Teplota sa vypisuje na sériový monitor. Pri teplote nad 30 °C sa rozsvieti
// LED „L“ na doske. Teplotu okolia senzora zmeníš v jeho vlastnostiach.

void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int hodnota = analogRead(A0);
  float napatie = hodnota * 5.0 / 1024;
  float teplota = (napatie - 0.5) * 100;
  Serial.print("Teplota: ");
  Serial.print(teplota, 1);
  Serial.println(" °C");
  digitalWrite(LED_BUILTIN, teplota > 30);
  delay(500);
}
`;

export const TONE_SKETCH = `// Zvonček: kým držíš tlačidlo, bzučiak hrá tón 440 Hz (komorné a).
// Tlačidlo spína pin 2 k zemi. Vnútorný pull-up rezistor (INPUT_PULLUP)
// drží pin na HIGH, kým tlačidlo nie je stlačené – stlačené tlačidlo je LOW.

const int TLACIDLO = 2;
const int BZUCIAK = 8;
int melodia[] = {262, 330, 392, 523};   // c, e, g, c2

void setup() {
  pinMode(TLACIDLO, INPUT_PULLUP);
  for (int i = 0; i < 4; i++) {          // krátka melódia po zapnutí
    tone(BZUCIAK, melodia[i], 150);
    delay(200);
  }
}

void loop() {
  if (digitalRead(TLACIDLO) == LOW) {
    tone(BZUCIAK, 440);
  } else {
    noTone(BZUCIAK);
  }
}
`;

export const LDR_SKETCH = `// Nočné svetlo: keď je tma, LED sa rozsvieti.
// Fotorezistor a rezistor 10 kΩ tvoria delič napätia. Čím menej svetla,
// tým väčší odpor fotorezistora a tým menšie napätie na A0.
// Osvetlenie zmeníš vo vlastnostiach fotorezistora.

const int PRAH = 300;

void setup() {
  pinMode(13, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int svetlo = analogRead(A0);
  Serial.println(svetlo);
  if (svetlo < PRAH) {
    digitalWrite(13, HIGH);   // tma – rozsvieť
  } else {
    digitalWrite(13, LOW);
  }
  delay(250);
}
`;

export const TMP36_SKETCH = `// Teplomer: senzor TMP36 dáva 0,5 V pri 0 °C a pridá 10 mV na každý stupeň.
// Teplotu ukazuje LCD displej aj sériový monitor.
// Teplotu okolia senzora zmeníš v jeho vlastnostiach.

#include <Wire.h>
#include <LiquidCrystal_I2C.h>

LiquidCrystal_I2C lcd(0x27, 16, 2);

void setup() {
  lcd.init();
  lcd.backlight();
  lcd.print("Teplomer TMP36");
  Serial.begin(9600);
}

void loop() {
  int hodnota = analogRead(A0);
  float napatie = hodnota * 5.0 / 1024;
  float teplota = (napatie - 0.5) * 100;

  lcd.setCursor(0, 1);
  lcd.print(teplota, 1);
  lcd.print((char)223);       // znak ° na displeji
  lcd.print("C   ");
  Serial.println(teplota);
  delay(500);
}
`;

export const RGB_SKETCH = `// RGB LED so spoločnou katódou: tri LED v jednom puzdre.
// Zmiešaním červenej, zelenej a modrej vznikajú ďalšie farby.

const int R = 11, G = 10, B = 9;   // PWM piny

void farba(int r, int g, int b) {
  analogWrite(R, r);
  analogWrite(G, g);
  analogWrite(B, b);
}

void setup() {
}

void loop() {
  farba(255, 0, 0);     delay(1000);  // červená
  farba(0, 255, 0);     delay(1000);  // zelená
  farba(0, 0, 255);     delay(1000);  // modrá
  farba(255, 160, 0);   delay(1000);  // žltá
  farba(0, 255, 255);   delay(1000);  // tyrkysová
  farba(255, 0, 255);   delay(1000);  // fialová
  farba(255, 255, 255); delay(1000);  // biela
}
`;

export const SERIAL_SKETCH = `// Ovládanie LED zo sériového monitora.
// Napíš do riadku pod monitorom „zapni“ alebo „vypni“ a stlač Enter.

void setup() {
  pinMode(13, OUTPUT);
  Serial.begin(9600);
  Serial.println("Napis: zapni alebo vypni");
}

void loop() {
  if (Serial.available() > 0) {
    String prikaz = Serial.readStringUntil('\\n');
    prikaz.trim();
    if (prikaz == "zapni") {
      digitalWrite(13, HIGH);
      Serial.println("LED svieti");
    } else if (prikaz == "vypni") {
      digitalWrite(13, LOW);
      Serial.println("LED nesvieti");
    } else {
      Serial.println("Nepoznam prikaz: " + prikaz);
    }
  }
}
`;

export const EMPTY_SKETCH = `void setup() {
  // sem patrí kód, ktorý sa vykoná raz po zapnutí
}

void loop() {
  // sem patrí kód, ktorý sa opakuje stále dookola
}
`;

/** Programy, ktoré sa dajú vložiť do editora. */
export const SKETCHES: { id: string; title: string; code: string }[] = [
  { id: 'empty', title: 'Prázdny program', code: EMPTY_SKETCH },
  { id: 'blink', title: 'Blikanie LED', code: BLINK_SKETCH },
  { id: 'button', title: 'Tlačidlo a LED', code: BUTTON_SKETCH },
  { id: 'fade', title: 'Plynulé rozsvecovanie (PWM)', code: FADE_SKETCH },
  { id: 'pot', title: 'Potenciometer a analogRead', code: POT_SKETCH },
  { id: 'traffic', title: 'Semafor', code: TRAFFIC_SKETCH },
  { id: 'seg7', title: '7-segmentový displej', code: SEG7_SKETCH },
  { id: 'lcd', title: 'LCD displej', code: LCD_SKETCH },
  { id: 'sweep', title: 'Servo tam a späť', code: SWEEP_SKETCH },
  { id: 'servo', title: 'Servo a potenciometer', code: SERVO_SKETCH },
  { id: 'tone', title: 'Bzučiak a tón', code: TONE_SKETCH },
  { id: 'ldr', title: 'Nočné svetlo s fotorezistorom', code: LDR_SKETCH },
  { id: 'tmp36s', title: 'Teplomer s TMP36', code: TMP36_SERIAL_SKETCH },
  { id: 'tmp36', title: 'Teplomer s TMP36 a LCD', code: TMP36_SKETCH },
  { id: 'rgb', title: 'RGB LED', code: RGB_SKETCH },
  { id: 'serial', title: 'Príkazy zo sériového monitora', code: SERIAL_SKETCH },
];
