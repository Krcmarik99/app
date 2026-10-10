import { describe, expect, it } from 'vitest';
import { compileSketch } from '../src/arduino/compiler';
import { Mcu, lcdVisible, newLcdState, type LcdState, type McuHost } from '../src/arduino/vm';

/** Mikrokontrolér s „obvodom“, ktorý je vždy dopočítaný a na vstupoch má zadané napätia. */
function boot(code: string, volts: Record<number, number> = {}, lcd: LcdState | null = null): Mcu {
  const r = compileSketch(code);
  if (!r.ok) throw new Error(`riadok ${r.error.line}: ${r.error.message}`);
  const mcu = new Mcu(r.program);
  const host: McuHost = {
    pinVoltage: (p) => volts[p] ?? 0,
    pinFloating: () => false,
    circuitTime: () => mcu.time,
    lcd: (addr) => (addr === 0x27 ? lcd : null),
  };
  mcu.host = host;
  return mcu;
}

function run(mcu: Mcu, seconds: number): void {
  const end = mcu.time + seconds;
  while (mcu.time < end - 1e-12) mcu.run(Math.min(end, mcu.time + 0.01), 1e7);
}

const out = (code: string, seconds = 0.05) => {
  const mcu = boot(code);
  run(mcu, seconds);
  if (mcu.error) throw new Error(`riadok ${mcu.error.line}: ${mcu.error.message}`);
  return mcu.serialLog;
};

const errorOf = (code: string) => {
  const r = compileSketch(code);
  return r.ok ? null : r.error;
};

