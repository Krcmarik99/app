import { describe, expect, it } from 'vitest';
import { lcdVisible } from '../src/arduino/vm';
import { Simulator, glowLevel, segmentLevel } from '../src/lab/engine';
import { exampleById } from '../src/lab/examples';
import { createPart, type Circuit, type Part } from '../src/lab/parts';

function run(sim: Simulator, seconds: number, chunk = 1 / 60): void {
  for (let t = 0; t < seconds - 1e-12; t += chunk) sim.advance(Math.min(chunk, seconds - t), 100000);
}

function load(id: string): { sim: Simulator; circuit: Circuit; byName: (n: string) => Part; board: Part } {
  const circuit = exampleById(id)!.build();
  const sim = new Simulator(circuit);
  const byName = (n: string) => circuit.parts.find((p) => p.name === n)!;
  return { sim, circuit, byName, board: circuit.parts.find((p) => p.kind === 'arduino')! };
}

const lcdText = (sim: Simulator, part: Part) =>
  lcdVisible(sim.lcds.get(part.id)!).map((row) => row.map((c) => String.fromCharCode(c)).join('').trimEnd());

describe('Arduino v obvode', () => {
  it('blikanie: LED sa zapína a vypína každých 500 ms', () => {
    const { sim, byName } = load('ard-blink');
    const led = byName('LED1');
    run(sim, 0.25);
    const on = sim.states.get(led.id)!.i;
    expect(on).toBeGreaterThan(0.010);
    expect(on).toBeLessThan(0.016);
    run(sim, 0.5);
    expect(Math.abs(sim.states.get(led.id)!.i)).toBeLessThan(1e-6);
    run(sim, 0.5);
    expect(sim.states.get(led.id)!.i).toBeGreaterThan(0.010);
    expect(sim.warnings()).toEqual([]);
    expect(sim.mcus.values().next().value!.error).toBeNull();
  });

  it('tlačidlo s pull-down rezistorom ovláda LED', () => {
    const { sim, byName, board } = load('ard-button');
    const led = byName('LED1');
    const button = byName('S1');
    run(sim, 0.1);
    expect(Math.abs(sim.states.get(led.id)!.i)).toBeLessThan(1e-6);
    sim.setPressed(button.id, true);
    run(sim, 0.05);
    expect(sim.states.get(led.id)!.i).toBeGreaterThan(0.008);
    sim.setPressed(button.id, false);
    run(sim, 0.05);
    expect(Math.abs(sim.states.get(led.id)!.i)).toBeLessThan(1e-6);
    expect(sim.mcus.get(board.id)!.serialLog).toBe('stlačené\npustené\n');
  });

  it('potenciometer: analogRead zodpovedá polohe jazdca', () => {
    const { sim, byName, board } = load('ard-pot');
    const pot = byName('P1');
    sim.setLive(pot.id, 'pos', 80);
    run(sim, 0.5);
    const last = sim.mcus.get(board.id)!.serialLog.trim().split('\n').pop()!;
    const value = Number(/A0 = (\d+)/.exec(last)![1]);
    expect(value).toBeGreaterThan(810);
    expect(value).toBeLessThan(830);
    // LED je napájaná PWM so striedou asi 80 %.
    const led = byName('LED1');
    const bright = glowLevel(led, sim.states.get(led.id), false, true);
    sim.setLive(pot.id, 'pos', 20);
    run(sim, 0.5);
    expect(glowLevel(led, sim.states.get(led.id), false, true)).toBeLessThan(bright / 2);
  });

  it('PWM: priemerný prúd LED je úmerný striede a osciloskop vidí obdĺžnik', () => {
    const circuit = exampleById('ard-fade')!.build();
    const board = circuit.parts.find((p) => p.kind === 'arduino')!;
    board.props.code = 'void setup() { analogWrite(9, 64); }\nvoid loop() {}';
    const sim = new Simulator(circuit);
    run(sim, 0.3);
    const led = circuit.parts.find((p) => p.kind === 'led')!;
    const st = sim.states.get(led.id)!;
    const full = (5 - 1.9) / (220 + 25);
    expect(st.mi / full).toBeGreaterThan(0.2);
    expect(st.mi / full).toBeLessThan(0.3);
    const scope = circuit.parts.find((p) => p.kind === 'scope')!;
    const v2 = sim.traces.get(scope.id)!.samples().map((p) => p.v2);
    expect(Math.max(...v2)).toBeGreaterThan(4.5);
    expect(Math.min(...v2)).toBeLessThan(0.05);
    const high = v2.filter((v) => v > 2.5).length / v2.length;
    expect(high).toBeGreaterThan(0.15);
    expect(high).toBeLessThan(0.4);
  });

  it('LCD displej ukáže text z programu', () => {
    const { sim, byName } = load('ard-lcd');
    run(sim, 1.2);
    const lcd = byName('LCD1');
    expect(lcdText(sim, lcd)).toEqual(['Ahoj, Arduino!', 'Cas: 1 s']);
    expect(sim.lcds.get(lcd.id)!.backlight).toBe(true);
  });

  it('LCD bez pripojeného SDA nič neukáže a program dostane upozornenie', () => {
    const circuit = exampleById('ard-lcd')!.build();
    const lcd = circuit.parts.find((p) => p.kind === 'lcd')!;
    lcd.props.addr = '63';
    const sim = new Simulator(circuit);
    run(sim, 0.3);
    expect(sim.lcds.get(lcd.id)!.initialized).toBe(false);
    const mcu = [...sim.mcus.values()][0];
    expect([...mcu.notes.values()][0].message).toContain('0x27');
  });

  it('servo sa natočí podľa šírky impulzov', () => {
    const circuit = exampleById('ard-servo')!.build();
    const board = circuit.parts.find((p) => p.kind === 'arduino')!;
    board.props.code = '#include <Servo.h>\nServo s;\nvoid setup() { s.attach(9); s.write(30); }\nvoid loop() {}';
    const sim = new Simulator(circuit);
    run(sim, 0.6);
    const servo = circuit.parts.find((p) => p.kind === 'servo')!;
    expect(sim.servoAngle(servo.id)).toBeCloseTo(30, 0);
    expect(sim.states.get(servo.id)!.extra.pulse * 1e6).toBeCloseTo(544 + (1856 * 30) / 180, -1);
  });

  it('bzučiak hrá tón, kým je tlačidlo stlačené', () => {
    const { sim, byName } = load('ard-tone');
    run(sim, 1.2);
    const buzzer = byName('BZ1');
    expect(sim.states.get(buzzer.id)!.extra.snd).toBe(0);
    sim.setPressed(byName('S1').id, true);
    run(sim, 0.2);
    expect(sim.states.get(buzzer.id)!.extra.snd).toBe(1);
    expect(sim.states.get(buzzer.id)!.extra.freq).toBeCloseTo(440, -1);
  });

  it('7-segmentový displej počíta', () => {
    const { sim, byName } = load('ard-seg7');
    const seg = byName('DS1');
    const lit = () => [0, 1, 2, 3, 4, 5, 6].map((k) => segmentLevel(sim.states.get(seg.id), k) > 0.05);
    run(sim, 0.5);
    expect(lit()).toEqual([true, true, true, true, true, true, false]);
    run(sim, 1);
    expect(lit()).toEqual([false, true, true, false, false, false, false]);
    expect(sim.warnings()).toEqual([]);
  });

  it('nočné svetlo zasvieti v tme a teplomer meria teplotu', () => {
    const night = load('ard-ldr');
    run(night.sim, 0.5);
    const led = night.byName('LED1');
    expect(Math.abs(night.sim.states.get(led.id)!.i)).toBeLessThan(1e-6);
    night.sim.setLive(night.byName('R2').id, 'lux', 0.5);
    run(night.sim, 0.5);
    expect(night.sim.states.get(led.id)!.i).toBeGreaterThan(0.005);

    const thermo = load('ard-tmp36');
    run(thermo.sim, 0.7);
    const mcu = thermo.sim.mcus.get(thermo.board.id)!;
    const t = Number(/Teplota: (-?[\d.]+)/.exec(mcu.serialLog)![1]);
    expect(t).toBeGreaterThan(21);
    expect(t).toBeLessThan(23);
    expect(mcu.outputLevel(13)).toBe(0);
    thermo.sim.setLive(thermo.byName('U2').id, 'temp', 35);
    run(thermo.sim, 0.7);
    expect(mcu.outputLevel(13)).toBe(1);
  });

  it('RGB LED mieša farby', () => {
    const { sim, byName } = load('ard-rgb');
    run(sim, 0.5);
    const led = byName('LED1');
    const st = sim.states.get(led.id);
    expect(segmentLevel(st, 0)).toBeGreaterThan(0.3);
    expect(segmentLevel(st, 1)).toBeLessThan(0.01);
    run(sim, 1);
    expect(segmentLevel(sim.states.get(led.id), 1)).toBeGreaterThan(0.3);
    expect(sim.warnings()).toEqual([]);
  });

  it('varuje pri LED bez rezistora a pri nepripojenom vstupe', () => {
    const circuit: Circuit = { parts: [], wires: [] };
    const board = createPart(circuit, 'arduino', 6, 14, {
      code: 'void setup() { pinMode(13, OUTPUT); digitalWrite(13, HIGH); pinMode(2, INPUT); Serial.begin(9600); }\nvoid loop() { Serial.println(digitalRead(2)); delay(10); }',
    });
    circuit.parts.push(board);
    const led = createPart(circuit, 'led', 7, 11, { color: 'red' }, 3);
    circuit.parts.push(led);
    circuit.wires.push({ id: 'w1', a: [7, 14], b: [7, 11] }, { id: 'w2', a: [7, 8], b: [6, 8] }, { id: 'w3', a: [6, 8], b: [6, 14] });
    const sim = new Simulator(circuit);
    run(sim, 0.3);
    const texts = sim.warnings().map((w) => w.text).join('\n');
    expect(texts).toContain('LED sa zničí');
    expect(texts).toContain('40 mA');
    const mcu = sim.mcus.get(board.id)!;
    expect([...mcu.notes.values()].map((n) => n.message).join(' ')).toContain('pláva');
  });

  it('program beží ďalej po zmene zapojenia a nový sa dá nahrať', () => {
    const { sim, circuit, board } = load('ard-blink');
    run(sim, 0.7);
    const mcu = sim.mcus.get(board.id)!;
    const next = new Simulator(circuit, sim.exportState());
    expect(next.mcus.get(board.id)).toBe(mcu);
    run(next, 0.1);
    expect(mcu.time).toBeGreaterThan(0.79);
    const bad = next.upload(board.id, 'void setup() {\n  x = 1;\n}\nvoid loop() {}');
    expect(bad.ok).toBe(false);
    const ok = next.upload(board.id, 'void setup() { Serial.begin(9600); Serial.print("nový"); }\nvoid loop() {}');
    expect(ok.ok).toBe(true);
    run(next, 0.1);
    expect(mcu.serialLog).toBe('nový');
    expect(mcu.outputLevel(13)).toBeNull();
  });
});
