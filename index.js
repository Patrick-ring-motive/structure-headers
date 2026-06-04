const fetchResponse = async (...args) => {
    try {
        return await fetch(...args);
    } catch (e) {
        return new Response(String(e), {
            status: 500,
            statusText: String(e)
        });
    }
};

function tryParse(x){
  try{
    return JSON.parse(x);
  }catch{
    if(!x)return x;
    try{
      const y = JSON.parse('['+x+']');
      if(y.length)return y;
      return x;
    }catch{
      try{
        return JSON.parse('{'+x+'}');
      }catch{
        return x;
      }
    }
  }
}

const tryDecode = x =>{
  const y = x;
  try{
    x = decodeURIComponent(x).trim();
  }catch{}
  try{
    x = decodeURI(x).trim();
  }catch{}
  return x;
};

const tryParams = x =>{
  try{
    const params = new URLSearchParams(x);
    if((params.size || params.size?.())&&[...params.entries()].flat().every(Boolean)){
      return Object.fromEntries([...params.entries()]);
    }
  }catch{
    return x;
  }
};

const cap = x =>{
  const head = String(x.match(/^[^a-zA-Z]*[a-zA-Z]/)?.[0] ?? x?.[0]);
  return head.toUpperCase()+x.replace(head,'').toLowerCase();
}

