from pathlib import Path
import json, subprocess, re, html
from urllib.parse import quote
from PIL import Image
root=Path(__file__).resolve().parent
# The raw export remains local; the portable source uses local attachment paths.
s=(root/'conversation-source-sanitized.md').read_text()
ast=json.loads(subprocess.check_output(['pandoc','-f','gfm','-t','json'],input=s.encode()))
used=[]; omitted=[]
def plain(xs):
 return ''.join(x.get('c','') if x['t']=='Str' else ' ' if x['t']=='Space' else '' for x in xs)
def lens(n):
 if n.startswith('image(20261110-043'): return 'Sigma 85mm f/1.2 Art'
 if n in ['image(9).png','image(10).png'] or n.startswith('image(20261110-042'): return 'Sigma 85mm f/1.4 DG DN Art'
 return 'SongRaw 85mm f/1.2'
def picture(n):
 u='chatgpt-bokeh-uploads/'+quote(n)
 with Image.open(root/'chatgpt-bokeh-uploads'/n) as im: width,height=im.size
 return '<figure><a data-pswp-width="'+str(width)+'" data-pswp-height="'+str(height)+'" class="photo" href="'+u+'" target="_blank"><img width="'+str(width)+'" height="'+str(height)+'" loading="lazy" src="'+u+'" alt="'+html.escape(n)+'"></a><figcaption>'+html.escape(lens(n))+' · '+html.escape(n)+'</figcaption></figure>'
def walk(x):
 if isinstance(x,dict):
  if x.get('t')=='Image':
   n=plain(x['c'][1]); p=root/'chatgpt-bokeh-uploads'/n
   if n.startswith('image(') and p.is_file():
    used.append(n); return {'t':'RawInline','c':['html',picture(n)]}
   omitted.append(n)
   return {'t':'Str','c':'[Image omitted from this bokeh-photo archive: '+n+']'}
  return {k:walk(v) for k,v in x.items()}
 if isinstance(x,list): return [walk(v) for v in x]
 return x
ast=walk(ast)
# Group the original turns without changing their text.
blocks=[]; current=None; turns=0; bokeh_id=None
for b in ast['blocks']:
 if b['t']=='Header' and b['c'][0]==2 and plain(b['c'][2]) in ['Prompt:','Response:']:
  if current: blocks.append(current)
  turns+=1; role='user' if plain(b['c'][2])=='Prompt:' else 'assistant'
  current={'t':'Div','c':[[f'turn-{turns}', ['turn',role],[]],[{'t':'RawBlock','c':['html',('' if role=='user' else '<div class="speaker">ChatGPT</div>')]}] ]}
 elif current:
  if bokeh_id is None and '05-Portrait-.jpg' in json.dumps(b,ensure_ascii=False): bokeh_id=f'turn-{turns}'
  current['c'][1].append(b)
 else: blocks.append(b)
if current: blocks.append(current)
ast['blocks']=blocks
body=subprocess.check_output(['pandoc','-f','json','-t','html5'],input=json.dumps(ast).encode()).decode()
# Preserve unsupported product widgets in expandable source records.
body=re.sub(r'image_group.*?',lambda m:'<details class="widget"><summary>Product carousel (not included in export)</summary><code>'+html.escape(m.group())+'</code></details>',body)
css='''*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#faf9f6;color:#242424;font:20px/1.65 system-ui,sans-serif}main{max-width:1000px;margin:auto;padding:38px 28px 100px}h1{font-size:44px;line-height:1.15}h2{font-size:30px;line-height:1.3}h3{font-size:25px}a{color:#923329;overflow-wrap:anywhere}nav{position:sticky;top:0;background:#faf9f6f5;border-bottom:1px solid #ddd;padding:12px 24px;z-index:2;font-size:16px;display:flex;gap:24px;flex-wrap:wrap}.turn{padding:34px 0;border-top:1px solid #d6d3cd}.user{border-left:4px solid #a74637;padding-left:24px}.speaker{text-transform:uppercase;font-size:14px;letter-spacing:.1em;font-weight:700;color:#6c6059;margin-bottom:20px}figure{margin:24px 0}figure img{display:block;width:100%;height:auto;cursor:zoom-in}figcaption,.note,.widget{font-size:15px;color:#666}table{display:block;overflow:auto;border-collapse:collapse;font-size:18px}td,th{padding:10px;border:1px solid #ddd;text-align:left}pre{overflow:auto;font-size:15px}code{overflow-wrap:anywhere}details{margin:16px 0}.note{padding:16px;border:1px solid #ddd}button{font:inherit;padding:8px 14px;background:white;border:1px solid #aaa;border-radius:5px;cursor:pointer}@media(max-width:600px){main{padding:24px 16px 60px}h1{font-size:34px}.user{padding-left:14px}nav{gap:14px;padding:10px 16px}body{font-size:20px}}@media print{nav,.pswp{display:none}.turn{break-inside:auto}img{max-height:90vh;object-fit:contain}body{font-size:12pt}}
'''
js='''const lightbox=new PhotoSwipeLightbox({gallery:'#top',children:'a.photo',pswpModule:PhotoSwipe,bgOpacity:1});lightbox.init();'''
extra='<section id="additional"><h2>Additional downloaded image</h2><p class="note">This image was not referenced in the exported conversation. You identified it as SongRaw on November 10, 2026.</p>'+picture('image(2).png')+'</section>'
page='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bokeh conversation — Sony 55mm Lens Praise</title><link rel="stylesheet" href="vendor/photoswipe/photoswipe.css"><style>@layer base, theme; @layer base {'+css+'}</style><link rel="stylesheet" href="vendor/socratic/chatgpt-theme.css"><style>body.chatgpt-theme-wrapper{margin:0;padding:0}nav{background:#fffffff5}a{color:var(--chatgpt-link)}.user{border:0;background:var(--user-block-bg);border-radius:var(--user-block-radius);padding:24px;margin:24px 0}.speaker{color:var(--chatgpt-meta)}.pswp{--pswp-bg:#fff;--pswp-icon-color:#292929;--pswp-icon-color-secondary:#fff;--pswp-icon-stroke-color:#fff}.pswp__button{padding:0;border:0;border-radius:0;background:transparent}.pswp__counter{color:#292929;text-shadow:none}</style></head><body class="theme-chatgpt chatgpt-theme-wrapper"><nav><a href="#top">Beginning</a><a href="#'+(bokeh_id or 'turn-1')+'">Bokeh photo discussion</a><a href="#additional">Additional image</a></nav><main id="top" class="prose"><p class="note">Conversation preserved from your export. Only the downloaded bokeh-discussion images are included; other image positions are marked. Lens labels follow your conversation. Click any photograph to enlarge it; Escape closes the viewer.</p>'+body+extra+'</main><script src="vendor/photoswipe/photoswipe.umd.min.js"></script><script src="vendor/photoswipe/photoswipe-lightbox.umd.min.js"></script><script>'+js+'</script></body></html>'
(root/'bokeh-conversation.html').write_text(page)
(root/'conversation-verification.json').write_text(json.dumps({'turns':turns,'in_context_images':used,'additional_image':'image(2).png','omitted_non_bokeh_images':omitted,'bokeh_anchor':bokeh_id},indent=2)+'\n')
print(json.dumps({'turns':turns,'in_context_images':len(used),'additional':1,'omitted':len(omitted),'anchor':bokeh_id}))
