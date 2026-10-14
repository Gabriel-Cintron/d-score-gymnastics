/** Run candidate ranking in the protected owner browser, not on the Free Worker CPU budget. */
export const aliasScript = String.raw`
(()=>{
 const normalize=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 function distance(a,b){let row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const next=[i];for(let j=1;j<=b.length;j++)next[j]=Math.min(next[j-1]+1,row[j]+1,row[j-1]+(a[i-1]===b[j-1]?0:1));row=next;}return row[b.length];}
 function suggest(terms,evidence,catalog){
  const prepared=catalog.map(e=>({...e,terms:[e.name,...e.aliases].map(normalize)}));
  return terms.filter(t=>t.no_match>0).map(t=>{
   const known=prepared.some(e=>e.terms.includes(t.term));
   const candidates=prepared.map(e=>{const d=Math.min(...e.terms.map(n=>distance(t.term,n)));const proof=evidence.find(p=>p.term===t.term&&p.target===e.id);return {id:e.id,name:e.name,distance:d,contributors:proof?.contributors??0,reformulations:proof?.reformulations??0};}).filter(e=>e.reformulations>0||e.distance<=Math.max(1,Math.min(3,Math.floor(t.term.length/4)))).sort((a,b)=>b.contributors-a.contributors||b.reformulations-a.reformulations||a.distance-b.distance||a.id.localeCompare(b.id)).slice(0,5);
   return {...t,known,priority:t.contributors>=3?'repeated':'early observation',candidates};
  }).sort((a,b)=>b.contributors-a.contributors||b.no_match-a.no_match);
 }
 globalThis.DScoreAliases={suggest};
})();
`;
