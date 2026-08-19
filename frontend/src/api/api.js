export async function api(path,options={}){const response=await fetch(path,{headers:{'Content-Type':'application/json'},...options});if(!response.ok){const error=await response.json().catch(()=>({}));throw new Error(error.error||'요청을 처리하지 못했습니다.');}return response.status===204?null:response.json();}
export const searchFlights=query=>api('/api/flights/search',{method:'POST',body:JSON.stringify(query)});
export const createAlert=payload=>api('/api/alerts',{method:'POST',body:JSON.stringify(payload)});
export const getAlerts=()=>api('/api/alerts');
export const updateAlert=(id,patch)=>api(`/api/alerts/${id}`,{method:'PATCH',body:JSON.stringify(patch)});
export const deleteAlert=id=>api(`/api/alerts/${id}`,{method:'DELETE'});
export const runPriceCheck=()=>api('/internal/price-check',{method:'POST'});
