// Краткое описание устройства по User-Agent: «Телефон, iOS / Safari».
export function describeUA(ua = '') {
  const s = String(ua);

  let device = 'ПК';
  if (/iPad|Tablet/i.test(s) || (/Android/i.test(s) && !/Mobile/i.test(s))) device = 'Планшет';
  else if (/Mobi|iPhone|iPod|Android/i.test(s)) device = 'Телефон';

  let os = '';
  if (/iPhone|iPad|iPod/i.test(s)) os = 'iOS';
  else if (/Android/i.test(s)) os = 'Android';
  else if (/Windows/i.test(s)) os = 'Windows';
  else if (/Macintosh|Mac OS X/i.test(s)) os = 'macOS';
  else if (/Linux|X11/i.test(s)) os = 'Linux';

  let browser = '';
  if (/Instagram/i.test(s)) browser = 'Instagram';
  else if (/FBAN|FBAV|FB_IAB/i.test(s)) browser = 'Facebook';
  else if (/Telegram/i.test(s)) browser = 'Telegram';
  else if (/YaBrowser/i.test(s)) browser = 'Яндекс Браузер';
  else if (/SamsungBrowser/i.test(s)) browser = 'Samsung Internet';
  else if (/EdgA?\/|EdgiOS/i.test(s)) browser = 'Edge';
  else if (/OPR\/|Opera|OPT\//i.test(s)) browser = 'Opera';
  else if (/Firefox|FxiOS/i.test(s)) browser = 'Firefox';
  else if (/CriOS|Chrome\//i.test(s)) browser = 'Chrome';
  else if (/Safari\//i.test(s)) browser = 'Safari';

  if (!os && !browser && !s) return '—';
  return `${device}, ${os || '—'} / ${browser || '—'}`;
}
