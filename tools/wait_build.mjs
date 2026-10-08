// Ждёт обработки сборки и добавляет тестировщиков во внутреннюю группу.
import { asc } from './asc.mjs';
const APP = process.argv[2], GROUP = process.argv[3], TESTERS = process.argv.slice(4);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 60; i++) {
  const r = await asc('GET', `/v1/builds?filter[app]=${APP}&fields[builds]=version,processingState&sort=-uploadedDate&limit=1`);
  const b = r.data?.data?.[0];
  console.log(new Date().toISOString(), b ? `${b.attributes.version} ${b.attributes.processingState}` : 'нет сборки');
  if (b && b.attributes.processingState === 'VALID') {
    const t = await asc('POST', `/v1/betaGroups/${GROUP}/relationships/betaTesters`, { data: TESTERS.map((id) => ({ type: 'betaTesters', id })) });
    console.log('testers', t.status, JSON.stringify(t.data).slice(0, 300));
    const g = await asc('GET', `/v1/betaGroups/${GROUP}/builds?fields[builds]=version`);
    console.log('group builds', JSON.stringify(g.data?.data?.map((x) => x.attributes.version)));
    process.exit(0);
  }
  if (b && b.attributes.processingState === 'INVALID') { console.log('INVALID'); process.exit(2); }
  await sleep(30000);
}
process.exit(1);
