import moment from 'moment';

export const TIME_FORMAT = 'YYYY-MM-DD';
const firstDateString = '2014-09-06';
export const TSR_FIRST_DATE = moment(firstDateString, TIME_FORMAT);
const petsFirstDateString = '2017-11-10';
export const TSR_PETS_FIRST_DATE = moment(petsFirstDateString, TIME_FORMAT);
export const now = moment();

// TSR constants
export const TSR_AJAX_BASE_URL =
  'http://thesimsresource.com/ajax.php?c=downloads&a=getdownloadurl&ajax=1&itemid=';
export const TSR_AJAX_URL_EXT = '&mid=0&lk=0';
export const FILENAME_REGEX = /([^/]+$)/;

export type P<T> = T | PromiseLike<T> | undefined;
