async function run() {
  const loginRes = await fetch('http://localhost:3000/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: '20020308' })
  });
  const textLogin = await loginRes.text();
  console.log('Login res:', textLogin);
  const { token } = JSON.parse(textLogin);
  console.log('Token:', token);

  const data = {
    province_id: 'Beijing',
    province_zh: '北京市',
    city_id: 'Beijing',
    city_zh: '北京市',
    band_id: 'test-band',
    name: 'Test Band',
    name_zh: '测试乐队',
    genre: 'Rock',
    intro: 'Test intro',
    image_url: '',
    contact_info: '',
    netease_url: '',
    xiaohongshu_url: ''
  };

  const res = await fetch('http://localhost:3000/api/bands/null', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });

  console.log('STATUS:', res.status);
  const text = await res.text();
  console.log('BODY:', text);
}
run();
