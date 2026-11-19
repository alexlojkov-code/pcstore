// ID заявки вида PC-4F7K: без 0/O/1/I, чтобы его было легко продиктовать.
import { randomInt } from 'node:crypto';

const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function newLeadId() {
  let s = '';
  for (let i = 0; i < 4; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return `PC-${s}`;
}

export const LEAD_ID_RE = /^PC-[2-9A-HJ-NP-Z]{4}$/;
