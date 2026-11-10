"""Assemble local, offline gallery data and source records without altering JPEGs."""
import json,hashlib,collections
from pathlib import Path
ROOT=Path(__file__).resolve().parent
images=[];comparisons=[];gaps=[];excluded=[]
for name in ['comparison-manifest.json','sample-manifest.json','baseline-manifest.json','sony-baseline-manifest.json']:
 p=ROOT/name
 if not p.exists():continue
 data=json.loads(p.read_text())
 if isinstance(data,list):images.extend(data)
 else:
  images.extend(data.get('images',data.get('samples',[])));comparisons.extend(data.get('comparisons',[]));gaps.extend(data.get('gaps',[]));excluded.extend(data.get('excludedImages',[]))
ep=ROOT/'sample-excluded-manifest.json'
if ep.exists():excluded.extend(json.loads(ep.read_text()))
for x in images:
 if isinstance(x.get('aperture'),(int,float)):x['aperture']='f/'+str(x['aperture'])
ids=[x['id'] for x in images];assert len(ids)==len(set(ids)),'Duplicate logical image ID'
for x in images:
 p=ROOT/x['path'];assert p.is_file(),p
 assert hashlib.sha256(p.read_bytes()).hexdigest()==x['sha256'],p
 assert x.get('lens') and x.get('aperture') and x.get('sourcePage') and x.get('imageUrl'),x
for c in comparisons:
 assert len(c['images'])==2 and all(x in ids for x in c['images']),c
 if c['quality']=='Controlled match':
  pair=[next(x for x in images if x['id']==i)for i in c['images']]
  assert pair[0]['aperture']==pair[1]['aperture']
# All review exports stay separate from camera-resolution originals. No transformations here.
data={'images':images,'comparisons':comparisons,'gaps':gaps}
(ROOT/'data.js').write_text('window.BOKEH_DATA = '+json.dumps(data,ensure_ascii=False,indent=2)+';\n')
(ROOT/'manifest.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
counts=collections.Counter(x['lens'] for x in images if x.get('sample') or x['path'].startswith('samples/'))
lines=['#+title: Bokeh Comparison Sources and Verification','', '* Scope','Personal photographic research only. Downloads are retained unchanged, with source SHA-256 hashes. No publication or redistribution. Photographs only; no video frames. Camera resolution and review-export resolution are distinguished in each record. A 100% view means one downloaded source pixel per display pixel; it cannot restore missing camera detail.','', '* Collection',f'- Individual photographs :: {sum(counts.values())}',f'- Comparison pairs :: {len(comparisons)}']
for lens,n in counts.items():lines.append(f'- {lens} :: {n} individual photographs')
lines+=['','* Evidence gaps']
for gap in gaps:lines.extend([gap,''])
lines+=['* Comparisons']
for c in comparisons:
 lines.extend(['',f'** {c["title"]}',f'- Classification :: {c["quality"]}',f'- Section :: {c["kind"]}',f'- Images :: {", ".join(c["images"])}',c.get('notes','')])
lines+=['','* Photograph records']
for x in images:
 groups=[c['title'] for c in comparisons if x['id'] in c['images']]
 lines.extend(['',f'** {x["id"]}',f'- Local file :: [[file:{ROOT/x["path"]}][{x["path"]}]]',f'- Comparison group :: {"; ".join(groups) if groups else "Individual sample"}',f'- Lens :: {x["lens"]}',f'- Aperture :: {x["aperture"]}',f'- Resolution :: {x["width"]} × {x["height"]}',f'- Photographer / reviewer :: {x["photographer"]}',f'- Source page :: [[{x["sourcePage"]}][Source page]]',f'- Original image URL :: [[{x["imageUrl"]}][Downloaded image]]',f'- Verification :: {x["verification"]}',f'- SHA-256 :: ~{x["sha256"]}~'])
 if x.get('crop'):lines.append('- Display-only source rectangle :: '+json.dumps(x['crop']))
 for k,v in x.get('exif',{}).items():
  if k!='SourceFile':lines.append(f'- EXIF {k} :: {v}')
 lines.append(x.get('notes',''))
if excluded:
 lines+=['','* Excluded downloads retained for provenance','These photographs are excluded from the gallery. The reasons below prevent later pooling from treating them as usable matched pairs.']
 for x in excluded:
  lines+=['',f'** {x.get("id",x.get("path","Excluded image"))}']
  for k,v in x.items():
   if k=='path':lines.append(f'- Local file :: [[file:{ROOT/v}][{v}]]')
   elif k in ['sourcePage','imageUrl']:lines.append(f'- {k} :: [[{v}][{k}]]')
   elif k=='exif':
    for ek,ev in v.items():
     if ek!='SourceFile':lines.append(f'- EXIF {ek} :: {ev}')
   else:lines.append(f'- {k} :: {v}')
lines+=['','* Pooling and cleanup','Use the image URL and SHA-256 together when pooling collections. Comparison membership is evidence, not a filename similarity: preserve all quality labels and aperture differences.','', '* Exact duplicate awaiting approval','The governing instruction is: “Whenever an exact duplicate is verified, always recommend deleting one. Name both full paths, recommend which copy to keep and why, and wait for Jay’s approval; the recommendation does not authorize deletion.”',f'Keep [[file:{ROOT}/samples/sigma-85-f12/sigma-85-f12_abbott-40-isolation-1-of-1.jpg][{ROOT}/samples/sigma-85-f12/sigma-85-f12_abbott-40-isolation-1-of-1.jpg]] because the gallery manifest references it. The acquisition review recommends deleting the identical inspection copy [[file:{ROOT}/samples/sigma-85-f12/sigma-85-f12_abbott-40-isolation.jpg][{ROOT}/samples/sigma-85-f12/sigma-85-f12_abbott-40-isolation.jpg]] after approval. It remains on disk and is excluded from the gallery.']
(ROOT/'sources.org').write_text('\n'.join(lines)+'\n')
report={'images':len(images),'unique_source_files':len(set(x['path']for x in images)),'individual_samples':sum(counts.values()),'samples_by_lens':counts,'controlled_pairs':sum(c['quality']=='Controlled match' for c in comparisons),'approximate_pairs':sum(c['quality']=='Approximate match' for c in comparisons),'wide_open_pairs':sum(c['kind']=='wide' for c in comparisons),'hashes_verified':len(images)}
(ROOT/'verification.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
