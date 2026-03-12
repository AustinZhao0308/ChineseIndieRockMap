const https = require('https');
https.get('https://raw.githubusercontent.com/longwosion/geojson-map-china/master/china.json', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    const json = JSON.parse(data);
    const centers = {};
    json.features.forEach(f => {
      centers[f.properties.name] = {
        id: f.properties.id,
        cp: f.properties.cp
      };
    });
    console.log(JSON.stringify(centers, null, 2));
  });
});
