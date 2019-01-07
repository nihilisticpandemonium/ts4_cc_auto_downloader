import util from 'util';

export const sleep = util.promisify(setTimeout);

export type P<T> = T | PromiseLike<T>;

export function formatBytes(a: number, b?: number) {
  if (a === 0) {
    return '0 Bytes';
  }
  const c = 1024;
  const d = b || 2;
  const e = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const f = Math.floor(Math.log(a) / Math.log(c));

  return `${parseFloat((a / Math.pow(c, f)).toFixed(d))} ${e[f]}`;
}

export function titleCase(str: string) {
  const strAry = str.toLowerCase().split('/');
  for (let i = 0; i < strAry.length; i += 1) {
    strAry[i] = strAry[i].charAt(0).toUpperCase() + strAry[i].slice(1);
  }

  return strAry.join('/');
}
