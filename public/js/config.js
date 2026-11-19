// Данные магазина (SPEC §3.4). Пустые значения скрывают соответствующий элемент страницы.
// Сейчас стоят заглушки — их заменят ответы владельца (PRD §14).
export default {
  shopName: 'PCSTORE',                       // PRD §14.1, логотип — Syncopate (только латиница)
  phone: '+998000000000',                    // PRD §14.2
  telegram: 'username',                      // без @
  instagram: '',
  address: { ru: 'Ташкент, улица и дом', uz: 'Toshkent, ko‘cha va uy' },
  mapEmbedUrl: '',                           // iframe Яндекс/Google Карт
  hours: { open: '10:00', close: '20:00', days: [1, 2, 3, 4, 5, 6, 7] }, // время Ташкента, 1 — понедельник
  installment: [],                           // например ['Uzum Nasiya', 'Alif'] — PRD §14.3
  delivery: { tashkent: '', regions: '' },   // сроки и стоимость — PRD §14.4
  warranty: '',                              // PRD §14.5
  // PRD §14.9: реальные значения паспорта сборки. Пустые строки — прочерки,
  // null — магазин не выдаёт паспорт, вместо него простой текст.
  passport: { stressHours: '', cpuMaxC: '', gpuMaxC: '', buildWarrantyMonths: '' },
  pixelId: '',                               // PRD §14.7
  legal: { name: '', inn: '' },              // PRD §14.8
  replyMinutes: 15,                          // «свяжемся в течение N минут»
  apiUrl: '/api/lead',
};

export const isDemo = () => location.hostname.endsWith('github.io');