const isObject = x => typeof x === 'object' && x !== null;
const unquote = x => String(x).replace(/^[\s'"`“”‘’:\\]+|[\s'"`“”‘’:\\]+$/g,'');


function namespaceHeaders(headers) {
  if(Array.isArray(headers) || !isObject(headers))return headers;
  const result = {};

  for (const [key, value] of Object.entries(headers)) {
    const parts = key.toLowerCase().split(/[-_ ]+/).map(unquote).filter(Boolean);
   
    if (parts.length === 1) {
      result[cap(parts[0])] = value;
      continue;
    }

    let current = result;

    for (let i = 0; i < parts.length - 1; i++) {
      current = current[parts[i]] ??= {};
    }

    current[cap(parts.at(-1))] = value;
  }

  return result;
}

function namespaceValue(str) {
  if(typeof str !== 'string')return str;
const result = {};
  const parts = str.toLowerCase().split(/[-_ \/]+/).map(unquote).filter(Boolean);
  if (parts.length === 1) {
    return str;
  }

  let current = result;

  for (let i = 0; i < parts.length - 2; i++) {
    current = current[parts[i]] ??= {};
  }

  current[cap(parts.at(-2))] = parts.at(-1);

  return result;
}

const tryBase64 = x =>{
  try{
    const str = atob(String(x));
    if(new TextEncoder().encode(str).length === str.length && !/[\x00-\x08\x0E-\x1F\x7F]/.test(str)){
      return atob(x).trim();
    }
  }catch{}
  return x;
};Number.isInteger('')


const trim = x => String(x).trim();
const isKV = (x,sep) =>(x?.split?.(sep)?.length > 1 && !/https?$|(^|\s)wss?$/.test(x?.split?.(sep)?.[0]) && x?.split?.(sep)?.map?.(unquote).filter(Boolean)?.length > 1);
const isPolicyKV = x =>(x?.split?.(/\s+/)?.map?.(unquote)?.filter?.(Boolean)?.length > 1);
const strsToObj = (x,sep) =>Object.fromEntries(x.map(x=>{
  const entry = x.split(sep).map(unquote);
  return [entry.shift(),entry.filter(Boolean).join(sep)];
}));
function struct(value,key){
      if(/^(date|expires?|.*\bmodified|created|updated)$/i.test(key))return value;
      for(const fn of [tryBase64,tryParse,tryDecode]){
        if(typeof value === 'string'){
          value = fn(value);
        }
      }

      if(typeof value === 'string'){
        for(const delim of [';',',',/[;,]/]){
          if(delim?.test?.(value) || value?.includes?.(String(delim))){
            value = value.split(delim).map(unquote).filter(Boolean);
            break;
          }
        }
      }
      const seperators = ['=',':',/[:=]/];
      if(Array.isArray(value)){
        if(/content-security-policy/i.test(key)){
          if(value?.every?.(isPolicyKV)){
            value = strsToObj(value,' ');
            for(const pol in value){
              value[pol] = value[pol].split(/\s+/).map(unquote).filter(Boolean);
            }
          }
          if(value?.some?.(isPolicyKV)){
           const entries = value.filter(isPolicyKV);
            const obj = strsToObj(entries,' ');
            value = value.filter(x=>!isPolicyKV(x)).map(unquote).filter(Boolean);
            for(const pol in obj){
              obj[pol] = obj[pol].split(/\s+/).map(unquote).filter(Boolean);
            }
            value.push(obj);
          }
        }
        for(const sep of seperators){
          if(value?.every?.(x=>isKV(x,sep))){
            value = strsToObj(value,sep);
            break;
          }
        }
        for(const sep of seperators){
          if(value?.some?.(x=>isKV(x,sep))){
            const entries = value.filter(x=>isKV(x,sep));
            let obj = strsToObj(entries,sep);
            value = value.filter(x=>!isKV(x,sep));
            value.push(obj);
            break;
          }
        }
      }
      if(typeof value === 'string'){
        for(const sep of seperators){
          if(isKV(value,sep)){
            value = strsToObj([value],sep);
            break;
          }
        }
      }
      if(isObject(value) && !Array.isArray(value)){
        const keys = Object.keys(value);
        if(String(keys.sort()) === String([...keys.keys()].sort())){
          value = [...Object.values(value)].map(restruct);
        }
      }
      return restruct(value);
}
const sym = Symbol('arr');
function restruct(obj){
  if(typeof obj === 'string')return unquote(obj);
  if(Array.isArray(obj)){
    if(obj.length === 1){
      return restruct(obj[0]);
    }
    const arr = obj.map(restruct);
    if(arr.some(isObject) && !arr.every(isObject) && !obj[sym]){
        const newArr = arr.filter(isObject).map(x=>Array.isArray(x)?x:Object.entries(x)).flat();
        if(newArr.every(x=>(Array.isArray(x)&&x?.length === 2))){
          const newObj = Object.fromEntries(newArr);
          if(Object.entries(newObj).length === newArr.length){
            const notObj = arr.filter(x=>!isObject(x));
            const vals = notObj.map(namespaceValue);
            const res = [];
            for(const v of vals){
              if(!isObject(v)){
                res.push(v);
              }else{
                for(const key in v){
                  newObj[key] = v[key]; 
                }
              }
            }
            res.push(newObj);
			      res[sym]=true;
            if(res.length ===1)return restruct(res[0])
            return restruct(res);
          }
        }
    }
    if(arr.every(isObject)){
      const newArr = arr.map(x=>Array.isArray(x)?x:Object.entries(x)).flat();
        if(newArr.every(x=>(Array.isArray(x)&&x?.length === 2))){
          const newObj = Object.fromEntries(newArr);
          if(Object.entries(newObj).length === newArr.length){
            return restruct(newObj);
          }
        }
      }
    return arr;
  }
  if(!isObject(obj))return obj;
  for(const k in obj){
    obj[k] = struct(obj[k],k);
  }
  return namespaceHeaders(obj);
}

function structureHeaders(headers){
    const headObj = Object.fromEntries(headers.entries());
    if(headers.has('Set-Cookie')){
      headObj['Set-Cookie'] = headers.getAll('Set-Cookie');
    }
    for(const Cookie of ['Cookie','Set-Cookie']){
      if(Array.isArray(headObj[Cookie])){
        const cookies = [];
        for(const cookie of headObj[Cookie]){
          cookies.push(struct(cookie));
        }
        headObj[Cookie] = cookies;
      }
    }
    for(const key in headObj){
      headObj[key] = struct(headObj[key],key);
    }
    for(const Cookie of ['Cookie','Set-Cookie']){
      if(Array.isArray(headObj[Cookie])){
        const cookies = [];
        for(const cookie of headObj[Cookie]){
          cookies.push(struct(cookie));
        }
        headObj[Cookie] = cookies;
      }
    }
    return namespaceHeaders(headObj);
}

export default {
  async fetch(request, env, ctx) {
    const reqURL = new URL(request.url);
    let headers = request.headers;
    const url = reqURL.searchParams.get('url');
    if(url){
      const res = await fetchResponse(url);
      headers = res.headers
    }

    const headObj = structureHeaders(headers);

    return new Response(JSON.stringify(headObj,null,2));
  }
};
