const https = require('https');
https.get('https://raw.githubusercontent.com/longwosion/geojson-map-china/master/china.json', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    const json = JSON.parse(data);
    console.log(JSON.stringify(json.features[0].properties, null, 2));
  });
});
