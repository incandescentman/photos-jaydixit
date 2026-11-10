from pathlib import Path
import urllib.request,re,html,json,hashlib,subprocess
root=Path(__file__).resolve().parents[1]
# Initial candidate acquisition only. Final visual decisions live in comparison-manifest.json.
if (root/'comparison-manifest.json').exists():
 raise SystemExit('Refusing to overwrite visually reviewed comparison-manifest.json')
images=[];pairs=[]
def add(url,group,key,lens,notes,page,photographer):
 p=root/'comparisons'/group/(key+'.jpg');p.parent.mkdir(parents=True,exist_ok=True)
 if not p.exists(): p.write_bytes(urllib.request.urlopen(url,timeout=30).read())
 ex=json.loads(subprocess.check_output(['exiftool','-j','-n','-LensModel','-LensID','-FNumber','-Model','-ExposureTime','-ISO','-FocalLength','-DateTimeOriginal','-ImageWidth','-ImageHeight','-Software',str(p)]))[0];ex.pop('SourceFile',None)
 im={'id':group+'-'+key,'path':str(p.relative_to(root)),'lens':lens,'aperture':'f/1.4','width':ex['ImageWidth'],'height':ex['ImageHeight'],'sourcePage':page,'imageUrl':url,'photographer':photographer,'verification':'EXIF aperture; lens identified by source labels and EXIF' if ex.get('FNumber')==1.4 else 'Source-reported lens and aperture; EXIF unavailable or incomplete','notes':notes,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'exif':ex}
 images.append(im);return im['id']
page='https://phillipreeve.net/blog/review-sony-fe-85mm-1-4-gm-mk-ii-a-worthy-update/'
s=urllib.request.urlopen(page).read().decode()
for n,scene in [(1,'Forest 4.0 m'),(2,'Forest 4.7 m'),(3,'Forest 4.5 m'),(6,'City lights 2.3 m'),(7,'City lights 5.3 m')]:
 p=s.rfind('id="Scene_'+str(n)+'_');chunk=s[p:s.find('<h4',p+1)]
 urls=list(dict.fromkeys(re.findall(r'src="(https://[^\"]+\.jpg)"',chunk)))
 a=next(u for u in urls if '_GMII_uncropped' in u);b=next(u for u in urls if re.search('_GMI?.jpg$',u))
 group='reeve-'+scene.lower().replace(' ','-').replace('.','p')
 notes='Same-scene comparison published by Bastian Kratzke; Sony A7 III, f/1.4, stated focus distance '+scene.split()[-2]+' m. GM II has a wider field of view. These are the largest uncropped full-frame exports linked for this test (800 px), not full-resolution camera originals. Processing/exposure and precise camera position not fully documented; inspect differences cautiously.'
 ids=[add(a,group,'sony-85-gm-ii','Sony FE 85mm f/1.4 GM II',notes,page,'Bastian Kratzke'),add(b,group,'sony-85-gm','Sony FE 85mm f/1.4 GM',notes,page,'Bastian Kratzke')]
 pairs.append({'id':group,'title':scene+' — GM II / original GM','kind':'matched','quality':'Approximate match','images':ids,'notes':notes})
page='https://sonyalpha.blog/2024/09/30/sony-fe-85mm-f1-4-gm-ii/'
s=Path('/tmp/bokeh-sonyalpha.html').read_text()
figs=[]
for m in re.finditer(r'<figure\b.*?</figure>',s,re.S):
 f=m[0]; c=re.search(r'<figcaption.*?>(.*?)</figcaption>',f,re.S);cap=html.unescape(re.sub('<[^>]+>','',c[1])).strip() if c else ''
 urls=re.findall(r'(?:href|src)="([^"]+)"',f)
 if urls:figs.append((cap,html.unescape(urls[0])))
for group,title,ca,cb in [('alhadeff-lights','Indoor lights — Sigma / GM II','Sigma 85mm F1.4 DG DN','Sony FE 85mm f1.4 GM II @F1.4'),('alhadeff-portrait','Outdoor portrait — Sigma / GM II','Sigma','Sony GM II')]:
 ua=next(u for c,u in figs if c==ca).split('?')[0]+'?ssl=1';ub=next(u for c,u in figs if c==cb).split('?')[0]+'?ssl=1'
 notes='Source comparison at f/1.4. Camera position, focus distance, lighting and processing are not independently controlled. Exposure differs; see EXIF. Retained original linked JPEG bytes; not a controlled test.'
 ids=[add(ua,group,'sigma-85-dg-dn','Sigma 85mm f/1.4 DG DN Art',notes,page,'Marc Alhadeff'),add(ub,group,'sony-85-gm-ii','Sony FE 85mm f/1.4 GM II',notes,page,'Marc Alhadeff')]
 pairs.append({'id':group,'title':title,'kind':'matched','quality':'Approximate match','images':ids,'notes':notes})
(root/'comparison-manifest.json').write_text(json.dumps({'images':images,'comparisons':pairs,'gaps':[]},indent=2)+'\n')
for i in images: print(i['id'],i['width'],i['height'],i['exif'])
