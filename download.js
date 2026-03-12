import fs from 'fs';
fetch('https://cdn.jsdelivr.net/gh/longwosion/geojson-map-china@master/china.json')
  .then(r => r.text())
  .then(t => {
    fs.mkdirSync('public', { recursive: true });
    fs.writeFileSync('public/china.json', t);
    console.log('done');
  });
