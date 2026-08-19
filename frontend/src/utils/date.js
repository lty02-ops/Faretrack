export function dateFromToday(days){return new Date(Date.now()+days*864e5).toISOString().slice(0,10);}
export const formatDateTime=value=>value?new Date(value).toLocaleString('ko-KR'):'-';
