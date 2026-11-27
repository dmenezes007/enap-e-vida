import initiatives from './dei-initiatives.json';

export function isPastInitiative(date: string) {
  return date < new Date().toLocaleDateString('sv-SE', {timeZone: 'America/Sao_Paulo'});
}

export const diversityInitiatives = initiatives;
