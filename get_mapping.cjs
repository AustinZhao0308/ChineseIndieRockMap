const https = require('https');

https.get('https://raw.githubusercontent.com/longwosion/geojson-map-china/master/geometryProvince/45.json', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    const json = JSON.parse(data);
    const mapping = {};
    json.features.forEach(f => {
      mapping[f.properties.name] = f.properties.id;
    });
    console.log(JSON.stringify(mapping, null, 2));
  });
});
