// Маска телефона +998 (SPEC §7.4). На сервер уходит 998XXXXXXXXX.
export const PREFIX = '+998 ';

// Из любого ввода берём 9 цифр номера после кода страны.
export function digitsOf(value) {
  let d = String(value).replace(/\D/g, '');
  if (d.startsWith('998')) d = d.slice(3);
  if (d.length > 9) d = d.slice(-9);
  return d;
}

export function format(d) {
  let s = PREFIX;
  if (!d) return s;
  s += `(${d.slice(0, 2)}`;
  if (d.length >= 2) s += ') ';
  if (d.length > 2) s += d.slice(2, 5);
  if (d.length > 5) s += `-${d.slice(5, 7)}`;
  if (d.length > 7) s += `-${d.slice(7, 9)}`;
  return s;
}

export const normalize = (value) => {
  const d = digitsOf(value);
  return d.length === 9 ? `998${d}` : '';
};

export function attach(input) {
  const render = (d) => {
    input.value = format(d);
    const end = input.value.length;
    try { input.setSelectionRange(end, end); } catch { /* тип поля без выделения */ }
  };
  input.addEventListener('focus', () => { if (!input.value) render(''); });
  input.addEventListener('blur', () => { if (!digitsOf(input.value)) input.value = ''; });
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Backspace') return;
    const atEnd = input.selectionStart === input.value.length && input.selectionEnd === input.value.length;
    if (!atEnd) return;
    e.preventDefault();
    render(digitsOf(input.value).slice(0, -1));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  input.addEventListener('input', () => render(digitsOf(input.value)));
}
