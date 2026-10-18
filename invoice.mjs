/* GarantiTakip Faz 7 — invoice analysis in the browser. No invoice is sent to our servers.
 * PDF.js worker and optional Tesseract language files are fetched on demand. */
const clean = x => String(x||'').replace(/\u00a0/g,' ').replace(/[ \t]+/g,' ').trim();
export function dateISO(value){
  const raw=String(value||'');
  const iso=raw.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if(iso){const dt=new Date(Date.UTC(+iso[1],+iso[2]-1,+iso[3]));return dt.getUTCFullYear()===+iso[1]&&dt.getUTCMonth()===+iso[2]-1&&dt.getUTCDate()===+iso[3]?iso[0]:'';}
  const m=raw.match(/\b(\d{1,2})[.\-/](\d{1,2})[.\-/](20\d{2})\b/);
  if(!m)return '';
  const d=Number(m[1]),mo=Number(m[2]),y=Number(m[3]);
  const dt=new Date(Date.UTC(y,mo-1,d));
  return dt.getUTCFullYear()===y&&dt.getUTCMonth()===mo-1&&dt.getUTCDate()===d?`${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`:'';
}
function moneyNumber(text){
  let n=String(text||'').replace(/[^\d.,]/g,'');
  if(!n)return null;
  const comma=n.lastIndexOf(','), dot=n.lastIndexOf('.');
  if(comma>=0 && dot>=0)n=comma>dot?n.replace(/\./g,'').replace(',','.'):n.replace(/,/g,'');
  else if(comma>=0)n=n.replace(/\./g,'').replace(',','.');
  else if(dot>=0&&n.length-dot-1===3)n=n.replace(/\./g,'');
  const v=Number(n);
  return Number.isFinite(v)&&v>=0&&v<1e12?v:null;
}
export function parseInvoiceText(raw){
  const text=String(raw||'').replace(/\r/g,'\n');
  const lines=text.split(/\n/).map(clean).filter(Boolean);
  const joined=lines.join('\n');
  const dateLabels=/(?:fatura\s*tarihi|düzenleme\s*tarihi|belge\s*tarihi|invoice\s*date|tarih\s*\/\s*date)/i;
  const dateLine=lines.find(x=>dateLabels.test(x)&&dateISO(x)) || lines.find(x=>dateISO(x)) || '';
  const invoiceLine=lines.find(x=>/(?:fatura\s*(?:no|numara)|belge\s*no|invoice\s*(?:no|number))/i.test(x))||'';
  const invoiceNoMatch=invoiceLine.match(/(?:fatura\s*(?:no(?:su)?|numarası)?|belge\s*no|invoice\s*(?:no|number))\s*[:#\-]?\s*([A-Z0-9\-\/]{5,35})/i);
  const amountLabels=/(?:ödenecek\s*tutar|vergiler\s*dahil\s*toplam|genel\s*toplam|total\s*payable|grand\s*total|toplam\s*tutar|fatura\s*tutarı)/i;
  const amounts=lines.filter(x=>amountLabels.test(x)).map(line=>{
    const matches=[...line.matchAll(/(?:₺|TL|TRY|EUR|USD|GBP|\$|€)?\s*(\d[\d.,]*\d|\d)\s*(?:TL|TRY|₺|EUR|USD|GBP|\$|€)?/gi)];
    const picked=matches.map(m=>({amount:moneyNumber(m[1]),symbol:/EUR|€/i.test(m[0])?'EUR':/USD|\$/i.test(m[0])?'USD':/GBP/i.test(m[0])?'GBP':'TRY'})).filter(a=>a.amount!==null);
    return picked.at(-1)||null;
  }).filter(Boolean);
  const price=amounts.length?amounts[amounts.length-1]:null;
  // Vendor detection is deliberately conservative: do not assign unknown text as a seller.
  const vendorLine=lines.find(x=>/^(?:satıcı|satıcı\s*unvanı|seller|tedarikçi)\s*[:\-]/i.test(x));
  const vendor=vendorLine?clean(vendorLine.replace(/^[^:\-]+[:\-]\s*/,'')):'';
  return {date:dateISO(dateLine),invoiceNo:invoiceNoMatch?.[1]||'',vendor,price:price?.amount??null,currency:price?.symbol||'TRY',characters:joined.length,lines:lines.length};
}
async function textFromPdf(file,{ocr=false}={}){
  const pdfjs=await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';
  const doc=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
  const chunks=[];
  try{
    for(let n=1;n<=Math.min(doc.numPages,3);n++){
      const page=await doc.getPage(n);
      const items=await page.getTextContent({disableNormalization:false});
      const linePieces=[];
      for(const item of items.items){linePieces.push(item.str||'');if(item.hasEOL)linePieces.push('\n');else linePieces.push(' ');}
      chunks.push(linePieces.join(''));
    }
    const result=chunks.join('\n');
    if(result.replace(/\s/g,'').length>=35 || !ocr)return {text:result,method:'pdf-text',pages:Math.min(doc.numPages,3)};
    const page=await doc.getPage(1);
    const viewport=page.getViewport({scale:1.8});
    const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    await page.render({canvasContext:ctx,viewport}).promise;
    const text=await browserOcr(canvas);
    return {text,method:'ocr',pages:1};
  } finally {await doc.destroy();}
}
async function browserOcr(image){
  if(!window.Tesseract){await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';script.onload=resolve;script.onerror=()=>reject(new Error('OCR motoru indirilemedi.'));document.head.appendChild(script);});}
  const worker=await window.Tesseract.createWorker('tur+eng');
  try {const output=await worker.recognize(image);return output?.data?.text||'';} finally {await worker.terminate();}
}
export async function extractInvoice(file,{ocr=false}={}){
  if(!file)throw new Error('Önce PDF seçin.');
  if(file.size>12*1024*1024)throw new Error('Fatura okuma için 12 MB üzerindeki dosyalar desteklenmiyor.');
  const isPDF=file.type==='application/pdf'||/\.pdf$/i.test(file.name);
  if(!isPDF&&!/^image\/(jpeg|png|webp)$/.test(file.type))throw new Error('PDF veya JPG/PNG/WEBP seçin.');
  const detail=isPDF?await textFromPdf(file,{ocr}):{text:await browserOcr(file),method:'ocr',pages:1};
  const data=parseInvoiceText(detail.text);
  if(!detail.text.trim())throw new Error('Belge üzerinde okunabilir metin bulunamadı. Taranmış PDF için OCR seçeneğini deneyin.');
  return {...data,method:detail.method,pages:detail.pages,needsOCR:detail.method==='pdf-text'&&data.characters<35};
}
