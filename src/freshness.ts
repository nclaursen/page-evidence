export const SNAPSHOT_TTL_MS=24*60*60*1000;
export const QUERY_TTL_MS=60*60*1000;

export function freshness(fetchedAt:string|undefined,ttlMs:number,cached:boolean,now=Date.now()){
  const timestamp=Date.parse(fetchedAt||'');
  const ageMs=Number.isFinite(timestamp)?Math.max(0,now-timestamp):null;
  return{fetchedAt:fetchedAt||null,cached,ageSeconds:ageMs===null?null:Math.floor(ageMs/1000),ttlSeconds:ttlMs/1000,expiresAt:Number.isFinite(timestamp)?new Date(timestamp+ttlMs).toISOString():null,stale:ageMs===null||ageMs>=ttlMs};
}
