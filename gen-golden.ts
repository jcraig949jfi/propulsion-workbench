import { calculatePropulsion } from './src/model/calculatePropulsion';
import { SEED_MOTORS, SEED_BATTERIES, SEED_PROPELLERS } from './src/data/hardware';
import { writeFileSync } from 'node:fs';
const combos: Array<[string,string,string]> = [];
for (const m of ['example-500kv-outrunner','example-700kv-outrunner','example-1000kv-outrunner'])
  for (const b of ['lipo-3s-2200','lipo-4s-5000','lipo-6s-5000'])
    for (const p of ['apc-10x5e','apc-12x6e','apc-13x6.5e','apc-15x10e'])
      combos.push([m,b,p]);
const cases = [];
for (const [motorId,batteryId,propellerId] of combos) {
  const motor = SEED_MOTORS.find(x=>x.id===motorId)!;
  const battery = SEED_BATTERIES.find(x=>x.id===batteryId)!;
  const propeller = SEED_PROPELLERS.find(x=>x.id===propellerId)!;
  if(!motor||!battery||!propeller){ console.error('MISSING',motorId,batteryId,propellerId); continue; }
  const r = calculatePropulsion({motor,battery,propeller});
  if(!r.diagnostics.converged) continue;
  cases.push({motorId,batteryId,propellerId,rpm:r.rpm,thrustN:r.thrustN,currentA:r.currentA,inputPowerW:r.inputPowerW});
}
writeFileSync('src/model/fixtures/golden-master.json', JSON.stringify({
  $comment: [
    "GOLDEN MASTER — outputs of THIS engine, committed so that any future change to the numbers",
    "is caught by the test suite.",
    "",
    "These values were produced BY the engine. They prove the implementation has not drifted.",
    "They are NOT evidence that the model is physically correct — treating them that way would",
    "be circular. Physical validation comes from bench measurements only.",
    "",
    "Regenerate deliberately, and only when you MEANT to change the model:",
    "  npx tsx gen-golden.ts"
  ],
  generatedBy: "gen-golden.ts",
  cases
}, null, 1), 'utf-8');
console.log('wrote', cases.length, 'golden cases');
