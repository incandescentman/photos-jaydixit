import urllib.request,json,re,io,hashlib,subprocess
from pathlib import Path
from PIL import Image,ImageOps,ImageDraw
ROOT=Path(__file__).resolve().parent.parent
albums=[('sony-85-f18','72157679692551870','',r'1,8'),('sony-50-f12-gm','72157719147047088','page2',r'1,[248]'),('sony-135-f18-gm','72157706626804301','',r'1,8')]
candidates=[]
candidates=json.loads((ROOT/'research/baseline-candidates.json').read_text())
selected=[0,1,3,4,7,9,10,11,12,18,19,20]
notes={0:'Indoor portrait with bright trade-show lights and people at intermediate distances.',1:'Two-person portrait in a busy indoor setting. Source processed in black and white; color rendering cannot be assessed.',3:'Close foliage with a tree trunk and layered background.',4:'Two-person environmental portrait with street detail behind.',7:'Flowers and foliage at several distances.',9:'Portrait with street detail; f/1.8 reference.',10:'String light with foliage and other lights behind.',11:'Railing with defocused trees and grass.',12:'Portrait in a busy urban setting.',18:'Wooden chair edge with defocused shop detail and highlights.',19:'Group portrait against pedestrians and street detail.',20:'Portrait with flowers and pedestrians behind.'}
out=[]
def acquire(i):
 d=candidates[i];ident=f"{d['group']}-{d['id']}";path=f"samples/{d['group']}/{ident}.jpg";p=ROOT/path;p.parent.mkdir(parents=True,exist_ok=True)
 if not p.exists():
  try: p.write_bytes(subprocess.check_output(['curl','-fLsS','--max-time','180',d['imageUrl']]))
  except Exception as e:
   print('Download unavailable',ident,type(e).__name__,flush=True);return
 exif=json.loads(subprocess.check_output(['exiftool','-j','-Model','-LensModel','-LensID','-FNumber','-ExposureTime','-ISO','-FocalLength','-ImageWidth','-ImageHeight','-Artist','-Software',str(p)]))[0];exif.pop('SourceFile',None)
 assert exif.get('FNumber'),exif
 lens={'sony-85-f18':'Sony FE 85mm f/1.8','sony-50-f12-gm':'Sony FE 50mm f/1.2 GM','sony-135-f18-gm':'Sony FE 135mm f/1.8 GM'}[d['group']]
 out.append(dict(id=ident,path=path,lens=lens,aperture=f"f/{exif['FNumber']}",width=exif['ImageWidth'],height=exif['ImageHeight'],sourcePage=f"https://www.flickr.com/photos/sonyalphablog/{d['id']}/",imageUrl=d['imageUrl'],photographer='Marc Alhadeff',verification='EXIF-verified lens and aperture; corroborated by reviewer album and photo title.',notes=notes[i]+' Original public Flickr download; canDownload=true. Unrelated to other lenses, individual sample only. Reviewer processing retained.',sha256=hashlib.sha256(p.read_bytes()).hexdigest(),exif=exif,sample=True))
from concurrent.futures import ThreadPoolExecutor
with ThreadPoolExecutor(max_workers=3) as pool:
 list(pool.map(acquire,selected))
out.sort(key=lambda x:x['id'])
(ROOT/'baseline-manifest.json').write_text(json.dumps(out,indent=2,ensure_ascii=False)+'\n')
print('Downloaded',len(out),'baseline/reference originals')
