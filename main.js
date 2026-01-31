const regionSelect = document.getElementById('regionSelect');
const cuisineSelect = document.getElementById('cuisineSelect');
const drawButton = document.getElementById('drawButton');
const list = document.getElementById('list');
const resultCard = document.getElementById('resultCard');
const resultBadge = document.getElementById('resultBadge');
const csvPreview = document.getElementById('csvPreview');

const mockCsvByDong = {
  '서울 성수동': `photo,name,hours,address
https://picsum.photos/seed/seongsu1/500/400,스튜디오덮밥,11:00-21:00,https://maps.example.com/seongsu1
https://picsum.photos/seed/seongsu2/500/400,굽네로스터리,12:00-22:00,https://maps.example.com/seongsu2
https://picsum.photos/seed/seongsu3/500/400,온기분식,10:30-20:30,https://maps.example.com/seongsu3
https://picsum.photos/seed/seongsu4/500/400,브릭카페,09:00-22:00,https://maps.example.com/seongsu4
https://picsum.photos/seed/seongsu5/500/400,성수우동,11:00-20:00,https://maps.example.com/seongsu5`,
  '서울 연남동': `photo,name,hours,address
https://picsum.photos/seed/yeonnam1/500/400,연남키친,11:30-21:30,https://maps.example.com/yeonnam1
https://picsum.photos/seed/yeonnam2/500/400,바질파스타룸,12:00-22:00,https://maps.example.com/yeonnam2
https://picsum.photos/seed/yeonnam3/500/400,연남초밥,11:00-21:00,https://maps.example.com/yeonnam3
https://picsum.photos/seed/yeonnam4/500/400,도토리식당,10:30-20:30,https://maps.example.com/yeonnam4
https://picsum.photos/seed/yeonnam5/500/400,연남차집,09:00-21:00,https://maps.example.com/yeonnam5`,
  '부산 전포동': `photo,name,hours,address
https://picsum.photos/seed/jeonpo1/500/400,전포국밥,10:00-22:00,https://maps.example.com/jeonpo1
https://picsum.photos/seed/jeonpo2/500/400,카츠하우스,11:30-21:00,https://maps.example.com/jeonpo2
https://picsum.photos/seed/jeonpo3/500/400,전포만두,11:00-20:00,https://maps.example.com/jeonpo3
https://picsum.photos/seed/jeonpo4/500/400,웨이브카페,09:00-22:00,https://maps.example.com/jeonpo4
https://picsum.photos/seed/jeonpo5/500/400,바다짬뽕,11:00-21:30,https://maps.example.com/jeonpo5`,
  '대구 동성로': `photo,name,hours,address
https://picsum.photos/seed/dg1/500/400,동성갈비,11:00-22:00,https://maps.example.com/dg1
https://picsum.photos/seed/dg2/500/400,마라하우스,12:00-23:00,https://maps.example.com/dg2
https://picsum.photos/seed/dg3/500/400,동성카페밀,09:00-21:00,https://maps.example.com/dg3
https://picsum.photos/seed/dg4/500/400,대구분식,10:30-20:30,https://maps.example.com/dg4
https://picsum.photos/seed/dg5/500/400,스시노트,11:30-21:30,https://maps.example.com/dg5`,
  '제주 애월읍': `photo,name,hours,address
https://picsum.photos/seed/aewol1/500/400,애월해녀밥상,10:30-20:30,https://maps.example.com/aewol1
https://picsum.photos/seed/aewol2/500/400,바람빵집,09:00-19:00,https://maps.example.com/aewol2
https://picsum.photos/seed/aewol3/500/400,오션파스타,11:00-21:00,https://maps.example.com/aewol3
https://picsum.photos/seed/aewol4/500/400,돌담카페,10:00-22:00,https://maps.example.com/aewol4
https://picsum.photos/seed/aewol5/500/400,흑돼지스테이,12:00-22:00,https://maps.example.com/aewol5`
};