describe('jazyk Arduina', () => {
  it('počíta s typmi ako Arduino UNO (int má 16 bitov)', () => {
    const log = out(`
void setup() {
  Serial.begin(9600);
  int a = 32767; a++; Serial.println(a);
  long ms = 60 * 1000; Serial.println(ms);
  long ok = 60L * 1000; Serial.println(ok);
  Serial.println(7 / 2);
  Serial.println(7 / 2.0);
  Serial.println(-7 % 3);
  Serial.println(3.14159, 4);
  Serial.println(255, HEX);
  Serial.println(5, BIN);
  char c = 'A'; Serial.println(c); c++; Serial.println(c);
  byte b = 250; b += 10; Serial.println(b);
  unsigned int u = 0; u--; Serial.println(u);
  Serial.println(-1, HEX);
  float f = 1.0 / 3; Serial.println(f, 6);
  Serial.println(map(512, 0, 1023, 0, 255));
  Serial.println(constrain(300, 0, 255));
  Serial.println(true);
  String s = "Ahoj"; s += 5; s = s + " " + 2.5; Serial.println(s);
  Serial.println(s.length());
  Serial.println(String(255, HEX));
  Serial.println(1.0 / 0);
  Serial.println(abs(-4) + sq(3));
  unsigned long big = 4294967295UL; big++; Serial.println(big);
  Serial.println(B101 << 2);
  Serial.println((int)3.99);
  Serial.println(round(2.5));
}
void loop() {}`, 0.5);
    expect(log.split('\n')).toEqual([
      '-32768', '-5536', '60000', '3', '3.50', '-1', '3.1416', 'FF', '101', 'A', 'B', '4', '65535', 'FFFFFFFF', '0.333333',
      '127', '255', '1', 'Ahoj5 2.50', '10', 'ff', 'inf', '13', '0', '20', '3', '3', '',
    ]);
  });

  it('vykoná funkcie, polia, cykly a switch', () => {
    const log = out(`
int fact(int n) { if (n <= 1) return 1; return n * fact(n - 1); }
int arr[] = {5, 3, 8, 1};
const int N = sizeof(arr) / sizeof(arr[0]);
void fill(int a[], int n, int v) { for (int i = 0; i < n; i++) a[i] = v; }
enum Stav { VYP, ZAP = 5, BLIK };
void setup() {
  Serial.begin(9600);
  Serial.println(fact(7));
  int sum = 0;
  for (int i = 0; i < N; i++) sum += arr[i];
  Serial.println(sum);
  int m[2][3] = {{1, 2, 3}, {4, 5, 6}};
  Serial.println(m[1][2]);
  for (int i = 0; i < 3; i++) {
    switch (i) { case 0: Serial.print("a"); break; case 1: Serial.print("b"); default: Serial.print("c"); }
  }
  Serial.println();
  int k = 0;
  while (true) { k++; if (k == 3) continue; if (k > 5) break; Serial.print(k); }
  Serial.println();
  int x = 5; int y = x++ + ++x; Serial.println(y);
  Serial.println(x > 3 ? "velke" : "male");
  fill(arr, N, 7); Serial.println(arr[3]);
  Stav s = BLIK; Serial.println(s);
  do { k--; } while (k > 0); Serial.println(k);
  String t = "Arduino"; t.toUpperCase(); Serial.println(t);
  Serial.println(t.substring(1, 3) + t.charAt(0) + t.indexOf('D'));
  static int cnt = 0; cnt++;
  bitSet(cnt, 4); Serial.println(cnt);
}
void loop() {}`);
    expect(log.split('\n')).toEqual(['5040', '17', '6', 'abcc', '1245', '12', 'velke', '7', '6', '0', 'ARDUINO', 'RDA2', '17', '']);
  });

  it('delay a millis plynú v čase simulácie', () => {
    const mcu = boot(`
unsigned long start;
void setup() { pinMode(LED_BUILTIN, OUTPUT); Serial.begin(9600); start = millis(); }
void loop() {
  digitalWrite(13, HIGH); delay(500);
  digitalWrite(13, LOW); delay(500);
  Serial.println(millis() - start);
}`);
    run(mcu, 0.25);
    expect(mcu.pins[13].out).toBe(1);
    run(mcu, 0.5);
    expect(mcu.pins[13].out).toBe(0);
    run(mcu, 2.3);
    expect(mcu.serialLog.split('\n').slice(0, 3)).toEqual(['1000', '2000', '3000']);
    expect(mcu.pinDrive(13, mcu.time)).toEqual({ g: 1 / 25, e: 5 });
  });

  it('číta vstupy a PWM má správnu striedu', () => {
    const mcu = boot(`
void setup() { pinMode(2, INPUT); Serial.begin(9600); }
void loop() {
  Serial.println(digitalRead(2));
  Serial.println(analogRead(A0));
  analogWrite(9, 64);
  delay(100);
}`, { 2: 4.8, 14: 2.5 });
    run(mcu, 0.05);
    expect(mcu.serialLog.split('\n').slice(0, 2)).toEqual(['1', '512']);
    // Pin 9: 490 Hz, strieda 64/255.
    let high = 0;
    for (let i = 0; i < 1000; i++) if (mcu.pinDrive(9, 0.1 + i * 2.04e-6).e > 0) high += 1;
    expect(high / 1000).toBeCloseTo(64 / 255, 2);
    expect(mcu.nextEdge(0.1)).toBeGreaterThan(0.1);
  });

  it('LCD displej zobrazí text', () => {
    const lcd = newLcdState();
    const mcu = boot(`
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
LiquidCrystal_I2C lcd(0x27, 16, 2);
void setup() {
  lcd.init();
  lcd.backlight();
  lcd.setCursor(2, 0);
  lcd.print("Ahoj, svet!");
  lcd.setCursor(0, 1);
  lcd.print(23.5, 1);
  lcd.print((char)223);
  lcd.print("C");
}
void loop() {}`, {}, lcd);
    run(mcu, 0.2);
    const text = lcdVisible(lcd).map((row) => row.map((c) => (c === 0xdf ? '°' : String.fromCharCode(c))).join(''));
    expect(text).toEqual(['  Ahoj, svet!   ', '23.5°C          ']);
    expect(lcd.backlight).toBe(true);
  });

  it('Serial.parseInt číta čísla zo sériového monitora', () => {
    const mcu = boot(`
void setup() { Serial.begin(9600); }
void loop() {
  if (Serial.available() > 0) {
    int n = Serial.parseInt();
    Serial.println(n * 2);
  }
}`);
    run(mcu, 0.01);
    mcu.sendSerial('21\n');
    run(mcu, 0.05);
    expect(mcu.serialLog).toBe('42\n');
  });

  it('pri chybe za behu sa program zastaví a ukáže riadok', () => {
    const mcu = boot(`
int a[3];
void setup() {}
void loop() {
  for (int i = 0; i <= 3; i++) {
    a[i] = i;
  }
}`);
    run(mcu, 0.01);
    expect(mcu.error).toMatchObject({ line: 6 });
    expect(mcu.error!.message).toContain('mimo poľa');
    const div = boot('int z = 0;\nvoid setup() { int x = 5 / z; }\nvoid loop() {}');
    run(div, 0.01);
    expect(div.error).toMatchObject({ line: 2, message: 'Delenie nulou.' });
  });

  it('chyby pri preklade sú zrozumiteľné a s číslom riadka', () => {
    expect(errorOf('void setup() {\n  pinMode(13, OUTPUT)\n}\nvoid loop() {}')).toEqual({ line: 2, message: 'Chýba bodkočiarka ; na konci príkazu.' });
    expect(errorOf('int ledPin = 13;\nvoid setup() { pinMode(ledpin, OUTPUT); }\nvoid loop() {}')!.message).toContain('Nemyslel si „ledPin“');
    expect(errorOf('void setup() { digitalwrite(13, HIGH); }\nvoid loop() {}')!.message).toContain('digitalWrite');
    expect(errorOf('void setup() {}')!.message).toContain('void loop()');
    expect(errorOf('#include <Keypad.h>\nvoid setup() {}\nvoid loop() {}')).toMatchObject({ line: 1 });
    expect(errorOf('void setup() { int x = "ahoj"; }\nvoid loop() {}')!.message).toContain('Text sa nedá uložiť');
    expect(errorOf('void setup() {\n  if (x > 1) {}\n}\nvoid loop() {}')).toMatchObject({ line: 2 });
    expect(errorOf('void setup() {\n  for (int i = 0; i < 3; i++) {\n}\nvoid loop() {}')!.message).toContain('}');
    const r = compileSketch('int x;\nvoid setup() { if (x = 5) {} }\nvoid loop() {}');
    expect(r.ok && r.program.warnings[0]).toMatchObject({ line: 2 });
  });
});
