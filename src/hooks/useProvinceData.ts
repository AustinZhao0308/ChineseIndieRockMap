import { useEffect, useState } from 'react';
import { provinceData as initialProvinceData, Province } from '../data';

const normalizeName = (name: string) => {
  if (!name) return name;
  return name.replace(/(省|市|维吾尔自治区|壮族自治区|回族自治区|自治区|特别行政区|自治州|地区|盟)$/, '');
};

export function useProvinceData() {
  const [data, setData] = useState<Record<string, Province>>(initialProvinceData);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/bands').then(res => res.json()),
      fetch('/api/venues').then(res => res.json())
    ])
      .then(([bands, venues]) => {
        // Deep clone initial data to avoid mutating the original static object
        const newData = JSON.parse(JSON.stringify(initialProvinceData));
        
        // Clear existing bands and venues in the cloned data to replace with DB data
        Object.values(newData).forEach((prov: any) => {
          prov.cities.forEach((city: any) => {
            city.bands = [];
            city.venues = [];
          });
        });

        // Process Bands
        bands.forEach((b: any) => {
          const provId = normalizeName(b.province_zh);
          const cityZh = normalizeName(b.city_zh);
          
          if (!newData[provId]) {
            newData[provId] = {
              id: b.province_id,
              name: b.province_id,
              name_zh: provId,
              cities: []
            };
          }
          
          let city = newData[provId].cities.find((c: any) => c.name_zh === cityZh);
          if (!city) {
            city = {
              name: b.city_id,
              name_zh: cityZh,
              bands: [],
              venues: []
            };
            newData[provId].cities.push(city);
          }

          city.bands.push({
            id: b.band_id,
            name: b.name,
            name_zh: b.name_zh,
            genre: b.genre,
            intro: b.intro,
            city: b.city_id,
            city_zh: cityZh,
            imageUrl: b.image_url,
            contactInfo: b.contact_info,
            neteaseUrl: b.netease_url,
            xiaohongshuUrl: b.xiaohongshu_url,
            dbId: b.id
          });
        });

        // Process Venues
        venues.forEach((v: any) => {
          const provId = normalizeName(v.province_zh);
          const cityZh = normalizeName(v.city_zh);
          
          if (!newData[provId]) {
            newData[provId] = {
              id: v.province_id,
              name: v.province_id,
              name_zh: provId,
              cities: []
            };
          }
          
          let city = newData[provId].cities.find((c: any) => c.name_zh === cityZh);
          if (!city) {
            city = {
              name: v.city_id,
              name_zh: cityZh,
              bands: [],
              venues: []
            };
            newData[provId].cities.push(city);
          }

          if (!city.venues) city.venues = [];
          
          city.venues.push({
            id: v.venue_id,
            name: v.name,
            name_zh: v.name_zh,
            address: v.address,
            capacity: v.capacity,
            intro: v.intro,
            city: v.city_id,
            city_zh: cityZh,
            imageUrl: v.image_url,
            contactInfo: v.contact_info,
            ticketUrl: v.ticket_url,
            dbId: v.id
          });
        });

        setData(newData);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch data:", err);
        setLoading(false);
      });
  }, []);

  return { data, loading };
}
