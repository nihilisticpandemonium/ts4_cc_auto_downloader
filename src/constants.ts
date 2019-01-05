import moment from 'moment';

export const time_format = "YYYY-MM-DD";
export const first_date_string = "2014-09-06";
export const first_date = moment(first_date_string, time_format);
export const pets_first_date_string = "2017-11-10";
export const pets_first_date = moment(pets_first_date_string, time_format);
export const now = moment();

// TSR constants
export const tsr_ajax_base_url = 'http://thesimsresource.com/ajax.php?c=downloads&a=getdownloadurl&ajax=1&itemid=';
export const tsr_ajax_ext = '&mid=0&lk=0';
export const f_n_regex = /([^/]+$)/;

