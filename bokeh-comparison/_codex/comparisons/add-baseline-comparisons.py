from pathlib import Path
import urllib.request,json,hashlib,subprocess
root=Path(__file__).resolve().parents[1];p=root/'comparison-manifest.json';d=json.loads(p.read_text())
if any(i['id'].startswith('peters-') for i in d['images']):raise SystemExit('Baseline already added')
page='https://phillipreeve.net/blog/sony-fe-1-885-vs-sony-fe-1-485-gm-the-big-shootout/'
for scene,frames,dist in [('roses',[1147,1148,1149],'half-body portrait distance, busy close background and foreground branch'),('tree',[1196,1197,1198],'full-body portrait distance, structured foliage and transition zone'),('plant',[1158,1159,1160],'minimum focusing distance, plant close-up')]:
 ids=[]
 for num,ap,lens in zip(frames,[1.4,1.7,1.8],['Sony FE 85mm f/1.4 GM']*2+['Sony FE 85mm f/1.8']):
  name=('sony-85-f18' if ap==1.8 else 'sony-85-gm')+'_f'+str(ap)+'.jpg';path=root/'comparisons'/('peters-'+scene)/name;path.parent.mkdir(parents=True,exist_ok=True)
  url=f'https://phillipreeve.net/blog/wp-content/uploads/2017/08/Sony_FE_vs_GM-{num:05d}.jpg'
  if not path.exists():path.write_bytes(urllib.request.urlopen(url,timeout=30).read())
  ex=json.loads(subprocess.check_output(['exiftool','-j','-n','-LensModel','-LensID','-FNumber','-Model','-ExposureTime','-ISO','-FocalLength','-DateTimeOriginal','-ImageWidth','-ImageHeight','-Software',str(path)]))[0];ex.pop('SourceFile',None)
  id='peters-'+scene+'-'+str(ap).replace('.','p');ids.append(id)
  notes='Source-labeled comparison scene: '+dist+'. Source labels the stopped-down GM aperture f/1.7, not f/1.8; retain that distinction. 800 px published full-frame web export, not camera-resolution original. Camera position, exact focus distance, exposure and processing equality not fully documented.'
  d['images'].append({'id':id,'path':str(path.relative_to(root)),'lens':lens,'aperture':'f/'+str(ap),'width':ex['ImageWidth'],'height':ex['ImageHeight'],'sourcePage':page,'imageUrl':url,'photographer':'Jannik Peters','verification':'Source-reported lens and aperture in per-image caption; EXIF checked','notes':notes,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'exif':ex})
 d['comparisons'] += [{'id':'peters-'+scene+'-wide','title':scene.title()+' — Sony 85 f/1.8 / original GM wide open','kind':'wide','quality':'Approximate match','images':[ids[2],ids[0]],'notes':notes+' Wide-open comparison: f/1.8 versus f/1.4; includes different blur quantity.'},{'id':'peters-'+scene+'-near','title':scene.title()+' — near aperture: f/1.8 / f/1.7','kind':'matched','quality':'Approximate match','images':[ids[2],ids[1]],'notes':notes+' Near-aperture comparison only: f/1.8 versus source-reported f/1.7, NOT identical aperture.'}]
d['gaps']=[x for x in d['gaps'] if not x.startswith('No different-maximum')]
d['gaps'].append('Sony 85mm f/1.8 baseline versus original GM: three wide-open pairs and three near-aperture pairs found. The source labels the stopped-down GM f/1.7, so these do not fulfill an exact f/1.8 match. All are 800 px web exports.')
p.write_text(json.dumps(d,indent=2)+'\n')
print(len(d['images']),'logical images',len(d['comparisons']),'pairs')
for i in d['images']:
 if i['id'].startswith('peters'):print(i['id'],i['exif'])