const cuisineByName = {
  스튜디오덮밥: '한식',
  굽네로스터리: '양식',
  온기분식: '분식',
  브릭카페: '카페',
  성수우동: '일식',
  연남키친: '한식',
  바질파스타룸: '양식',
  연남초밥: '일식',
  도토리식당: '한식',
  연남차집: '카페',
  전포국밥: '한식',
  카츠하우스: '일식',
  전포만두: '중식',
  웨이브카페: '카페',
  바다짬뽕: '중식',
  동성갈비: '한식',
  마라하우스: '중식',
  동성카페밀: '카페',
  대구분식: '분식',
  스시노트: '일식',
  애월해녀밥상: '한식',
  바람빵집: '카페',
  오션파스타: '양식',
  돌담카페: '카페',
  흑돼지스테이: '한식'
};

const cuisineOptions = ['한식', '일식', '중식', '양식', '카페', '분식'];

const parseCsv = (csv) => {
  const [headerLine, ...lines] = csv.trim().split('\n');
  const headers = headerLine.split(',');
  return lines.map((line) => {
    const values = line.split(',');
    const item = {};
    headers.forEach((header, index) => {
      item[header.trim()] = (values[index] || '').trim();
    });
    item.cuisine = cuisineByName[item.name] || '기타';
    return item;
  });
};

const renderList = (items) => {
  list.innerHTML = '';
  if (items.length === 0) {
    list.innerHTML = '<p class="muted">선택한 조건에 맞는 맛집이 없습니다.</p>';
    return;
  }

  items.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'card';
    card.innerHTML = `
      <img src="${item.photo}" alt="${item.name}" loading="lazy" />
      <div class="card-body">
        <h4>${item.name}</h4>
        <p class="muted">${item.cuisine} · ${item.hours}</p>
        <a href="${item.address}" target="_blank" rel="noopener noreferrer">지도 열기</a>
      </div>
    `;
    list.appendChild(card);
  });
};

const renderResult = (item) => {
  if (!item) {
    resultCard.className = 'result-card empty';
    resultCard.innerHTML = '<p>조건에 맞는 맛집이 없어요. 다른 필터를 선택해 주세요.</p>';
    resultBadge.textContent = '대기 중';
    return;
  }

  resultCard.className = 'result-card';
  resultCard.innerHTML = `
    <img src="${item.photo}" alt="${item.name}" />
    <div>
      <h4>${item.name}</h4>
      <div class="meta">
        <span>카테고리: ${item.cuisine}</span>
        <span>영업시간: ${item.hours}</span>
        <a href="${item.address}" target="_blank" rel="noopener noreferrer">가게 주소 열기</a>
      </div>
    </div>
  `;
  resultBadge.textContent = '추첨 완료';
};

const getFilteredItems = () => {
  const region = regionSelect.value;
  const cuisine = cuisineSelect.value;
  const csv = mockCsvByDong[region];
  if (!csv) return [];
  const items = parseCsv(csv);
  if (!cuisine) return items;
  return items.filter((item) => item.cuisine === cuisine);
};

const updateCsvPreview = () => {
  const region = regionSelect.value;
  csvPreview.textContent = mockCsvByDong[region] || 'CSV 없음';
};

const handleDraw = () => {
  const items = getFilteredItems();
  if (items.length === 0) {
    renderResult(null);
    return;
  }
  const randomIndex = Math.floor(Math.random() * items.length);
  renderResult(items[randomIndex]);
};

const init = () => {
  Object.keys(mockCsvByDong).forEach((region) => {
    const option = document.createElement('option');
    option.value = region;
    option.textContent = region;
    regionSelect.appendChild(option);
  });

  cuisineOptions.forEach((cuisine) => {
    const option = document.createElement('option');
    option.value = cuisine;
    option.textContent = cuisine;
    cuisineSelect.appendChild(option);
  });

  regionSelect.value = Object.keys(mockCsvByDong)[0];
  updateCsvPreview();

  const items = getFilteredItems();
  renderList(items);
  renderResult(null);
};

regionSelect.addEventListener('change', () => {
  updateCsvPreview();
  renderList(getFilteredItems());
  renderResult(null);
});

cuisineSelect.addEventListener('change', () => {
  renderList(getFilteredItems());
  renderResult(null);
});

drawButton.addEventListener('click', handleDraw);

init();
